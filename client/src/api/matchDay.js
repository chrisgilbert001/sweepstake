import { get } from './client.js';

export function getFixturesToday() {
  return get('/fixtures/today');
}

export function getFixturesWeek() {
  return get('/fixtures/week');
}
