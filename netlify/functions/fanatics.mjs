// Fanatics / Impact affiliate API proxy
// GET /api/fanatics?explore=ads          → list available Fanatics ads/creatives
// GET /api/fanatics?explore=catalogs     → list available catalogs
// GET /api/fanatics?team=sf-giants&league=mlb  → get tracking link for a team (future)

const ACCOUNT_SID  = process.env.IMPACT_ACCOUNT_SID
const AUTH_TOKEN   = process.env.IMPACT_AUTH_TOKEN
const API_BASE     = `https://api.impact.com/Mediapartners/${ACCOUNT_SID}`

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function impactAuth() {
  const creds = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64')
  return `Basic ${creds}`
}

async function impactGet(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('PageSize', '50')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: impactAuth(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return {
    status: res.status,
    url: url.toString(),
    data,
    // Show auth prefix to confirm format (never full token)
    authPrefix: impactAuth().slice(0, 12) + '…',
  }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })

  const url     = new URL(req.url)
  const explore = url.searchParams.get('explore')

  // Debug endpoint — check env vars are present (never logs actual values)
  if (explore === 'debug') {
    return new Response(JSON.stringify({
      hasSid:   !!ACCOUNT_SID,
      hasToken: !!AUTH_TOKEN,
      sidPrefix: ACCOUNT_SID ? ACCOUNT_SID.slice(0, 6) + '…' : null,
      apiBase:  API_BASE,
    }), { status: 200, headers })
  }

  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    return new Response(JSON.stringify({ error: 'Impact credentials not configured', hasSid: !!ACCOUNT_SID, hasToken: !!AUTH_TOKEN }), { status: 500, headers })
  }

  try {
    // Explore: list ads
    if (explore === 'ads') {
      const result = await impactGet('/Ads')
      return new Response(JSON.stringify(result), { status: 200, headers })
    }

    // Explore: list catalogs
    if (explore === 'catalogs') {
      const result = await impactGet('/Catalogs')
      return new Response(JSON.stringify(result), { status: 200, headers })
    }

    // Explore: search catalog items for a team name
    if (explore === 'search') {
      const q = url.searchParams.get('q') || 'giants'
      const result = await impactGet('/Catalogs/ItemSearch', { SearchTerm: q })
      return new Response(JSON.stringify(result), { status: 200, headers })
    }

    return new Response(JSON.stringify({ error: 'Missing explore param. Use ?explore=ads, ?explore=catalogs, or ?explore=search&q=giants' }), { status: 400, headers })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}

export const config = { path: '/api/fanatics' }
