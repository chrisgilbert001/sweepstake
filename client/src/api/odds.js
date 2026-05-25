import { get } from './client.js';

export function getTournamentOdds() {
  return get('/odds/tournament');
}

export function getMatchOdds(fixtureId) {
  return get(`/odds/match/${fixtureId}`);
}
