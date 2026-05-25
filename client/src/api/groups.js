import { get } from './client.js';

export function getGroupStandings() {
  return get('/groups');
}
