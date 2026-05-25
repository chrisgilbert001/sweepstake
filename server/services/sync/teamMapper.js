/**
 * Team Mapper for football-data.org API
 *
 * Provides a static mapping from football-data.org numeric team IDs to the
 * application's internal three-letter team codes. Validated at startup to
 * ensure all 48 tournament teams have a corresponding entry.
 */

/**
 * Static mapping from football-data.org numeric team IDs to internal 3-letter codes.
 * Covers all 48 teams in the 2026 FIFA World Cup.
 *
 * @type {Map<number, string>}
 */
export const TEAM_ID_MAP = new Map([
  // Pot 1
  [760, 'esp'],   // Spain
  [762, 'arg'],   // Argentina
  [773, 'fra'],   // France
  [770, 'eng'],   // England
  [764, 'bra'],   // Brazil
  [765, 'por'],   // Portugal
  [8601, 'ned'],  // Netherlands
  [805, 'bel'],   // Belgium
  [759, 'ger'],   // Germany
  [771, 'usa'],   // United States
  [769, 'mex'],   // Mexico
  [828, 'can'],   // Canada

  // Pot 2
  [799, 'cro'],   // Croatia
  [815, 'mar'],   // Morocco
  [818, 'col'],   // Colombia
  [758, 'uru'],   // Uruguay
  [788, 'sui'],   // Switzerland
  [766, 'jpn'],   // Japan
  [804, 'sen'],   // Senegal
  [840, 'irn'],   // Iran
  [772, 'kor'],   // South Korea
  [791, 'ecu'],   // Ecuador
  [816, 'aut'],   // Austria
  [779, 'aus'],   // Australia

  // Pot 3
  [8872, 'nor'],  // Norway
  [1836, 'pan'],  // Panama
  [825, 'egy'],   // Egypt
  [778, 'alg'],   // Algeria
  [8873, 'sco'],  // Scotland
  [761, 'par'],   // Paraguay
  [802, 'tun'],   // Tunisia
  [1935, 'civ'],  // Ivory Coast
  [8070, 'uzb'],  // Uzbekistan
  [8030, 'qat'],  // Qatar
  [801, 'sau'],   // Saudi Arabia
  [774, 'rsa'],   // South Africa

  // Pot 4
  [8049, 'jor'],  // Jordan
  [1930, 'cpv'],  // Cape Verde
  [763, 'gha'],   // Ghana
  [9460, 'cur'],  // Curacao
  [836, 'hai'],   // Haiti
  [783, 'nzl'],   // New Zealand
  [803, 'tur'],   // Turkey
  [1060, 'bih'],  // Bosnia and Herzegovina
  [792, 'swe'],   // Sweden
  [798, 'cze'],   // Czechia
  [8062, 'irq'],  // Iraq
  [1934, 'cod'],  // DR Congo
]);

/**
 * Maps a football-data.org numeric team ID to the internal 3-letter code.
 *
 * @param {number} apiTeamId - The football-data.org team ID
 * @returns {string|null} Three-letter code or null if unmapped
 */
export function mapTeamId(apiTeamId) {
  return TEAM_ID_MAP.get(apiTeamId) ?? null;
}

/**
 * Validates that all internal team codes have a corresponding mapping entry.
 *
 * @param {Array<string>} internalTeamIds - All team IDs from teams.json
 * @returns {{ valid: boolean, unmapped: string[] }}
 */
export function validateMapping(internalTeamIds) {
  const mappedCodes = new Set(TEAM_ID_MAP.values());
  const unmapped = internalTeamIds.filter((id) => !mappedCodes.has(id));

  return {
    valid: unmapped.length === 0,
    unmapped,
  };
}
