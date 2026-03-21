import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import Spinner from '../components/Spinner.jsx'
import ErrorBar from '../components/ErrorBar.jsx'
import MonthTag from '../components/MonthTag.jsx'
import { fetchPoll, fetchVotes, deleteVotes } from '../lib/api.js'
import { computeScores } from '../lib/borda.js'

export default function PollAdmin() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const group = searchParams.get('group') || 'default'

  const [poll,       setPoll]       = useState(null)
  const [votes,      setVotes]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [resetting,  setResetting]  = useState(false)
  const [error,      setError]      = useState(null)
  const [copied,     setCopied]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, v] = await Promise.all([fetchPoll(slug), fetchVotes(slug, group)])
      if (!p) { setError('Poll not found.'); return }
      setPoll(p)
      setVotes(v)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [slug, group])

  useEffect(() => { load() }, [load])

  const handleReset = async () => {
    if (!window.confirm(`Reset all votes for "${group}" group? This cannot be undone.`)) return
    setResetting(true)
    try {
      await deleteVotes(slug, group)
      setVotes([])
    } catch (e) {
      setError("Couldn't reset votes. " + e.message)
    } finally {
      setResetting(false)
    }
  }

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

  const options = poll?.options ?? []
  const { scores, counts } = computeScores(votes, options)
  const sorted   = [...options].sort((a, b) => scores[b.id] - scores[a.id])
  const maxScore = Math.max(1, scores[sorted[0]?.id] ?? 1)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0b1628 0%, #0f2040 55%, #1a0e05 100%)', fontFamily: 'Georgia, serif', paddingBottom: 56 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg, #0f1f3d, #1a1008)', borderBottom: '3px solid #fd5a1e', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ color: '#fd5a1e', fontWeight: 800, fontSize: 20 }}>⚙ Admin — {poll?.title ?? slug}</div>
          <div style={{ color: '#a0b4cc', fontSize: 12, marginTop: 2 }}>
            {group !== 'default' && (
              <span style={{ background: 'rgba(253,90,30,0.2)', color: '#fd5a1e', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{group}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/" style={{ padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13, background: 'rgba(253,90,30,0.15)', color: '#fd5a1e' }}>+ New Poll</Link>
          <Link to={`/poll/${slug}`} style={{ padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13, background: 'rgba(255,255,255,0.08)', color: '#a0b4cc' }}>← Back to Poll</Link>
        </div>
      </div>

      <ErrorBar error={error} onDismiss={() => setError(null)} />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

        {/* Share link */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 18, marginBottom: 24 }}>
          <div style={{ color: '#a0b4cc', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Share This Poll</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, background: '#0f1f3d', border: '1px solid #2a4060', borderRadius: 8, padding: '8px 12px', color: '#fd9060', fontSize: 13, overflowX: 'auto', whiteSpace: 'nowrap' }}>
              {pollUrl}
            </code>
            <button onClick={copyLink}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: copied ? '#4a9e6b' : '#fd5a1e', color: 'white', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>
          </div>
          <div style={{ color: '#5a7a9a', fontSize: 11, marginTop: 8 }}>
            Add ?group=name to create separate vote pools for different groups.
          </div>
        </div>

        {/* Stats + reset */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ color: 'white', fontSize: 20 }}>Results</h2>
            <p style={{ color: '#7a9abf', fontSize: 13, marginTop: 3 }}>
              Borda count · {votes.length} voter{votes.length !== 1 ? 's' : ''}
              {votes.length > 0 && ': ' + votes.map(v => v.name).join(', ')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #2a4060', background: 'transparent', color: '#a0b4cc', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 }}>
              {loading ? <><Spinner />Loading…</> : '↻ Refresh'}
            </button>
            <button onClick={handleReset} disabled={resetting || !votes.length}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #5a1a1a', background: 'transparent', color: '#c06060', fontSize: 12, fontFamily: 'inherit', cursor: resetting || !votes.length ? 'default' : 'pointer', fontWeight: 600, opacity: !votes.length ? 0.4 : 1 }}>
              {resetting ? 'Resetting…' : '🗑 Reset Votes'}
            </button>
          </div>
        </div>

        {loading && <div style={{ color: '#5a7a9a', textAlign: 'center', padding: 40 }}><Spinner />Loading…</div>}
        {!loading && !votes.length && (
          <div style={{ color: '#5a7a9a', textAlign: 'center', padding: 40, fontSize: 15 }}>No votes yet.</div>
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

        {/* Raw votes table */}
        {!loading && votes.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ color: '#a0b4cc', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Individual Votes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {votes.map((v, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{v.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {v.ranking.map((id, rank) => {
                      const o = options.find(x => x.id === id)
                      return (
                        <span key={id} style={{ background: '#0f1f3d', border: '1px solid #2a4060', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#a0b4cc' }}>
                          <span style={{ color: '#fd5a1e', fontWeight: 800 }}>#{rank+1}</span> {o?.name ?? id}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
