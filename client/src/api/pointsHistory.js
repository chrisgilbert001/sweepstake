import { get } from './client.js';

export function getPointsHistory(slug) {
  return get(`/leagues/${slug}/points-history`);
}
