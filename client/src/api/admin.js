import { post, put } from './client.js';

function adminHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export function addResult(token, resultData) {
  return post('/admin/results', resultData, adminHeaders(token));
}

export function updateResult(token, id, resultData) {
  return put(`/admin/results/${id}`, resultData, adminHeaders(token));
}

export function setTournamentOdds(token, oddsData) {
  return post('/admin/odds/tournament', oddsData, adminHeaders(token));
}

export function setMatchOdds(token, oddsData) {
  return post('/admin/odds/match', oddsData, adminHeaders(token));
}

export function addFixture(token, fixtureData) {
  return post('/admin/fixtures', fixtureData, adminHeaders(token));
}

export function updateFixture(token, id, fixtureData) {
  return put(`/admin/fixtures/${id}`, fixtureData, adminHeaders(token));
}
