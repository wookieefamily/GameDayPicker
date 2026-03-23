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

// Team-specific page params (o- + t- taxonomy) — verified via Fanatics.com search results.
// Key format: "{league}:{team-slug}"
// For unlisted teams we fall back to a Fanatics site search URL.
const TEAM_PAGE_PARAMS = {
  // NFL
  'nfl:arizona-cardinals':      'o-3505+t-47267808',
  'nfl:atlanta-falcons':        'o-3538+t-70267744',
  'nfl:baltimore-ravens':       'o-8094+t-14047944',
  'nfl:buffalo-bills':          'o-3561+t-81260256',
  'nfl:carolina-panthers':      'o-2461+t-36155483',
  'nfl:chicago-bears':          'o-1316+t-70263569',
  'nfl:cincinnati-bengals':     'o-4649+t-36262404',
  'nfl:cleveland-browns':       'o-2461+t-25047570',
  'nfl:dallas-cowboys':         'o-2483+t-70824640',
  'nfl:denver-broncos':         'o-1349+t-92827974',
  'nfl:detroit-lions':          'o-3516+t-14709413',
  'nfl:green-bay-packers':      'o-3516+t-36593543',
  'nfl:houston-texans':         'o-4605+t-14713644',
  'nfl:indianapolis-colts':     'o-1361+t-47485856',
  'nfl:jacksonville-jaguars':   'o-2461+t-36263824',
  'nfl:kansas-city-chiefs':     'o-2472+t-70269247',
  'nfl:las-vegas-raiders':      'o-1372+t-36710414',
  'nfl:los-angeles-chargers':   'o-3561+t-47601773',
  'nfl:los-angeles-rams':       'o-1361+t-47485893',
  'nfl:miami-dolphins':         'o-1327+t-92268105',
  'nfl:minnesota-vikings':      'o-2461+t-14821440',
  'nfl:new-england-patriots':   'o-3516+t-47484796',
  'nfl:new-orleans-saints':     'o-4661+t-69043653',
  'nfl:new-york-giants':        'o-3572+t-79497891',
  'nfl:new-york-jets':          'o-2472+t-47601448',
  'nfl:philadelphia-eagles':    'o-2461+t-69263771',
  'nfl:pittsburgh-steelers':    'o-2449+t-03379361',
  'nfl:san-francisco-49ers':    'o-3527+t-25828229',
  'nfl:seattle-seahawks':       'o-1361+t-92938242',
  'nfl:tampa-bay-buccaneers':   'o-3550+t-92374956',
  'nfl:tennessee-titans':       'o-2461+t-47266368',
  'nfl:washington-commanders':  'o-3516+t-36149706',
  // MLB
  'mlb:arizona-diamondbacks':   'o-3454+t-47269430',
  'mlb:atlanta-braves':         'o-1276+t-58999683',
  'mlb:baltimore-orioles':      'o-1265+t-70558553',
  'mlb:boston-red-sox':         'o-9043+t-36440786',
  'mlb:chicago-cubs':           'o-3443+t-25999766',
  'mlb:chicago-white-sox':      'o-3454+t-36003298',
  'mlb:cincinnati-reds':        'o-1254+t-58560673',
  'mlb:cleveland-guardians':    'o-3465+t-14771090',
  'mlb:colorado-rockies':       'o-2376+t-47267887',
  'mlb:detroit-tigers':         'o-1254+t-36002453',
  'mlb:houston-astros':         'o-3443+t-14555396',
  'mlb:kansas-city-royals':     'o-2332+t-25003780',
  'mlb:los-angeles-angels':     'o-1276+t-47884540',
  'mlb:los-angeles-dodgers':    'o-4510+t-14991099',
  'mlb:miami-marlins':          'o-3443+t-25001234',
  'mlb:milwaukee-brewers':      'o-3454+t-58997683',
  'mlb:minnesota-twins':        'o-2354+t-47271178',
  'mlb:new-york-mets':          'o-4521+t-36889897',
  'mlb:new-york-yankees':       'o-3454+t-81553209',
  'mlb:oakland-athletics':      'o-2365+t-36002677',
  'mlb:philadelphia-phillies':  'o-8921+t-47011101',
  'mlb:pittsburgh-pirates':     'o-3443+t-25002342',
  'mlb:san-diego-padres':       'o-3454+t-47346626',
  'mlb:san-francisco-giants':   'o-1298+t-47564438',
  'mlb:seattle-mariners':       'o-1232+t-47896628',
  'mlb:st-louis-cardinals':     'o-3409+t-36014454',
  'mlb:tampa-bay-rays':         'o-3465+t-36002811',
  'mlb:texas-rangers':          'o-2365+t-70564589',
  'mlb:toronto-blue-jays':      'o-1265+t-47268123',
  'mlb:washington-nationals':   'o-3443+t-36003456',
}

export function fanaticsUrl(league, teamName) {
  const leaguePath = LEAGUE_PATH[league]
  if (!leaguePath || !teamName) return null
  const slug = teamSlug(teamName)
  const key = `${league}:${slug}`
  const params = TEAM_PAGE_PARAMS[key]
  let dest
  if (params) {
    dest = `https://www.fanatics.com/${leaguePath}/${slug}/${params}`
  } else {
    // Fallback: Fanatics search — always shows team-specific gear
    dest = `https://www.fanatics.com/search?query=${encodeURIComponent(teamName)}`
  }
  return `${TRACKING_BASE}?u=${encodeURIComponent(dest)}`
}

// Team logo via ESPN CDN — abbreviations come from ESPN's own API so they match exactly
const ESPN_LEAGUE_FOLDER = {
  nfl: 'nfl', mlb: 'mlb', nba: 'nba', nhl: 'nhl',
  mls: 'soccer', wnba: 'wnba',
}

export function teamLogoUrl(league, abbrev) {
  const folder = ESPN_LEAGUE_FOLDER[league]
  if (!folder || !abbrev) return null
  return `https://a.espncdn.com/i/teamlogos/${folder}/500/${abbrev.toLowerCase()}.png`
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
