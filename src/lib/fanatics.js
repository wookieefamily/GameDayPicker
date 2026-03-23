// Fanatics affiliate deep-link builder
// Publisher ID: 7106978, Campaign: 9663 (Fanatics Global)
// All ads allow deep linking — we use ad 893669 as base tracking URL

const TRACKING_BASE = 'https://fanatics.93n6tx.net/c/7106978/893669/9663'

const LEAGUE_PATH = {
  mlb:   'mlb',
  nfl:   'nfl',
  nba:   'nba',
  nhl:   'nhl',
  mls:   'soccer',
  nwsl:  'soccer',
  wnba:  'wnba',
  ncaab: 'college',
  ncaaf: 'college',
  wcbb:  'college',
}

function teamSlug(name) {
  return name
    .toLowerCase()
    .replace(/\./g, '')           // St. Louis → st louis
    .replace(/&/g, 'and')
    .replace(/\s+/g, '-')         // spaces → hyphens
    .replace(/[^a-z0-9-]/g, '')  // strip remaining special chars
    .replace(/-+/g, '-')          // collapse double hyphens
}

export function fanaticsUrl(league, teamName) {
  const path = LEAGUE_PATH[league]
  if (!path || !teamName) return null
  const slug = teamSlug(teamName)
  const dest = `https://www.fanatics.com/${path}/${slug}/`
  return `${TRACKING_BASE}?u=${encodeURIComponent(dest)}`
}

// Sport emoji for the card
export const LEAGUE_EMOJI = {
  mlb: '⚾', nfl: '🏈', nba: '🏀', nhl: '🏒',
  mls: '⚽', nwsl: '⚽', wnba: '🏀', ncaab: '🏀', ncaaf: '🏈', wcbb: '🏀',
}

export const LEAGUE_LABEL = {
  mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL',
  mls: 'MLS', nwsl: 'NWSL', wnba: 'WNBA', ncaab: 'College Basketball',
  ncaaf: 'College Football', wcbb: "Women's College Basketball",
}
