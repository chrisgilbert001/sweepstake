import { get } from './client.js';

export function getResults() {
  return get('/results');
}
