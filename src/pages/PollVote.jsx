import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link, useLocation } from 'react-router-dom'
import GamePill from '../components/GamePill.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorBar from '../components/ErrorBar.jsx'
import MonthTag from '../components/MonthTag.jsx'
import { fetchPoll, fetchVotes, pushVotes } from '../lib/api.js'
import { computeScores } from '../lib/borda.js'
import { getBrand } from '../lib/brands.js'
import { downloadICS, googleCalendarUrl } from '../lib/calendar.js'
import { fanaticsUrl, teamLogoUrl, LEAGUE_EMOJI, LEAGUE_LABEL } from '../lib/fanatics.js'

function WinnerCard({ winner, pollTitle, pollUrl, ac, acText }) {
  const gcUrl = googleCalendarUrl(winner, pollTitle, pollUrl)
  return (
    <div style={{ marginTop: 28, background: 'linear-gradient(135deg, #fff7ed, #fef3c7)', border: '2px solid #fed7aa', borderRadius: 16, padding: '20px 22px' }}>
      <div style={{ fontWeight: 800, fontSize: 19, color: '#9a3412', marginBottom: 4 }}>
        🏆 Your group picked it — now make it official!
      </div>
      <div style={{ color: '#c2410c', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
        {winner.name}{winner.date ? ` · ${winner.date}` : ''}{winner.time ? ` · ${winner.time}` : ''}
      </div>
      {winner.note && <div style={{ color: '#9a3412', fontSize: 14, marginBottom: 14 }}>📍 {winner.note}</div>}
      {!winner.note && <div style={{ marginBottom: 14 }} />}
      <div style={{ fontSize: 15, color: '#7c2d12', marginBottom: 14 }}>
        Add the game to your calendar and share it with your crew:
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => downloadICS(winner, pollTitle, pollUrl)}
          style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: ac, color: acText, fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
          📅 Download .ics
        </button>
        {gcUrl && (
          <a href={gcUrl} target="_blank" rel="noopener noreferrer"
            style={{ padding: '11px 20px', borderRadius: 10, border: '2px solid #ea580c', background: 'white', color: '#ea580c', fontWeight: 700, fontSize: 15, textDecoration: 'none', display: 'inline-block' }}>
            📅 Google Calendar
          </a>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 13, color: '#9a3412', opacity: 0.7 }}>
        Works with Apple Calendar, Google Calendar, Outlook, and more.
      </div>
    </div>
  )
}

const SPORT_ICONS = {
  mlb: '⚾', nfl: '🏈', nba: '🏀', nhl: '🏒', mls: '⚽',
  ncaaf: '🏈', ncaab: '🏀',
  wnba: '🏀', nwsl: '⚽', pwhl: '🏒', wcbb: '🏀',
}
const sportIcon = league => SPORT_ICONS[league] || '🏆'

export default function PollVote() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const group = searchParams.get('group') || 'default'
  const location = useLocation()
  const justCreated  = location.state?.justCreated === true
  // Admin token: from creation state (fresh) or localStorage (returning organizer)
  const adminToken   = location.state?.adminToken ?? localStorage.getItem(`gdp:admin:${slug}`) ?? null

  const brand    = getBrand(searchParams.get('brand'))
  const ac       = brand?.accent    ?? '#fd5a1e'
  const acText   = brand?.accentText ?? 'white'
  const acRgba   = (a) => brand ? `rgba(${brand.accentRgb},${a})` : `rgba(253,90,30,${a})`
  const pageBg   = brand?.pageBg   ?? '#f5f7fa'
  const headerBg = brand?.headerBg ?? '#ffffff'
  const brandQ   = brand ? `?brand=${searchParams.get('brand')}` : ''

  // adminUrl must be computed AFTER brandQ is defined
  const adminUrl = adminToken ? `/poll/${slug}/admin?token=${adminToken}${brandQ ? '&' + brandQ.slice(1) : ''}` : null

  const [poll,       setPoll]       = useState(null)
  const [view,       setView]       = useState('vote')
  const [step,       setStep]       = useState('name')
  const [voterName,  setVoterName]  = useState('')
  const [ranking,    setRanking]    = useState([])
  const [votes,      setVotes]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)
  const [doneSnap,   setDoneSnap]   = useState(null)
  const [copied,     setCopied]     = useState(false)
  const [cantGo,     setCantGo]     = useState(new Set())
  const [timeLeft,   setTimeLeft]   = useState(null)  // null | { d,h,m,s,diff } | 'closed'

  // Live countdown ticker
  useEffect(() => {
    if (!poll?.deadline) return
    const tick = () => {
      const diff = new Date(poll.deadline) - Date.now()
      if (diff <= 0) { setTimeLeft('closed'); return }
      setTimeLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        diff,
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [poll?.deadline])

  const votingClosed = timeLeft === 'closed'

  const pollUrl = `${window.location.origin}/poll/${slug}`
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pollUrl)
    } catch {
      const el = document.createElement('textarea')
      el.value = pollUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dragItem = useRef(null)
  const dragOver = useRef(null)

  const loadVotes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const v = await fetchVotes(slug, group)
      setVotes(v)
    } catch (e) {
      setError("Couldn't load votes. " + e.message)
    } finally {
      setLoading(false)
    }
  }, [slug, group])

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const [p, v] = await Promise.all([fetchPoll(slug), fetchVotes(slug, group)])
        if (!p) { setError('Poll not found.'); setLoading(false); return }
        setPoll(p)
        setVotes(v)
        document.title = `${p.title} — Game Day Picker`
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [slug, group])

  const options   = poll?.options ?? []
  const rankedIds = new Set(ranking)
  const available = options.filter(o => !rankedIds.has(o.id) && !cantGo.has(o.id))

  const addOption    = id => setRanking(r => [...r, id])
  const removeOption = id => setRanking(r => r.filter(x => x !== id))

  const toggleCantGo = id => {
    setCantGo(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    // Also remove from ranking if it was ranked
    setRanking(r => r.filter(x => x !== id))
  }

  const handleDragStart = i => e => {
    dragItem.current = i
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(i)) // required for Chrome
  }
  const handleDragOver  = i => e => { e.preventDefault(); dragOver.current = i }
  const handleDrop      = i => e => {
    e.preventDefault()
    if (dragItem.current == null || dragItem.current === i) return
    setRanking(r => {
      const n = [...r], [m] = n.splice(dragItem.current, 1)
      n.splice(dragOver.current, 0, m)
      return n
    })
    dragItem.current = dragOver.current = null
  }

  const moveRanking = (i, dir) => {
    setRanking(r => {
      const n = [...r], j = i + dir
      if (j < 0 || j >= n.length) return r
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
  }

  const handleSubmit = async () => {
    if (!ranking.length || saving) return
    setSaving(true)
    setError(null)
    try {
      const fresh = await fetchVotes(slug, group)
      const vote  = { name: voterName.trim(), ranking, cantGo: [...cantGo], timestamp: Date.now() }
      const idx   = fresh.findIndex(v => v.name.toLowerCase() === vote.name.toLowerCase())
      const updated = idx >= 0 ? fresh.map((v, i) => i === idx ? vote : v) : [...fresh, vote]
      await pushVotes(slug, group, updated)
      setVotes(updated)
      setDoneSnap({ topOption: options.find(o => o.id === ranking[0]) ?? null, totalVoters: updated.length })
      setStep('done')
    } catch (e) {
      setError("Couldn't save your vote. " + e.message)
    } finally {
      setSaving(false)
    }
  }

  const { scores, counts } = computeScores(votes, options)
  const sorted   = [...options].sort((a, b) => scores[b.id] - scores[a.id])
  const maxScore = Math.max(1, scores[sorted[0]?.id] ?? 1)

  if (loading && !poll) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7a9a', fontFamily: 'inherit', fontSize: 18 }}>
        <Spinner /> Loading poll…
      </div>
    )
  }

  if (!loading && !poll) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 56 }}>🤔</div>
        <div style={{ color: '#1a3a5c', fontSize: 22, fontWeight: 700 }}>Poll not found</div>
        <Link to="/" style={{ color: ac, fontSize: 17 }}>← Create a new poll</Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: pageBg, fontFamily: 'inherit', paddingBottom: 64 }}>

      {/* Header */}
      <div style={{ background: headerBg, borderBottom: `3px solid ${ac}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {brand?.logo
            ? <img src={brand.logo} alt={brand.shortName} style={{ height: 48, width: 48, objectFit: 'contain', flexShrink: 0, borderRadius: 8 }} />
            : <img src="/logo.png" alt="Game Day Picker" style={{ height: 52, width: 52, objectFit: 'contain', flexShrink: 0 }} />
          }
          <div style={{ minWidth: 0 }}>
            <div style={{ color: ac, fontWeight: 800, fontSize: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{poll?.title}</div>
            <div style={{ color: '#5a7a9a', fontSize: 15, marginTop: 2 }}>
              {brand ? brand.name : poll?.description}
              {!brand && group !== 'default' && (
                <span style={{ marginLeft: 8, background: acRgba(0.12), color: ac, padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{group}</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['vote','🗳 Vote'],['results','📊 Results']].map(([tab, label]) => (
            <button key={tab} onClick={() => { setView(tab); if (tab === 'results') loadVotes() }}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, fontFamily: 'inherit', background: view === tab ? ac : '#f3f4f6', color: view === tab ? acText : '#2c4a6e' }}>
              {label}
            </button>
          ))}
          <button onClick={copyLink}
            style={{ padding: '8px 13px', borderRadius: 8, border: 'none', background: copied ? '#dcfce7' : '#f3f4f6', color: copied ? '#16a34a' : '#2c4a6e', fontWeight: 700, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' }}>
            {copied ? '✓ Copied' : '🔗 Share'}
          </button>
          <Link to={`/${brandQ}`} style={{ padding: '8px 13px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 15, background: acRgba(0.1), color: ac, whiteSpace: 'nowrap' }}>+ New</Link>
          {adminUrl && <Link to={adminUrl} style={{ padding: '8px 13px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 15, background: acRgba(0.1), color: ac, whiteSpace: 'nowrap' }}>⚙ Admin</Link>}
        </div>
      </div>

      <ErrorBar error={error} onDismiss={() => setError(null)} />

      {/* Share banner */}
      {justCreated && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '20px 16px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Voter share link */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#92400e', fontWeight: 800, fontSize: 17, marginBottom: 4 }}>🎉 Poll created! Share this link with your group:</div>
                <code style={{ color: '#b45309', fontSize: 14, wordBreak: 'break-all' }}>{pollUrl}</code>
              </div>
              <button onClick={copyLink}
                style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: copied ? '#16a34a' : ac, color: 'white', fontWeight: 800, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {copied ? '✓ Copied!' : '🔗 Share Link'}
              </button>
            </div>

            {/* Admin link — save this! */}
            {adminUrl && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #fde68a' }}>
                <div style={{ background: 'white', border: '2px solid #f59e0b', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 8px rgba(245,158,11,0.15)' }}>
                  <div style={{ color: '#92400e', fontWeight: 800, fontSize: 15, marginBottom: 8, lineHeight: 1.5 }}>
                    🔐 Your organizer link — bookmark this, for your eyes only! This is where you'll be able to review detailed results, confirm/change the "winner", reset the poll and refresh results:
                  </div>
                  <code style={{ display: 'block', color: '#78350f', fontSize: 12, wordBreak: 'break-all', background: '#fffbeb', padding: '8px 12px', borderRadius: 8, marginBottom: 12, lineHeight: 1.6 }}>
                    {window.location.origin}{adminUrl}
                  </code>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}${adminUrl}`).catch(()=>{})}
                      style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#f59e0b', color: '#78350f', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                      📋 Copy Organizer Link
                    </button>
                    <Link to={adminUrl}
                      style={{ padding: '9px 18px', borderRadius: 9, background: '#92400e', color: 'white', textDecoration: 'none', fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', display: 'inline-block' }}>
                      Go to Admin →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Countdown banner */}
      {timeLeft && (() => {
        const closed = timeLeft === 'closed'
        const urgent = !closed && timeLeft.diff < 3600000   // < 1 hour
        const soon   = !closed && timeLeft.diff < 86400000  // < 24 hours
        const bg     = closed ? '#fef2f2' : urgent ? '#fff7ed' : soon ? '#fffbeb' : '#f0fdf4'
        const border = closed ? '#fca5a5' : urgent ? '#fed7aa' : soon ? '#fde68a' : '#86efac'
        const color  = closed ? '#dc2626' : urgent ? '#c2410c' : soon ? '#92400e' : '#15803d'
        const icon   = closed ? '🔒' : urgent ? '🚨' : soon ? '⏰' : '⏳'
        const label  = closed
          ? 'Voting is closed'
          : `${timeLeft.d > 0 ? `${timeLeft.d}d ` : ''}${timeLeft.h}h ${timeLeft.m}m ${timeLeft.s}s remaining`
        return (
          <div style={{ background: bg, borderBottom: `1px solid ${border}`, padding: '10px 16px', textAlign: 'center' }}>
            <span style={{ color, fontWeight: 700, fontSize: 15 }}>
              {icon} {closed ? 'Voting is closed — results are final.' : `Voting closes in ${label}`}
            </span>
          </div>
        )
      })()}

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* NAME step */}
        {view === 'vote' && step === 'name' && (
          <div style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
            <div style={{ marginBottom: 14 }}>
              {brand?.logo
                ? <img src={brand.logo} alt="" style={{ height: 80, objectFit: 'contain', borderRadius: 10 }} />
                : poll?.league
                  ? <div style={{ fontSize: 56 }}>{sportIcon(poll.league)}</div>
                  : <img src="/logo.png" alt="Game Day Picker" style={{ height: 90, objectFit: 'contain' }} />
              }
            </div>
            {votingClosed
              ? <><div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                  <h2 style={{ color: '#dc2626', fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Voting is closed</h2>
                  <p style={{ color: '#5a7a9a', fontSize: 17, lineHeight: 1.6 }}>The organizer has closed this poll. Check the results tab to see how the group voted.</p></>
              : <><h2 style={{ color: '#1a3a5c', fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Who's voting?</h2>
                  <p style={{ color: '#3a5a80', fontSize: 18, marginBottom: 28, lineHeight: 1.6 }}>Rank your favorites to help the group decide.</p>
                  <input
                    autoFocus value={voterName}
                    onChange={e => setVoterName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && voterName.trim() && setStep('rank')}
                    placeholder="Enter your name"
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #d1d5db', background: 'white', color: '#1a3a5c', fontSize: 18, fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  />
                  <button onClick={() => voterName.trim() && setStep('rank')} disabled={!voterName.trim()}
                    style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: voterName.trim() ? ac : '#e5e7eb', color: voterName.trim() ? acText : '#8aa3be', fontSize: 18, fontWeight: 700, fontFamily: 'inherit', cursor: voterName.trim() ? 'pointer' : 'default', boxShadow: voterName.trim() ? '0 2px 8px rgba(253,90,30,0.25)' : 'none' }}>
                    Let's Go →
                  </button></>
            }
            {loading
              ? <p style={{ color: '#8aa3be', fontSize: 15, marginTop: 18 }}><Spinner />Loading votes…</p>
              : votes.length > 0 && (
                <p style={{ color: '#5a7a9a', fontSize: 16, marginTop: 18, lineHeight: 1.5 }}>
                  {votes.length} voter{votes.length !== 1 ? 's' : ''} so far: {votes.map(v => v.name).join(', ')}
                </p>
              )
            }
          </div>
        )}

        {/* RANK step */}
        {view === 'vote' && step === 'rank' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ color: '#1a3a5c', fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Hey {voterName}, rank your picks!</h2>
              <p style={{ color: '#3a5a80', fontSize: 16, lineHeight: 1.6 }}>Tap an option to add it to your ranking. Drag to reorder. Rank as many or as few as you like.</p>
            </div>
            <div className="rank-grid">
              <div>
                <div style={{ color: '#2c4a6e', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>All Options — tap to add</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 560, overflowY: 'auto' }}>
                  {available.map(o => (
                    <div key={o.id} style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                      <div style={{ flex: 1 }}>
                        <GamePill option={o} onClick={() => addOption(o.id)} />
                      </div>
                      <button
                        onClick={() => toggleCantGo(o.id)}
                        title="Can't make this one"
                        style={{ padding: '0 12px', borderRadius: 10, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>
                        🚫
                      </button>
                    </div>
                  ))}
                  {!available.length && <div style={{ color: '#5a7a9a', fontSize: 16, textAlign: 'center', padding: 28, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb' }}>All options ranked ✓</div>}
                  {cantGo.size > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                      <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Can't Make These</div>
                      {[...cantGo].map(id => {
                        const o = options.find(x => x.id === id)
                        return (
                          <div key={id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, opacity: 0.6 }}>
                            <div style={{ flex: 1, fontSize: 13, color: '#dc2626', fontWeight: 600, padding: '6px 10px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5' }}>
                              🚫 {o?.name}
                            </div>
                            <button onClick={() => toggleCantGo(id)} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#5a7a9a', fontSize: 11, cursor: 'pointer' }}>undo</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div style={{ color: '#16a34a', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Your Ranking — use ↑↓ to reorder · tap to remove</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60, maxHeight: 560, overflowY: 'auto' }}>
                  {!ranking.length && (
                    <div style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: 28, color: '#8aa3be', fontSize: 16, textAlign: 'center', background: 'white' }}>
                      Tap options on the left to start ranking
                    </div>
                  )}
                  {ranking.map((id, i) => {
                    const o = options.find(x => x.id === id)
                    return (
                      <div key={id} style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                        <div style={{ flex: 1 }}>
                          <GamePill option={o} rank={i + 1} draggable
                            onDragStart={handleDragStart(i)} onDragOver={handleDragOver(i)}
                            onDrop={handleDrop(i)} onDragEnd={() => { dragItem.current = null }}
                            onClick={() => removeOption(id)}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <button onClick={() => moveRanking(i, -1)} disabled={i === 0}
                            style={{ flex: 1, padding: '0 10px', borderRadius: 8, border: '1.5px solid #d1d5db', background: i === 0 ? '#f9fafb' : 'white', color: i === 0 ? '#d1d5db' : '#2c4a6e', cursor: i === 0 ? 'default' : 'pointer', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
                            ↑
                          </button>
                          <button onClick={() => moveRanking(i, 1)} disabled={i === ranking.length - 1}
                            style={{ flex: 1, padding: '0 10px', borderRadius: 8, border: '1.5px solid #d1d5db', background: i === ranking.length - 1 ? '#f9fafb' : 'white', color: i === ranking.length - 1 ? '#d1d5db' : '#2c4a6e', cursor: i === ranking.length - 1 ? 'default' : 'pointer', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
                            ↓
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {ranking.length > 0 && (
                  votingClosed
                    ? <div style={{ marginTop: 14, padding: '14px', borderRadius: 12, background: '#fef2f2', border: '1.5px solid #fca5a5', color: '#dc2626', fontWeight: 700, fontSize: 16, textAlign: 'center' }}>🔒 Voting is closed — submissions no longer accepted</div>
                    : <button onClick={handleSubmit} disabled={saving}
                        style={{ marginTop: 14, width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: saving ? '#e5e7eb' : ac, color: saving ? '#8aa3be' : acText, fontSize: 18, fontWeight: 700, fontFamily: 'inherit', cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 2px 8px rgba(253,90,30,0.25)' }}>
                        {saving ? <><Spinner />Saving…</> : `Submit My ${ranking.length} Pick${ranking.length !== 1 ? 's' : ''} →`}
                      </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DONE step */}
        {view === 'vote' && step === 'done' && doneSnap && (
          <div style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <h2 style={{ color: '#1a3a5c', fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Vote saved!</h2>
            {doneSnap.topOption && (
              <p style={{ color: '#3a5a80', fontSize: 18, marginBottom: 10, lineHeight: 1.6 }}>
                Thanks {voterName}! Your top pick: <strong style={{ color: ac }}>{doneSnap.topOption.name}{doneSnap.topOption.date ? ` — ${doneSnap.topOption.date}` : ''}</strong>
              </p>
            )}
            <p style={{ color: '#5a7a9a', fontSize: 16, marginBottom: 28 }}>
              {doneSnap.totalVoters} voter{doneSnap.totalVoters !== 1 ? 's' : ''} have voted so far.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => { setStep('name'); setVoterName(''); setRanking([]) }}
                style={{ padding: '12px 22px', borderRadius: 10, border: '1.5px solid #d1d5db', background: 'white', color: '#2c4a6e', fontFamily: 'inherit', fontWeight: 600, fontSize: 17, cursor: 'pointer' }}>
                Vote Again
              </button>
              <button onClick={() => { setView('results'); loadVotes() }}
                style={{ padding: '12px 22px', borderRadius: 10, border: 'none', background: ac, color: acText, fontFamily: 'inherit', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>
                See Results →
              </button>
            </div>
          </div>
        )}

        {/* RESULTS view */}
        {view === 'results' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ color: '#1a3a5c', fontSize: 24, fontWeight: 800 }}>Group Rankings</h2>
                <p style={{ color: '#5a7a9a', fontSize: 16, marginTop: 4, lineHeight: 1.5 }}>
                  Highest overall rank · {votes.length} voter{votes.length !== 1 ? 's' : ''}
                  {votes.length > 0 && ': ' + votes.map(v => v.name).join(', ')}
                </p>
              </div>
              <button onClick={loadVotes}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px solid #d1d5db', background: 'white', color: '#2c4a6e', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 }}>
                {loading ? <><Spinner />Refreshing…</> : '↻ Refresh'}
              </button>
            </div>

            {loading && <div style={{ color: '#5a7a9a', textAlign: 'center', padding: 40 }}><Spinner />Loading…</div>}
            {!loading && !votes.length && (
              <div style={{ color: '#5a7a9a', textAlign: 'center', padding: 48, fontSize: 18, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb' }}>No votes yet — be the first to rank! 🗳</div>
            )}
            {!loading && votes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sorted.map((o, i) => {
                  const sc       = scores[o.id]
                  const pct      = (sc / maxScore) * 100
                  const medal    = ['🥇','🥈','🥉'][i] ?? null
                  const isWinner = poll?.winner === o.id
                  return (
                    <div key={o.id} style={{ background: isWinner ? '#f0fdf4' : 'white', border: isWinner ? '2px solid #16a34a' : i < 3 ? `1.5px solid ${acRgba(0.35)}` : '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: isWinner ? '0 2px 8px rgba(22,163,74,0.15)' : i === 0 ? '0 2px 8px rgba(253,90,30,0.12)' : '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <span style={{ fontSize: 22, width: 30, textAlign: 'center', flexShrink: 0 }}>
                        {isWinner ? '👑' : (medal ?? <span style={{ color: '#8aa3be', fontSize: 16, fontWeight: 700 }}>#{i+1}</span>)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          {o.month && <MonthTag month={o.month} />}
                          {o.date && <span style={{ color: '#3a5a80', fontSize: 12, fontWeight: 600 }}>{o.date}</span>}
                          {o.time && <span style={{ color: '#5a7a9a', fontSize: 12 }}>{o.time}</span>}
                          {isWinner && <span style={{ background: '#16a34a', color: 'white', fontSize: 10, fontWeight: 800, padding: '1px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>Organizer's Pick</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 17, color: '#1a3a5c' }}>{o.name}</div>
                        <div style={{ marginTop: 6, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: pct + '%', borderRadius: 3, background: isWinner ? '#16a34a' : i === 0 ? ac : i < 3 ? acRgba(0.6) : '#d1d5db', transition: 'width .6s ease' }} />
                        </div>
                        {(() => {
                          const who = votes.filter(v => v.ranking.includes(o.id))
                            .map(v => `${v.name} #${v.ranking.indexOf(o.id) + 1}`)
                          return who.length > 0 ? (
                            <div style={{ marginTop: 5, fontSize: 11, color: '#8aa3be', lineHeight: 1.5 }}>
                              {who.join(' · ')}
                            </div>
                          ) : null
                        })()}
                        {(() => {
                          const cantGoNames = votes.filter(v => v.cantGo?.includes(o.id)).map(v => v.name)
                          return cantGoNames.length > 0 ? (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                              🚫 Can't go: {cantGoNames.join(', ')}
                            </div>
                          ) : null
                        })()}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ color: isWinner ? '#16a34a' : i < 3 ? ac : '#2c4a6e', fontWeight: 800, fontSize: 22 }}>{sc}</div>
                        <div style={{ color: '#8aa3be', fontSize: 11 }}>{counts[o.id] || 0} vote{counts[o.id] !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Fanatics affiliate card */}
        {(view === 'results' || view === 'vote') && !loading && poll?.teamName && poll?.league && (() => {
          const affUrl = fanaticsUrl(poll.league, poll.teamName)
          if (!affUrl) return null
          const emoji = LEAGUE_EMOJI[poll.league] ?? '🏆'
          const logoUrl = teamLogoUrl(poll.league, poll.teamAbbrev)
          return (
            <div style={{ marginTop: 20, background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              {logoUrl && (
                <img src={logoUrl} alt={poll.teamName} style={{ width: 52, height: 52, objectFit: 'contain', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#1a3a5c', marginBottom: 3 }}>
                  {!logoUrl && `${emoji} `}Gear up for game day
                </div>
                <div style={{ color: '#5a7a9a', fontSize: 14 }}>
                  Shop {poll.teamName} gear on Fanatics
                </div>
              </div>
              <a
                href={affUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                style={{ padding: '10px 20px', borderRadius: 10, background: '#cc0000', color: 'white', fontWeight: 700, fontSize: 15, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 2px 6px rgba(204,0,0,0.25)' }}>
                Shop {poll.teamName} →
              </a>
              <div style={{ width: '100%', fontSize: 11, color: '#c0c0c0' }}>Sponsored · Fanatics affiliate link</div>
            </div>
          )
        })()}

        {/* Make it Official */}
        {view === 'results' && !loading && votes.length > 0 && (() => { const fw = poll?.winner ? options.find(o => o.id === poll.winner) : sorted[0]; return fw?.isoDate })() && (
          (() => {
            const featuredWinner = (poll?.winner ? options.find(o => o.id === poll?.winner) : sorted[0]) ?? sorted[0]
            return <WinnerCard winner={featuredWinner} pollTitle={poll?.title} pollUrl={pollUrl} ac={ac} acText={acText} />
          })()
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 56, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
          <p style={{ color: '#8aa3be', fontSize: 15 }}>Game Day Picker is free — enjoy the game! 🏆</p>
        </div>

      </div>
    </div>
  )
}
