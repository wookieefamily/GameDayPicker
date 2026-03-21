import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link, useLocation } from 'react-router-dom'
import GamePill from '../components/GamePill.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorBar from '../components/ErrorBar.jsx'
import MonthTag from '../components/MonthTag.jsx'
import { fetchPoll, fetchVotes, pushVotes } from '../lib/api.js'
import { computeScores } from '../lib/borda.js'

const SPORT_ICONS = {
  mlb: '⚾', nfl: '🏈', nba: '🏀', nhl: '🏒', mls: '⚽',
  ncaaf: '🏈', ncaab: '🏀',
  wnba: '🏀', nwsl: '⚽', pwhl: '🏒', wcbb: '🏀', wncaas: '⚽',
}
const sportIcon = league => SPORT_ICONS[league] || '🏆'

export default function PollVote() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const group = searchParams.get('group') || 'default'
  const location = useLocation()
  const justCreated = location.state?.justCreated === true

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
      // Fallback for browsers that block clipboard API
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
      <div style={{ minHeight: '100vh', background: '#0b1628', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a7a9a', fontFamily: 'Georgia, serif' }}>
        <Spinner /> Loading poll…
      </div>
    )
  }

  if (!loading && !poll) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🤔</div>
        <div style={{ color: 'white', fontSize: 18 }}>Poll not found</div>
        <Link to="/" style={{ color: '#fd5a1e', fontSize: 14 }}>← Create a new poll</Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0b1628 0%, #0f2040 55%, #1a0e05 100%)', fontFamily: 'Georgia, serif', paddingBottom: 56 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg, #0f1f3d, #1a1008)', borderBottom: '3px solid #fd5a1e', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ color: '#fd5a1e', fontWeight: 800, fontSize: 20 }}>{poll?.title}</div>
          <div style={{ color: '#a0b4cc', fontSize: 12, marginTop: 2 }}>
            {poll?.description}
            {group !== 'default' && (
              <span style={{ marginLeft: 8, background: 'rgba(253,90,30,0.2)', color: '#fd5a1e', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{group}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['vote','🗳 My Vote'],['results','📊 Group Results']].map(([tab, label]) => (
            <button key={tab} onClick={() => { setView(tab); if (tab === 'results') loadVotes() }}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', background: view === tab ? '#fd5a1e' : 'rgba(255,255,255,0.08)', color: view === tab ? 'white' : '#a0b4cc' }}>
              {label}
            </button>
          ))}
          <button onClick={copyLink}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: copied ? 'rgba(74,158,107,0.3)' : 'rgba(255,255,255,0.08)', color: copied ? '#4adf80' : '#a0b4cc', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            {copied ? '✓ Copied' : '🔗 Share'}
          </button>
          <Link to={`/poll/${slug}/admin`} style={{ padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13, background: 'rgba(255,255,255,0.05)', color: '#5a7a9a' }}>⚙</Link>
        </div>
      </div>

      <ErrorBar error={error} onDismiss={() => setError(null)} />

      {/* Share banner — prominent on first creation, compact always */}
      {justCreated && (
        <div style={{ background: 'linear-gradient(90deg, rgba(74,172,255,0.15), rgba(253,90,30,0.1))', borderBottom: '1px solid rgba(74,172,255,0.3)', padding: '14px 20px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#4aacff', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>🎉 Poll created! Share this link with your group:</div>
              <code style={{ color: '#fd9060', fontSize: 13 }}>{pollUrl}</code>
            </div>
            <button onClick={copyLink}
              style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: copied ? '#4a9e6b' : '#fd5a1e', color: 'white', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {copied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* NAME step */}
        {view === 'vote' && step === 'name' && (
          <div style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{sportIcon(poll?.league)}</div>
            <h2 style={{ color: 'white', fontSize: 22, marginBottom: 8 }}>Who's voting?</h2>
            <p style={{ color: '#7a9abf', fontSize: 14, marginBottom: 24 }}>Rank your favorites to help the group decide.</p>
            <input
              autoFocus value={voterName}
              onChange={e => setVoterName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && voterName.trim() && setStep('rank')}
              placeholder="Enter your name"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '2px solid #2a4060', background: '#0f1f3d', color: 'white', fontSize: 16, fontFamily: 'inherit', outline: 'none', marginBottom: 12 }}
            />
            <button onClick={() => voterName.trim() && setStep('rank')} disabled={!voterName.trim()}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: voterName.trim() ? '#fd5a1e' : '#333', color: 'white', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', cursor: voterName.trim() ? 'pointer' : 'default' }}>
              Let's Go →
            </button>
            {loading
              ? <p style={{ color: '#3a5a7a', fontSize: 12, marginTop: 16 }}><Spinner />Loading votes…</p>
              : votes.length > 0 && (
                <p style={{ color: '#5a7a9a', fontSize: 12, marginTop: 16 }}>
                  {votes.length} voter{votes.length !== 1 ? 's' : ''}: {votes.map(v => v.name).join(', ')}
                </p>
              )
            }
          </div>
        )}

        {/* RANK step */}
        {view === 'vote' && step === 'rank' && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ color: 'white', fontSize: 18, marginBottom: 4 }}>Hey {voterName}, rank your picks!</h2>
              <p style={{ color: '#7a9abf', fontSize: 13 }}>Click an option to add it. Drag to reorder. Rank as many or as few as you like.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ color: '#fd5a1e', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>All Options — click to add</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 540, overflowY: 'auto' }}>
                  {available.map(o => <GamePill key={o.id} option={o} onClick={() => addOption(o.id)} />)}
                  {!available.length && <div style={{ color: '#5a7a9a', fontSize: 13, textAlign: 'center', padding: 24 }}>All options ranked ✓</div>}
                </div>
              </div>
              <div>
                <div style={{ color: '#4adf80', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Your Ranking — drag to reorder · click to remove</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 60, maxHeight: 540, overflowY: 'auto' }}>
                  {!ranking.length && (
                    <div style={{ border: '2px dashed #2a4060', borderRadius: 10, padding: 24, color: '#3a5070', fontSize: 13, textAlign: 'center' }}>
                      Click options on the left to start ranking
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
                    style={{ marginTop: 12, width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: saving ? '#444' : '#fd5a1e', color: 'white', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: saving ? 'default' : 'pointer' }}>
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
            <div style={{ fontSize: 56, marginBottom: 12 }}>⚓</div>
            <h2 style={{ color: 'white', fontSize: 22, marginBottom: 8 }}>Vote saved!</h2>
            {doneSnap.topOption && (
              <p style={{ color: '#7a9abf', fontSize: 14, marginBottom: 8 }}>
                Thanks {voterName}. Your top pick: <strong style={{ color: '#fd5a1e' }}>{doneSnap.topOption.name}{doneSnap.topOption.date ? ` — ${doneSnap.topOption.date}` : ''}</strong>
              </p>
            )}
            <p style={{ color: '#5a7a9a', fontSize: 13, marginBottom: 24 }}>
              {doneSnap.totalVoters} voter{doneSnap.totalVoters !== 1 ? 's' : ''} have voted so far.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => { setStep('name'); setVoterName(''); setRanking([]) }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid #2a4060', background: 'transparent', color: '#a0b4cc', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Vote Again
              </button>
              <button onClick={() => { setView('results'); loadVotes() }}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#fd5a1e', color: 'white', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
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
                <h2 style={{ color: 'white', fontSize: 20 }}>Group Rankings</h2>
                <p style={{ color: '#7a9abf', fontSize: 13, marginTop: 3 }}>
                  Borda count · {votes.length} voter{votes.length !== 1 ? 's' : ''}
                  {votes.length > 0 && ': ' + votes.map(v => v.name).join(', ')}
                </p>
              </div>
              <button onClick={loadVotes}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #2a4060', background: 'transparent', color: '#a0b4cc', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 }}>
                {loading ? <><Spinner />Refreshing…</> : '↻ Refresh'}
              </button>
            </div>

            {loading && <div style={{ color: '#5a7a9a', textAlign: 'center', padding: 40 }}><Spinner />Loading…</div>}
            {!loading && !votes.length && (
              <div style={{ color: '#5a7a9a', textAlign: 'center', padding: 40, fontSize: 15 }}>No votes yet — be the first to rank!</div>
            )}
            {!loading && votes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sorted.map((o, i) => {
                  const sc    = scores[o.id]
                  const pct   = (sc / maxScore) * 100
                  const medal = ['🥇','🥈','🥉'][i] ?? null
                  return (
                    <div key={o.id} style={{ background: i < 3 ? 'rgba(253,90,30,.08)' : 'rgba(255,255,255,.04)', border: i < 3 ? '1px solid rgba(253,90,30,.25)' : '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>
                        {medal ?? <span style={{ color: '#3a5070', fontSize: 13, fontWeight: 700 }}>#{i+1}</span>}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          {o.month && <MonthTag month={o.month} />}
                          {o.date && <span style={{ color: '#a0b4cc', fontSize: 11 }}>{o.date}</span>}
                          {o.time && <span style={{ color: '#6a8aaa', fontSize: 11 }}>{o.time}</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'white' }}>{o.name}</div>
                        <div style={{ marginTop: 5, height: 5, background: '#1a3050', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: pct + '%', borderRadius: 3, background: i === 0 ? '#fd5a1e' : i < 3 ? '#f0a060' : '#3a6090', transition: 'width .6s ease' }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ color: i < 3 ? '#fd5a1e' : '#a0b4cc', fontWeight: 800, fontSize: 18 }}>{sc}</div>
                        <div style={{ color: '#4a6a8a', fontSize: 10 }}>{counts[o.id] || 0} vote{counts[o.id] !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
