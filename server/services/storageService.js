import { readFile as fsReadFile, writeFile as fsWriteFile, rename, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import lockfile from 'proper-lockfile';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const RETRY_DELAYS = [100, 200, 400];

/**
 * Read and parse a JSON file from the data directory.
 * @param {string} filename - The filename to read (relative to server/data/)
 * @returns {Promise<any>} Parsed JSON data
 * @throws {Object} Error with statusCode and message
 */
export async function readFile(filename) {
  const filePath = resolveFilePath(filename);

  try {
    const content = await fsReadFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw { statusCode: 500, message: 'File not found', details: `${filename} does not exist` };
    }
    if (err instanceof SyntaxError) {
      throw { statusCode: 500, message: 'Corrupt JSON file', details: `${filename} contains invalid JSON` };
    }
    throw { statusCode: 500, message: 'Read failure', details: err.message };
  }
}

/**
 * Write data as JSON to a file with file-level locking.
 * @param {string} filename - The filename to write (relative to server/data/)
 * @param {any} data - The data to serialize as JSON
 * @returns {Promise<void>}
 * @throws {Object} Error with statusCode and message
 */
export async function writeFile(filename, data) {
  const filePath = resolveFilePath(filename);

  await ensureDirectoryExists(filePath);

  let release;
  try {
    release = await acquireLockWithRetry(filePath);
    await fsWriteFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } finally {
    if (release) {
      await release();
    }
  }
}

/**
 * Read a file, apply a transform function, and write back atomically with locking.
 * @param {string} filename - The filename to update (relative to server/data/)
 * @param {Function} fn - Transform function that receives current data and returns new data
 * @returns {Promise<any>} The updated data
 * @throws {Object} Error with statusCode and message
 */
export async function updateFile(filename, fn) {
  const filePath = resolveFilePath(filename);

  await ensureDirectoryExists(filePath);

  let release;
  try {
    release = await acquireLockWithRetry(filePath);

    let currentData;
    try {
      const content = await fsReadFile(filePath, 'utf-8');
      currentData = JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw { statusCode: 500, message: 'File not found', details: `${filename} does not exist` };
      }
      if (err instanceof SyntaxError) {
        throw { statusCode: 500, message: 'Corrupt JSON file', details: `${filename} contains invalid JSON` };
      }
      throw { statusCode: 500, message: 'Read failure', details: err.message };
    }

    const updatedData = fn(currentData);
    await fsWriteFile(filePath, JSON.stringify(updatedData, null, 2), 'utf-8');
    return updatedData;
  } finally {
    if (release) {
      await release();
    }
  }
}

/**
 * Resolve a filename to an absolute path within the data directory.
 */
function resolveFilePath(filename) {
  return path.join(DATA_DIR, filename);
}

/**
 * Ensure the directory for a file path exists.
 */
async function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Acquire a file lock with retry logic (3 retries, exponential backoff).
 * @param {string} filePath - The file to lock
 * @returns {Promise<Function>} Release function to unlock the file
 * @throws {Object} Error with statusCode 503 if all retries fail
 */
async function acquireLockWithRetry(filePath) {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const release = await lockfile.lock(filePath, {
        retries: 0,
        realpath: false
      });
      return release;
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt]);
      } else {
        throw { statusCode: 503, message: 'Service busy, please retry', details: 'Could not acquire file lock after retries' };
      }
    }
  }
}

/**
 * Write data as JSON to a file atomically: writes to a .tmp file first, then renames to the target path.
 * This ensures the target file always contains either the complete old data or the complete new data,
 * never a partial or corrupted state.
 * @param {string} filename - The filename to write (relative to server/data/)
 * @param {any} data - The data to serialize as JSON
 * @returns {Promise<void>}
 * @throws {Object} Error with statusCode and message
 */
export async function atomicWriteFile(filename, data) {
  const filePath = resolveFilePath(filename);
  const tmpPath = filePath + '.tmp';

  await ensureDirectoryExists(filePath);

  let release;
  try {
    // Ensure the target file exists for locking (create empty if needed)
    if (!existsSync(filePath)) {
      await fsWriteFile(filePath, '', 'utf-8');
    }
    release = await acquireLockWithRetry(filePath);
    // Write to temporary file first
    await fsWriteFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    // Atomically rename tmp file to target path
    await rename(tmpPath, filePath);
  } catch (err) {
    // Clean up tmp file if it exists after a failure
    try {
      if (existsSync(tmpPath)) {
        const { rm } = await import('fs/promises');
        await rm(tmpPath);
      }
    } catch { /* ignore cleanup errors */ }

    if (err.statusCode) throw err;
    throw { statusCode: 500, message: 'Atomic write failure', details: err.message };
  } finally {
    if (release) {
      await release();
    }
  }
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
