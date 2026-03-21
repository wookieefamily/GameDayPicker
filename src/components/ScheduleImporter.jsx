import { useState, useEffect, useMemo } from 'react'
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
      { key: 'wnba',   label: 'WNBA 🏀' },
      { key: 'nwsl',   label: 'NWSL ⚽' },
      { key: 'wcbh',   label: "Women's College Hockey 🏒" },
      { key: 'wcbb',   label: "Women's College Basketball 🏀" },
      { key: 'wncaas', label: "Women's College Soccer ⚽" },
    ],
  },
]
const ALL_LEAGUES = LEAGUE_GROUPS.flatMap(g => g.leagues)

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// Convert a UTC ISO string to a local-timezone game object for display + filtering
function parseGame(game) {
  const d        = new Date(game.utcDate)
  const dow      = d.getDay()                      // 0=Sun … 6=Sat
  const localHour = d.getHours() + d.getMinutes() / 60
  const month    = d.toLocaleDateString('en-US', { month: 'long' })
  const date     = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time     = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const isoDate  = d.toISOString().slice(0, 10)

  return { ...game, dow, localHour, month, date, time, isoDate }
}

// Build a poll option object from a parsed game
function gameToOption(g, idx) {
  const prefix = g.homeAway === 'home' ? 'vs.' : '@'
  return {
    id:      slugify(g.opponent) + '-' + idx,
    name:    `${prefix} ${g.opponent}`,
    isoDate: g.isoDate,   // "2026-04-05" — for the date input
    date:    g.date,      // "Sun, Apr 5"  — display format for poll config
    month:   g.month,
    time:    g.time,
    note:    g.venue || null,
  }
}

export default function ScheduleImporter({ onImport }) {
  const [open,        setOpen]        = useState(false)
  const [league,      setLeague]      = useState('mlb')
  const [teams,       setTeams]       = useState([])
  const [teamQuery,   setTeamQuery]   = useState('')
  const [selectedTeam,setSelectedTeam]= useState(null)
  const [season,      setSeason]      = useState(String(new Date().getFullYear()))
  const [games,       setGames]       = useState([])

  // Filters
  const [days,        setDays]        = useState(new Set(DAYS))   // all days selected
  const [homeAway,    setHomeAway]    = useState('home')           // home | away | both
  const [timeFilter,  setTimeFilter]  = useState('all')            // all | day | evening | custom
  const [timeMin,     setTimeMin]     = useState(10)               // custom: hour (10 = 10am)
  const [timeMax,     setTimeMax]     = useState(17)               // custom: hour (17 = 5pm)

  const [loadingTeams,setLoadingTeams]= useState(false)
  const [loadingGames,setLoadingGames]= useState(false)
  const [error,       setError]       = useState(null)

  // Load teams when league changes
  useEffect(() => {
    if (!open) return
    setTeams([])
    setSelectedTeam(null)
    setGames([])
    setTeamQuery('')
    setError(null)
    setLoadingTeams(true)
    fetchTeams(league)
      .then(t => setTeams(t))
      .catch(e => setError(e.message))
      .finally(() => setLoadingTeams(false))
  }, [league, open])

  const filteredTeams = useMemo(() =>
    teamQuery.trim()
      ? teams.filter(t => t.name.toLowerCase().includes(teamQuery.toLowerCase()))
      : teams,
    [teams, teamQuery]
  )

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

  // Apply filters to games
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
        style={{ width: '100%', padding: '11px', borderRadius: 10, border: '2px dashed #2a5080', background: 'transparent', color: '#4a8abf', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 6 }}
      >
        📅 Import from Team Schedule
      </button>
    )
  }

  return (
    <div style={{ background: 'rgba(10,30,60,0.6)', border: '1.5px solid #1a4070', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: '#4aacff', fontWeight: 700, fontSize: 14 }}>📅 Import from Team Schedule</span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#5a7a9a', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {/* Step 1: League */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>1. League</label>
        {LEAGUE_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 10 }}>
            <div style={{ color: '#4a6a8a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>{group.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {group.leagues.map(l => (
                <button key={l.key} onClick={() => setLeague(l.key)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: '1.5px solid', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
                    borderColor: league === l.key ? '#4aacff' : '#2a4060',
                    background:  league === l.key ? 'rgba(74,172,255,0.15)' : 'transparent',
                    color:       league === l.key ? '#4aacff' : '#6a8aaa',
                  }}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Step 2: Team search */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>2. Team</label>
        {loadingTeams
          ? <div style={{ color: '#5a7a9a', fontSize: 13 }}><Spinner />Loading teams…</div>
          : (
            <>
              <input
                value={teamQuery}
                onChange={e => { setTeamQuery(e.target.value); setSelectedTeam(null); setGames([]) }}
                placeholder={`Search ${ALL_LEAGUES.find(l=>l.key===league)?.label ?? ''} teams…`}
                style={inputStyle}
              />
              {teamQuery && !selectedTeam && (
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #2a4060', borderRadius: 8, marginTop: 4, background: '#0a1628' }}>
                  {filteredTeams.length === 0
                    ? <div style={{ padding: '10px 14px', color: '#5a7a9a', fontSize: 13 }}>No teams found</div>
                    : filteredTeams.map(t => (
                      <div key={t.id} onClick={() => { setSelectedTeam(t); setTeamQuery(t.name); setGames([]) }}
                        style={{ padding: '8px 14px', cursor: 'pointer', color: '#a0b4cc', fontSize: 13, borderBottom: '1px solid #1a3050' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#0f2040'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {t.name} <span style={{ color: '#3a5a7a', fontSize: 11 }}>{t.abbreviation}</span>
                      </div>
                    ))
                  }
                </div>
              )}
              {selectedTeam && (
                <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(74,172,255,0.1)', border: '1px solid rgba(74,172,255,0.3)', borderRadius: 8, padding: '4px 10px' }}>
                  <span style={{ color: '#4aacff', fontSize: 13, fontWeight: 700 }}>{selectedTeam.name}</span>
                  <button onClick={() => { setSelectedTeam(null); setTeamQuery(''); setGames([]) }}
                    style={{ background: 'none', border: 'none', color: '#4a6a8a', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
                </div>
              )}
            </>
          )
        }
      </div>

      {/* Step 3: Season + load */}
      {selectedTeam && (
        <div style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>3. Season</label>
            <input
              type="number" value={season} min="2020" max="2030"
              onChange={e => setSeason(e.target.value)}
              style={{ ...inputStyle, width: 120 }}
            />
          </div>
          <button onClick={loadGames} disabled={loadingGames}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: loadingGames ? '#333' : '#4aacff', color: '#0a1628', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: loadingGames ? 'default' : 'pointer', marginBottom: 1 }}>
            {loadingGames ? <><Spinner />Loading…</> : 'Load Schedule'}
          </button>
        </div>
      )}

      {error && <div style={{ color: '#ffaaaa', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

      {/* Step 4: Filters (only shown after games load) */}
      {games.length > 0 && (
        <>
          <div style={{ height: 1, background: '#1a3050', margin: '16px 0' }} />
          <label style={{ ...labelStyle, marginBottom: 12 }}>4. Filters</label>

          {/* Day of week */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: '#6a8aaa', fontSize: 11, marginBottom: 6 }}>Days of week</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {DAYS.map((day, i) => (
                <button key={day} onClick={() => toggleDay(day)}
                  style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                    borderColor: days.has(day) ? '#4aacff' : '#2a4060',
                    background:  days.has(day) ? 'rgba(74,172,255,0.2)' : 'transparent',
                    color:       days.has(day) ? '#4aacff' : '#4a6a8a',
                  }}>
                  {DAY_SHORT[i][0]}
                </button>
              ))}
            </div>
          </div>

          {/* Home / Away */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: '#6a8aaa', fontSize: 11, marginBottom: 6 }}>Game location</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['home','🏠 Home'],['away','✈️ Away'],['both','All (incl. neutral)']].map(([val, lbl]) => (
                <button key={val} onClick={() => setHomeAway(val)}
                  style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px solid', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
                    borderColor: homeAway === val ? '#4aacff' : '#2a4060',
                    background:  homeAway === val ? 'rgba(74,172,255,0.15)' : 'transparent',
                    color:       homeAway === val ? '#4aacff' : '#6a8aaa',
                  }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Time of day */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#6a8aaa', fontSize: 11, marginBottom: 6 }}>Time of day</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['all','All times'],['day','☀️ Day (<5pm)'],['evening','🌙 Evening (≥5pm)'],['custom','Custom range']].map(([val, lbl]) => (
                <button key={val} onClick={() => setTimeFilter(val)}
                  style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px solid', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
                    borderColor: timeFilter === val ? '#4aacff' : '#2a4060',
                    background:  timeFilter === val ? 'rgba(74,172,255,0.15)' : 'transparent',
                    color:       timeFilter === val ? '#4aacff' : '#6a8aaa',
                  }}>
                  {lbl}
                </button>
              ))}
            </div>
            {timeFilter === 'custom' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <span style={{ color: '#6a8aaa', fontSize: 12 }}>From</span>
                <input type="number" value={timeMin} min={0} max={23} onChange={e => setTimeMin(Number(e.target.value))}
                  style={{ ...inputStyle, width: 70 }} />
                <span style={{ color: '#6a8aaa', fontSize: 12 }}>to</span>
                <input type="number" value={timeMax} min={0} max={23} onChange={e => setTimeMax(Number(e.target.value))}
                  style={{ ...inputStyle, width: 70 }} />
                <span style={{ color: '#6a8aaa', fontSize: 12 }}>(24h local time)</span>
              </div>
            )}
          </div>

          {/* Preview count + import */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ color: '#6a8aaa', fontSize: 13 }}>
              {filtered.length} of {games.length} games match your filters
            </span>
            <button onClick={handleImport} disabled={filtered.length === 0}
              style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: filtered.length ? '#fd5a1e' : '#333', color: 'white', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: filtered.length ? 'pointer' : 'default' }}>
              Import {filtered.length} Games →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const labelStyle = {
  display: 'block', color: '#a0b4cc', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
}

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1.5px solid #2a4060', background: '#0f1f3d', color: 'white',
  fontSize: 13, fontFamily: 'inherit', outline: 'none', display: 'block',
}
