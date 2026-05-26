import { get, post } from './client.js';

export function startDraft(slug) {
  return post(`/leagues/${slug}/draft/start`);
}

export function getDraftState(slug) {
  return get(`/leagues/${slug}/draft/state`);
}

export function spinWheel(slug) {
  return post(`/leagues/${slug}/draft/spin`);
}

export function runFullDraft(slug) {
  return post(`/leagues/${slug}/draft/run`);
}
