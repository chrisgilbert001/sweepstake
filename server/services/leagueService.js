import crypto from 'crypto';
import { readFile, atomicWriteFile, updateFile } from './storageService.js';
import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const LEAGUES_DIR = path.join(DATA_DIR, 'leagues');

/**
 * Validate a name (league or participant).
 * Must be 1–50 characters and contain at least one non-whitespace character.
 * @param {string} name
 * @returns {boolean}
 */
export function validateName(name) {
  if (typeof name !== 'string') return false;
  if (name.length < 1 || name.length > 50) return false;
  if (!/\S/.test(name)) return false;
  return true;
}

/**
 * Convert a name to a URL-friendly slug.
 * Lowercase, replace spaces/special chars with hyphens, collapse multiple hyphens,
 * trim leading/trailing hyphens.
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a unique 6-character alphanumeric join code.
 * @returns {string}
 */
export function generateJoinCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

/**
 * List all league slugs by reading the leagues directory.
 * @returns {Promise<string[]>}
 */
export async function listLeagues() {
  try {
    const files = await readdir(LEAGUES_DIR);
    return files
      .filter(f => f.endsWith('.json') && f !== '.gitkeep')
      .map(f => f.replace('.json', ''));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Get a league by its slug.
 * @param {string} slug
 * @returns {Promise<object>}
 * @throws {object} 404 if not found
 */
export async function getLeague(slug) {
  try {
    return await readFile(`leagues/${slug}.json`);
  } catch (err) {
    if (err.statusCode === 500 && err.message === 'File not found') {
      throw { statusCode: 404, message: 'League not found' };
    }
    throw err;
  }
}

/**
 * Find a league by its join code.
 * @param {string} joinCode
 * @returns {Promise<object>}
 * @throws {object} 404 if not found
 */
export async function getLeagueByJoinCode(joinCode) {
  const slugs = await listLeagues();
  for (const slug of slugs) {
    const league = await readFile(`leagues/${slug}.json`);
    if (league.joinCode === joinCode) {
      return league;
    }
  }
  throw { statusCode: 404, message: 'League not found' };
}

/**
 * Create a new league.
 * @param {string} name
 * @param {string} [creatorEmail] - Email of the league creator (optional, sets ownership)
 * @returns {Promise<object>} The created league data
 * @throws {object} 400 for invalid name, 409 for duplicate name
 */
export async function createLeague(name, creatorEmail) {
  if (!validateName(name)) {
    throw { statusCode: 400, message: 'League name must be between 1 and 50 characters and contain at least one non-whitespace character' };
  }

  // Check for duplicate name (case-sensitive)
  const slugs = await listLeagues();
  for (const slug of slugs) {
    const existing = await readFile(`leagues/${slug}.json`);
    if (existing.name === name) {
      throw { statusCode: 409, message: 'League name already taken' };
    }
  }

  const slug = slugify(name);
  const joinCode = generateJoinCode();

  const league = {
    slug,
    name,
    joinCode,
    createdBy: creatorEmail ? creatorEmail.trim().toLowerCase() : null,
    createdAt: new Date().toISOString(),
    participants: [],
    draft: {
      status: 'not_started',
      order: [],
      currentPot: 4,
      currentRound: 1,
      currentPickIndex: 0,
      spinsCompleted: 0,
      allocations: {}
    }
  };

  await atomicWriteFile(`leagues/${slug}.json`, league);
  return league;
}

/**
 * Validate an email address (basic format check).
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Add a participant to a league.
 * @param {string} slug
 * @param {string} name
 * @param {string} email
 * @returns {Promise<object>} The updated league data
 * @throws {object} 400 for invalid name/email or max participants, 404 for not found, 409 for duplicate name
 */
export async function addParticipant(slug, name, email) {
  if (!validateName(name)) {
    throw { statusCode: 400, message: 'Participant name must be between 1 and 50 characters and contain at least one non-whitespace character' };
  }

  if (!validateEmail(email)) {
    throw { statusCode: 400, message: 'A valid email address is required' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const updated = await updateFile(`leagues/${slug}.json`, (league) => {
    // Check max participants
    if (league.participants.length >= 6) {
      throw { statusCode: 400, message: 'League already has maximum 6 participants' };
    }

    // Check duplicate name
    const duplicate = league.participants.some(p => p.name === name);
    if (duplicate) {
      throw { statusCode: 409, message: 'Participant name already used in this league' };
    }

    const id = `p${league.participants.length + 1}`;
    return {
      ...league,
      participants: [...league.participants, { id, name, email: normalizedEmail }]
    };
  });

  return updated;
}

/**
 * Get all leagues that a participant (by email) belongs to.
 * Returns league slug, name, participant name, and their position in standings.
 * @param {string} email
 * @returns {Promise<Array<{ slug: string, name: string, participantName: string, participantId: string }>>}
 */
export async function getLeaguesByEmail(email) {
  if (!validateEmail(email)) {
    throw { statusCode: 400, message: 'A valid email address is required' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const slugs = await listLeagues();
  const results = [];

  for (const slug of slugs) {
    const league = await readFile(`leagues/${slug}.json`);
    const participant = league.participants.find(p => p.email === normalizedEmail);
    if (participant) {
      results.push({
        slug: league.slug,
        name: league.name,
        participantName: participant.name,
        participantId: participant.id
      });
    }
  }

  return results;
}

/**
 * Mark the draft reveal as seen for a participant (by email).
 * Sets `draftSeen: true` on the participant object.
 * @param {string} slug
 * @param {string} email
 * @returns {Promise<object>} The updated league data
 * @throws {object} 400 for invalid email, 404 for not found or participant not in league
 */
export async function markDraftSeen(slug, email) {
  if (!validateEmail(email)) {
    throw { statusCode: 400, message: 'A valid email address is required' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const updated = await updateFile(`leagues/${slug}.json`, (league) => {
    const participantIndex = league.participants.findIndex(p => p.email === normalizedEmail);
    if (participantIndex === -1) {
      throw { statusCode: 404, message: 'Participant not found in this league' };
    }

    const newParticipants = [...league.participants];
    newParticipants[participantIndex] = {
      ...newParticipants[participantIndex],
      draftSeen: true
    };

    return { ...league, participants: newParticipants };
  });

  return updated;
}
