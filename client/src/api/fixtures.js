import { get } from './client.js';

export function getFixtures() {
  return get('/fixtures');
}
