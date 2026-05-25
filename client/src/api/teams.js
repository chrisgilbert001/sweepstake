import { get } from './client.js';

export function getTeams() {
  return get('/teams');
}
