import { get } from './client.js';

export function getMyTeams(slug, participantId) {
  return get(`/leagues/${slug}/my-teams/${participantId}`);
}
