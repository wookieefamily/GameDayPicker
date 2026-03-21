import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link, useLocation } from 'react-router-dom'
import GamePill from '../components/GamePill.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorBar from '../components/ErrorBar.jsx'
import MonthTag from '../components/MonthTag.jsx'
import { fetchPoll, fetchVotes, pushVotes } from '../lib/api.js'
import { computeScores } from '../lib/borda.js'
import { getBrand } from '../lib/brands.js'

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
  const justCreated = location.state?.justCreated === true

  const brand    = getBrand(searchParams.get('brand'))
  const ac       = brand?.accent    ?? '#fd5a1e'
  const acText   = brand?.accentText ?? 'white'
  const acRgba   = (a) => brand ? `rgba(${brand.accentRgb},${a})` : `rgba(253,90,30,${a})`
  const pageBg   = brand?.pageBg   ?? '#f5f7fa'
  const headerBg = brand?.headerBg ?? '#ffffff'
  const brandQ   = brand ? `?brand=${searchParams.get('brand')}` : ''

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
  const available = options.filter(o => !rankedIds.has(o.id))

  const addOption    = id => setRanking(r => [...r, id])
  const removeOption = id => setRanking(r => r.filter(x => x !== id))

  const handleDragStart = i => e => { dragItem.current = i; e.dataTransfer.effectAllowed = 'move' }
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

  const handleSubmit = async () => {
    if (!ranking.length || saving) return
    setSaving(true)
    setError(null)
    try {
      const fresh = await fetchVotes(slug, group)
      const vote  = { name: voterName.trim(), ranking, timestamp: Date.now() }
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
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontFamily: 'Georgia, serif', fontSize: 16 }}>
        <Spinner /> Loading poll…
      </div>
    )
  }

  if (!loading && !poll) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 56 }}>🤔</div>
        <div style={{ color: '#111827', fontSize: 20, fontWeight: 700 }}>Poll not found</div>
        <Link to="/" style={{ color: ac, fontSize: 15 }}>← Create a new poll</Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: pageBg, fontFamily: 'Georgia, serif', paddingBottom: 64 }}>

      {/* Header */}
      <div style={{ background: headerBg, borderBottom: `3px solid ${ac}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {brand?.logo && (
            <img src={brand.logo} alt={brand.shortName} style={{ height: 44, width: 44, objectFit: 'contain', flexShrink: 0, borderRadius: 8 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: ac, fontWeight: 800, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{poll?.title}</div>
            <div style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
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
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', background: view === tab ? ac : '#f3f4f6', color: view === tab ? acText : '#374151' }}>
              {label}
            </button>
          ))}
          <button onClick={copyLink}
            style={{ padding: '8px 13px', borderRadius: 8, border: 'none', background: copied ? '#dcfce7' : '#f3f4f6', color: copied ? '#16a34a' : '#374151', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            {copied ? '✓ Copied' : '🔗 Share'}
          </button>
          <Link to={`/${brandQ}`} style={{ padding: '8px 13px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13, background: acRgba(0.1), color: ac, whiteSpace: 'nowrap' }}>+ New</Link>
          <Link to={`/poll/${slug}/admin${brandQ}`} style={{ padding: '8px 13px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13, background: '#f3f4f6', color: '#6b7280' }}>⚙</Link>
        </div>
      </div>

      <ErrorBar error={error} onDismiss={() => setError(null)} />

      {/* Share banner */}
      {justCreated && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '14px 16px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#92400e', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>🎉 Poll created! Share this link with your group:</div>
              <code style={{ color: '#b45309', fontSize: 13, wordBreak: 'break-all' }}>{pollUrl}</code>
            </div>
            <button onClick={copyLink}
              style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: copied ? '#16a34a' : ac, color: 'white', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {copied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* NAME step */}
        {view === 'vote' && step === 'name' && (
          <div style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>
              {brand?.logo
                ? <img src={brand.logo} alt="" style={{ height: 72, objectFit: 'contain', borderRadius: 10 }} />
                : sportIcon(poll?.league)
              }
            </div>
            <h2 style={{ color: '#111827', fontSize: 26, fontWeight: 800, marginBottom: 10 }}>Who's voting?</h2>
            <p style={{ color: '#4b5563', fontSize: 16, marginBottom: 28, lineHeight: 1.6 }}>Rank your favorites to help the group decide.</p>
            <input
              autoFocus value={voterName}
              onChange={e => setVoterName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && voterName.trim() && setStep('rank')}
              placeholder="Enter your name"
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #d1d5db', background: 'white', color: '#111827', fontSize: 17, fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            />
            <button onClick={() => voterName.trim() && setStep('rank')} disabled={!voterName.trim()}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: voterName.trim() ? ac : '#e5e7eb', color: voterName.trim() ? acText : '#9ca3af', fontSize: 17, fontWeight: 700, fontFamily: 'inherit', cursor: voterName.trim() ? 'pointer' : 'default', boxShadow: voterName.trim() ? '0 2px 8px rgba(253,90,30,0.25)' : 'none' }}>
              Let's Go →
            </button>
            {loading
              ? <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 18 }}><Spinner />Loading votes…</p>
              : votes.length > 0 && (
                <p style={{ color: '#6b7280', fontSize: 14, marginTop: 18, lineHeight: 1.5 }}>
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
              <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Hey {voterName}, rank your picks!</h2>
              <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.6 }}>Tap an option to add it to your ranking. Drag to reorder. Rank as many or as few as you like.</p>
            </div>
            <div className="rank-grid">
              <div>
                <div style={{ color: '#374151', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>All Options — tap to add</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 560, overflowY: 'auto' }}>
                  {available.map(o => <GamePill key={o.id} option={o} onClick={() => addOption(o.id)} />)}
                  {!available.length && <div style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', padding: 28, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb' }}>All options ranked ✓</div>}
                </div>
              </div>
              <div>
                <div style={{ color: '#16a34a', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Your Ranking — drag to reorder · tap to remove</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60, maxHeight: 560, overflowY: 'auto' }}>
                  {!ranking.length && (
                    <div style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: 28, color: '#9ca3af', fontSize: 14, textAlign: 'center', background: 'white' }}>
                      Tap options on the left to start ranking
                    </div>
                  )}
                  {ranking.map((id, i) => {
                    const o = options.find(x => x.id === id)
                    return (
                      <GamePill key={id} option={o} rank={i + 1} draggable
                        onDragStart={handleDragStart(i)} onDragOver={handleDragOver(i)}
                        onDrop={handleDrop(i)} onDragEnd={() => { dragItem.current = null }}
                        onClick={() => removeOption(id)}
                      />
                    )
                  })}
                </div>
                {ranking.length > 0 && (
                  <button onClick={handleSubmit} disabled={saving}
                    style={{ marginTop: 14, width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: saving ? '#e5e7eb' : ac, color: saving ? '#9ca3af' : acText, fontSize: 16, fontWeight: 700, fontFamily: 'inherit', cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 2px 8px rgba(253,90,30,0.25)' }}>
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
            <h2 style={{ color: '#111827', fontSize: 26, fontWeight: 800, marginBottom: 10 }}>Vote saved!</h2>
            {doneSnap.topOption && (
              <p style={{ color: '#4b5563', fontSize: 16, marginBottom: 10, lineHeight: 1.6 }}>
                Thanks {voterName}! Your top pick: <strong style={{ color: ac }}>{doneSnap.topOption.name}{doneSnap.topOption.date ? ` — ${doneSnap.topOption.date}` : ''}</strong>
              </p>
            )}
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 28 }}>
              {doneSnap.totalVoters} voter{doneSnap.totalVoters !== 1 ? 's' : ''} have voted so far.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => { setStep('name'); setVoterName(''); setRanking([]) }}
                style={{ padding: '12px 22px', borderRadius: 10, border: '1.5px solid #d1d5db', background: 'white', color: '#374151', fontFamily: 'inherit', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                Vote Again
              </button>
              <button onClick={() => { setView('results'); loadVotes() }}
                style={{ padding: '12px 22px', borderRadius: 10, border: 'none', background: ac, color: acText, fontFamily: 'inherit', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
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
                <h2 style={{ color: '#111827', fontSize: 22, fontWeight: 800 }}>Group Rankings</h2>
                <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>
                  Highest overall rank · {votes.length} voter{votes.length !== 1 ? 's' : ''}
                  {votes.length > 0 && ': ' + votes.map(v => v.name).join(', ')}
                </p>
              </div>
              <button onClick={loadVotes}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px solid #d1d5db', background: 'white', color: '#374151', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 }}>
                {loading ? <><Spinner />Refreshing…</> : '↻ Refresh'}
              </button>
            </div>

            {loading && <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}><Spinner />Loading…</div>}
            {!loading && !votes.length && (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: 48, fontSize: 16, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb' }}>No votes yet — be the first to rank! 🗳</div>
            )}
            {!loading && votes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sorted.map((o, i) => {
                  const sc    = scores[o.id]
                  const pct   = (sc / maxScore) * 100
                  const medal = ['🥇','🥈','🥉'][i] ?? null
                  return (
                    <div key={o.id} style={{ background: 'white', border: i < 3 ? `1.5px solid ${acRgba(0.35)}` : '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: i === 0 ? '0 2px 8px rgba(253,90,30,0.12)' : '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <span style={{ fontSize: 20, width: 30, textAlign: 'center', flexShrink: 0 }}>
                        {medal ?? <span style={{ color: '#9ca3af', fontSize: 14, fontWeight: 700 }}>#{i+1}</span>}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          {o.month && <MonthTag month={o.month} />}
                          {o.date && <span style={{ color: '#4b5563', fontSize: 12, fontWeight: 600 }}>{o.date}</span>}
                          {o.time && <span style={{ color: '#6b7280', fontSize: 12 }}>{o.time}</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{o.name}</div>
                        <div style={{ marginTop: 6, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: pct + '%', borderRadius: 3, background: i === 0 ? ac : i < 3 ? acRgba(0.6) : '#d1d5db', transition: 'width .6s ease' }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ color: i < 3 ? ac : '#374151', fontWeight: 800, fontSize: 20 }}>{sc}</div>
                        <div style={{ color: '#9ca3af', fontSize: 11 }}>{counts[o.id] || 0} vote{counts[o.id] !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tip jar */}
        <div style={{ textAlign: 'center', marginTop: 56, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
          <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>Game Day Picker is free — enjoy the game! 🏆</p>
          <a href="https://paypal.me/betsydaly" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 24, background: 'white', border: '1.5px solid #e5e7eb', color: '#6b7280', fontSize: 14, fontFamily: 'Georgia, serif', textDecoration: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            ☕ Send a tip
          </a>
        </div>

      </div>
    </div>
  )
}
