import { useState, useEffect, useMemo, useRef } from 'react'
import Spinner from './Spinner.jsx'
import { fetchTeams, fetchGames } from '../lib/api.js'
import { slugify, monthFromIso } from '../lib/slugify.js'

const LEAGUE_GROUPS = [
  {
    label: "Men's Leagues",
    leagues: [
      { key: 'mlb',   label: 'MLB ⚾' },
      { key: 'nfl',   label: 'NFL 🏈' },
      { key: 'nba',   label: 'NBA 🏀' },
      { key: 'nhl',   label: 'NHL 🏒' },
      { key: 'mls',   label: 'MLS ⚽' },
      { key: 'ncaaf', label: 'College Football 🏈' },
      { key: 'ncaab', label: 'College Basketball 🏀' },
    ],
  },
  {
    label: "Women's Leagues",
    leagues: [
      { key: 'wnba', label: 'WNBA 🏀' },
      { key: 'wcbb', label: "Women's College Basketball 🏀" },
    ],
  },
]
const ALL_LEAGUES = LEAGUE_GROUPS.flatMap(g => g.leagues)

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function parseGame(game) {
  const d        = new Date(game.utcDate)
  const dow      = d.getDay()
  const localHour = d.getHours() + d.getMinutes() / 60
  const month    = d.toLocaleDateString('en-US', { month: 'long' })
  const date     = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time     = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const isoDate  = d.toISOString().slice(0, 10)
  return { ...game, dow, localHour, month, date, time, isoDate }
}

function gameToOption(g, idx) {
  const prefix = g.homeAway === 'home' ? 'vs.' : '@'
  return {
    id:      slugify(g.opponent) + '-' + idx,
    name:    `${prefix} ${g.opponent}`,
    isoDate: g.isoDate,
    date:    g.date,
    month:   g.month,
    time:    g.time,
    note:    g.venue || null,
  }
}

export default function ScheduleImporter({ onImport }) {
  const [open,        setOpen]        = useState(true)
  const [league,      setLeague]      = useState('mlb')
  const [teams,       setTeams]       = useState([])
  const [teamQuery,   setTeamQuery]   = useState('')
  const [selectedTeam,setSelectedTeam]= useState(null)
  const [season,      setSeason]      = useState(String(new Date().getFullYear()))
  const [games,       setGames]       = useState([])

  const [days,        setDays]        = useState(new Set(DAYS))
  const [homeAway,    setHomeAway]    = useState('home')
  const [timeFilter,  setTimeFilter]  = useState('all')
  const [timeMin,     setTimeMin]     = useState(10)
  const [timeMax,     setTimeMax]     = useState(17)

  const [loadingTeams,setLoadingTeams]= useState(false)
  const [loadingGames,setLoadingGames]= useState(false)
  const [error,       setError]       = useState(null)

  // Cross-league freeform search
  const [globalQuery, setGlobalQuery] = useState('')
  const [allTeams,    setAllTeams]    = useState(null) // null = not yet loaded
  const [loadingAll,  setLoadingAll]  = useState(false)

  // Ref to skip resetting selected team when league changes via global search
  const skipTeamReset = useRef(false)

  useEffect(() => {
    if (!open) return
    const preserveSelection = skipTeamReset.current
    skipTeamReset.current = false
    if (!preserveSelection) {
      setTeams([])
      setSelectedTeam(null)
      setGames([])
      setTeamQuery('')
      setError(null)
    }
    setLoadingTeams(true)
    fetchTeams(league)
      .then(t => setTeams(t))
      .catch(e => setError(e.message))
      .finally(() => setLoadingTeams(false))
  }, [league, open])

  // Lazy-load all teams when user starts typing in global search
  useEffect(() => {
    if (!globalQuery.trim() || allTeams !== null || loadingAll) return
    setLoadingAll(true)
    Promise.all(
      ALL_LEAGUES.map(l =>
        fetchTeams(l.key)
          .then(ts => ts.map(t => ({ ...t, leagueKey: l.key, leagueLabel: l.label })))
          .catch(() => [])
      )
    )
      .then(results => setAllTeams(results.flat()))
      .finally(() => setLoadingAll(false))
  }, [globalQuery, allTeams, loadingAll])

  const filteredTeams = useMemo(() =>
    teamQuery.trim()
      ? teams.filter(t => t.name.toLowerCase().includes(teamQuery.toLowerCase()))
      : teams,
    [teams, teamQuery]
  )

  const globalResults = useMemo(() => {
    if (!globalQuery.trim() || !allTeams) return []
    return allTeams
      .filter(t => t.name.toLowerCase().includes(globalQuery.toLowerCase()))
      .slice(0, 25)
  }, [globalQuery, allTeams])

  const selectGlobalTeam = (t) => {
    skipTeamReset.current = true
    setLeague(t.leagueKey)
    setSelectedTeam(t)
    setTeamQuery(t.name)
    setGlobalQuery('')
    setGames([])
  }

  const loadGames = async () => {
    if (!selectedTeam) return
    setLoadingGames(true)
    setError(null)
    setGames([])
    try {
      const raw = await fetchGames(league, selectedTeam.id, season, selectedTeam.abbreviation)
      setGames(raw.map(parseGame))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingGames(false)
    }
  }

  const filtered = useMemo(() => {
    return games.filter(g => {
      if (!days.has(DAYS[g.dow])) return false
      if (homeAway === 'home'  && (g.homeAway !== 'home' || g.neutralSite)) return false
      if (homeAway === 'away'  && (g.homeAway !== 'away' || g.neutralSite)) return false
      if (timeFilter === 'day'     && g.localHour >= 17) return false
      if (timeFilter === 'evening' && g.localHour < 17)  return false
      if (timeFilter === 'custom'  && (g.localHour < timeMin || g.localHour >= timeMax)) return false
      return true
    })
  }, [games, days, homeAway, timeFilter, timeMin, timeMax])

  const handleImport = () => {
    const options = filtered.map((g, i) => gameToOption(g, i))
    onImport(options, league)
    setOpen(false)
  }

  const toggleDay = day => {
    setDays(prev => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      return next
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ width: '100%', padding: '13px', borderRadius: 10, border: '2px dashed #93c5fd', background: '#eff6ff', color: '#1d4ed8', fontSize: 17, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 6, fontWeight: 600 }}
      >
        📅 Import from Team Schedule
      </button>
    )
  }

  return (
    <div style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span style={{ color: '#1d4ed8', fontWeight: 700, fontSize: 17 }}>📅 Import from Team Schedule</span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#8aa3be', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>✕</button>
      </div>

      {/* Freeform cross-league search */}
      <div style={{ marginBottom: 20, padding: '14px 16px', background: '#f8faff', border: '1.5px solid #bfdbfe', borderRadius: 12 }}>
        <label style={{ ...labelStyle, color: '#1d4ed8', marginBottom: 6 }}>🔍 Search Across All Sports</label>
        <div style={{ position: 'relative' }}>
          <input
            value={globalQuery}
            onChange={e => { setGlobalQuery(e.target.value); setSelectedTeam(null); setGames([]) }}
            placeholder="e.g. UCLA, Chicago, Real Salt Lake…"
            style={inputStyle}
          />
        </div>
        {globalQuery && (
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, marginTop: 4, background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {loadingAll
              ? <div style={{ padding: '12px 16px', color: '#5a7a9a', fontSize: 15 }}><Spinner />Searching all sports…</div>
              : globalResults.length === 0
                ? <div style={{ padding: '12px 16px', color: '#5a7a9a', fontSize: 15 }}>No teams found</div>
                : globalResults.map(t => (
                  <div key={`${t.leagueKey}-${t.id}`} onClick={() => selectGlobalTeam(t)}
                    style={{ padding: '10px 16px', cursor: 'pointer', color: '#1a3a5c', fontSize: 15, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontWeight: 600 }}>{t.name}</span>
                    <span style={{ color: '#6b7280', fontSize: 11, background: '#f3f4f6', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap', marginLeft: 8 }}>{t.leagueLabel}</span>
                  </div>
                ))
            }
          </div>
        )}
        <div style={{ color: '#6b7eaf', fontSize: 12, marginTop: 6 }}>Search by team name — or browse by league below</div>
      </div>

      {/* Step 1: League */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>1. League</label>
        {LEAGUE_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 12 }}>
            <div style={{ color: '#5a7a9a', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{group.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {group.leagues.map(l => (
                <button key={l.key} onClick={() => setLeague(l.key)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
                    borderColor: league === l.key ? '#2563eb' : '#d1d5db',
                    background:  league === l.key ? '#eff6ff' : 'white',
                    color:       league === l.key ? '#1d4ed8' : '#5a7a9a',
                  }}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Step 2: Team */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>2. Team</label>
        {loadingTeams
          ? <div style={{ color: '#5a7a9a', fontSize: 16 }}><Spinner />Loading teams…</div>
          : (
            <>
              <input
                value={teamQuery}
                onChange={e => { setTeamQuery(e.target.value); setSelectedTeam(null); setGames([]) }}
                placeholder={`Search ${ALL_LEAGUES.find(l=>l.key===league)?.label ?? ''} teams…`}
                style={inputStyle}
              />
              {teamQuery && !selectedTeam && (
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, marginTop: 4, background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {filteredTeams.length === 0
                    ? <div style={{ padding: '12px 16px', color: '#5a7a9a', fontSize: 16 }}>No teams found</div>
                    : filteredTeams.map(t => (
                      <div key={t.id} onClick={() => { setSelectedTeam(t); setTeamQuery(t.name); setGames([]) }}
                        style={{ padding: '10px 16px', cursor: 'pointer', color: '#1a3a5c', fontSize: 16, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span>{t.name}</span>
                        <span style={{ color: '#8aa3be', fontSize: 12 }}>{t.abbreviation}</span>
                      </div>
                    ))
                  }
                </div>
              )}
              {selectedTeam && (
                <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, padding: '6px 12px' }}>
                  <span style={{ color: '#1d4ed8', fontSize: 16, fontWeight: 700 }}>{selectedTeam.name}</span>
                  <button onClick={() => { setSelectedTeam(null); setTeamQuery(''); setGames([]) }}
                    style={{ background: 'none', border: 'none', color: '#8aa3be', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
                </div>
              )}
            </>
          )
        }
      </div>

      {/* Step 3: Season + load */}
      {selectedTeam && (
        <div style={{ marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>3. Season</label>
            <input
              type="number" value={season} min="2020" max="2030"
              onChange={e => setSeason(e.target.value)}
              style={{ ...inputStyle, width: 110 }}
            />
          </div>
          <button onClick={loadGames} disabled={loadingGames}
            style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: loadingGames ? '#e5e7eb' : '#2563eb', color: loadingGames ? '#8aa3be' : 'white', fontSize: 16, fontWeight: 800, fontFamily: 'inherit', cursor: loadingGames ? 'default' : 'pointer', marginBottom: 1 }}>
            {loadingGames ? <><Spinner />Loading…</> : 'Load Schedule'}
          </button>
        </div>
      )}

      {error && <div style={{ color: '#dc2626', fontSize: 16, marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 8 }}>⚠️ {error}</div>}

      {/* Step 4: Filters */}
      {games.length > 0 && (
        <>
          <div style={{ height: 1, background: '#f3f4f6', margin: '20px 0' }} />
          <label style={{ ...labelStyle, marginBottom: 14 }}>4. Filters</label>

          {/* Day of week */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#5a7a9a', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Days of week</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAYS.map((day, i) => (
                <button key={day} onClick={() => toggleDay(day)}
                  style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                    borderColor: days.has(day) ? '#2563eb' : '#d1d5db',
                    background:  days.has(day) ? '#eff6ff' : 'white',
                    color:       days.has(day) ? '#1d4ed8' : '#8aa3be',
                  }}>
                  {DAY_SHORT[i][0]}
                </button>
              ))}
            </div>
          </div>

          {/* Home / Away */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#5a7a9a', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Game location</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['home','🏠 Home'],['away','✈️ Away'],['both','All (incl. neutral)']].map(([val, lbl]) => (
                <button key={val} onClick={() => setHomeAway(val)}
                  style={{ padding: '7px 16px', borderRadius: 20, border: '1.5px solid', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
                    borderColor: homeAway === val ? '#2563eb' : '#d1d5db',
                    background:  homeAway === val ? '#eff6ff' : 'white',
                    color:       homeAway === val ? '#1d4ed8' : '#5a7a9a',
                  }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Time of day */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#5a7a9a', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Time of day</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['all','All times'],['day','☀️ Day (<5pm)'],['evening','🌙 Evening (≥5pm)'],['custom','Custom range']].map(([val, lbl]) => (
                <button key={val} onClick={() => setTimeFilter(val)}
                  style={{ padding: '7px 16px', borderRadius: 20, border: '1.5px solid', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
                    borderColor: timeFilter === val ? '#2563eb' : '#d1d5db',
                    background:  timeFilter === val ? '#eff6ff' : 'white',
                    color:       timeFilter === val ? '#1d4ed8' : '#5a7a9a',
                  }}>
                  {lbl}
                </button>
              ))}
            </div>
            {timeFilter === 'custom' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ color: '#5a7a9a', fontSize: 15 }}>From</span>
                <input type="number" value={timeMin} min={0} max={23} onChange={e => setTimeMin(Number(e.target.value))}
                  style={{ ...inputStyle, width: 75 }} />
                <span style={{ color: '#5a7a9a', fontSize: 15 }}>to</span>
                <input type="number" value={timeMax} min={0} max={23} onChange={e => setTimeMax(Number(e.target.value))}
                  style={{ ...inputStyle, width: 75 }} />
                <span style={{ color: '#8aa3be', fontSize: 15 }}>(24h local time)</span>
              </div>
            )}
          </div>

          {/* Preview + import */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
            <span style={{ color: '#2c4a6e', fontSize: 16, fontWeight: 600 }}>
              {filtered.length} of {games.length} games match
            </span>
            <button onClick={handleImport} disabled={filtered.length === 0}
              style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: filtered.length ? '#fd5a1e' : '#e5e7eb', color: filtered.length ? 'white' : '#8aa3be', fontSize: 17, fontWeight: 700, fontFamily: 'inherit', cursor: filtered.length ? 'pointer' : 'default', boxShadow: filtered.length ? '0 2px 8px rgba(253,90,30,0.25)' : 'none' }}>
              Import {filtered.length} Games →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const labelStyle = {
  display: 'block', color: '#2c4a6e', fontSize: 12, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
}

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1.5px solid #d1d5db', background: 'white', color: '#1a3a5c',
  fontSize: 17, fontFamily: 'inherit', outline: 'none', display: 'block',
}
