import { get, post } from './client.js';

export function createLeague(name) {
  return post('/leagues', { name });
}

export function getLeague(slug) {
  return get(`/leagues/${slug}`);
}

export function addParticipant(slug, name) {
  return post(`/leagues/${slug}/participants`, { name });
}

export function getLeagueByJoinCode(joinCode) {
  return get(`/leagues/join/${joinCode}`);
}

export function joinLeague(joinCode, name) {
  return post(`/leagues/join/${joinCode}`, { name });
}
