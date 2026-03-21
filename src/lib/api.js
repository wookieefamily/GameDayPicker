// ── Schedule import (ESPN proxy) ─────────────────────────────────────────────

export async function fetchTeams(league) {
  const res = await fetch(`/api/schedule?action=teams&league=${encodeURIComponent(league)}`)
  if (!res.ok) throw new Error(`Failed to load teams: ${res.status}`)
  const data = await res.json()
  return data.teams ?? []
}

export async function fetchGames(league, teamId, season, teamAbbr) {
  let url = `/api/schedule?action=games&league=${encodeURIComponent(league)}&teamId=${encodeURIComponent(teamId)}&season=${encodeURIComponent(season)}`
  if (teamAbbr) url += `&teamAbbr=${encodeURIComponent(teamAbbr)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load schedule: ${res.status}`)
  const data = await res.json()
  return data.games ?? []
}

// ── Poll configs (Netlify Blobs via serverless function) ──────────────────────

export async function fetchPoll(slug) {
  const res = await fetch(`/api/polls?slug=${encodeURIComponent(slug)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to load poll: ${res.status}`)
  return res.json()
}

export async function createPoll(config) {
  const res = await fetch('/api/polls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) throw new Error(`Failed to create poll: ${res.status}`)
  return res.json() // { slug }
}

// ── Votes (JSONBin via serverless function) ───────────────────────────────────

export async function fetchVotes(slug, group = 'default') {
  const res = await fetch(`/api/votes?poll=${encodeURIComponent(slug)}&group=${encodeURIComponent(group)}`)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data.votes) ? data.votes : []
}

export async function pushVotes(slug, group, votes) {
  const res = await fetch(`/api/votes?poll=${encodeURIComponent(slug)}&group=${encodeURIComponent(group)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ votes }),
  })
  if (!res.ok) throw new Error(`Save failed: ${res.status}`)
}

export async function deleteVotes(slug, group = 'default') {
  const res = await fetch(`/api/votes?poll=${encodeURIComponent(slug)}&group=${encodeURIComponent(group)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Reset failed: ${res.status}`)
}
