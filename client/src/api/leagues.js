import { get, post } from './client.js';

export function createLeague(name, email) {
  return post('/leagues', { name, email });
}

export function getLeague(slug) {
  return get(`/leagues/${slug}`);
}

export function addParticipant(slug, name, email) {
  return post(`/leagues/${slug}/participants`, { name, email });
}

export function getLeagueByJoinCode(joinCode) {
  return get(`/leagues/join/${joinCode}`);
}

export function joinLeague(joinCode, name, email) {
  return post(`/leagues/join/${joinCode}`, { name, email });
}

export function getMyLeagues(email) {
  return get(`/me/${encodeURIComponent(email)}/leagues`);
}

export function markDraftSeen(slug, email) {
  return post(`/leagues/${slug}/draft-seen`, { email });
}
