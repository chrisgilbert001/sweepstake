/**
 * Status Mapper Module
 *
 * Maps football-data.org match status enums to the application's
 * internal fixture status strings.
 */

const STATUS_MAP = {
  SCHEDULED: 'scheduled',
  TIMED: 'scheduled',
  FINISHED: 'completed',
  LIVE: 'in_progress',
  IN_PLAY: 'in_progress',
  PAUSED: 'in_progress',
  POSTPONED: 'postponed',
  SUSPENDED: 'postponed',
  CANCELLED: 'postponed',
};

/**
 * Maps a football-data.org match status to internal fixture status.
 * @param {string} apiStatus - API status enum value
 * @returns {{ status: string|null, known: boolean }}
 *   status: mapped value or null if unknown
 *   known: whether the input was a recognised status
 */
export function mapMatchStatus(apiStatus) {
  const mapped = STATUS_MAP[apiStatus];

  if (mapped !== undefined) {
    return { status: mapped, known: true };
  }

  return { status: null, known: false };
}
