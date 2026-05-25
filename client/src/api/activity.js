import { get } from './client.js';

export function getActivity(slug, page = 1, limit = 50) {
  return get(`/leagues/${slug}/activity?page=${page}&limit=${limit}`);
}
