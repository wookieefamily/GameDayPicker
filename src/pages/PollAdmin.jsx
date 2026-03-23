import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import Spinner from '../components/Spinner.jsx'
import ErrorBar from '../components/ErrorBar.jsx'
import MonthTag from '../components/MonthTag.jsx'
import { fetchPoll, fetchVotes, deleteVotes, updatePoll } from '../lib/api.js'
import { computeScores } from '../lib/borda.js'
import { getBrand } from '../lib/brands.js'
import { downloadICS, googleCalendarUrl } from '../lib/calendar.js'

export default function PollAdmin() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const group = searchParams.get('group') || 'default'

  const token    = searchParams.get('token')  // secret admin token
  const brand    = getBrand(searchParams.get('brand'))
  const ac       = brand?.accent    ?? '#fd5a1e'
  const acText   = brand?.accentText ?? 'white'
  const acRgba   = (a) => brand ? `rgba(${brand.accentRgb},${a})` : `rgba(253,90,30,${a})`
  const pageBg   = brand?.pageBg   ?? '#f5f7fa'
  const headerBg = brand?.headerBg ?? '#ffffff'
  const brandQ   = brand ? `?brand=${searchParams.get('brand')}` : ''
  const tokenQ   = token ? `token=${token}` : ''
  const adminQ   = [brandQ.replace('?',''), tokenQ].filter(Boolean).join('&')
  const fullAdminQ = adminQ ? `?${adminQ}` : ''

  const [poll,       setPoll]       = useState(null)
  const [votes,      setVotes]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [resetting,  setResetting]  = useState(false)
  const [error,      setError]      = useState(null)
  const [copied,     setCopied]     = useState(false)
  const [settingWinner, setSettingWinner] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, v] = await Promise.all([fetchPoll(slug), fetchVotes(slug, group)])
      if (!p) { setError('Poll not found.'); return }
      setPoll(p)
      setVotes(v)
      document.title = `Admin: ${p.title} — Game Day Picker`
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

  const handleSetWinner = async (optionId) => {
    setSettingWinner(true)
    try {
      const newWinner = poll.winner === optionId ? null : optionId  // toggle off if already set
      await updatePoll(slug, { winner: newWinner }, token)
      setPoll(p => ({ ...p, winner: newWinner }))
    } catch (e) {
      setError("Couldn't set winner. " + e.message)
    } finally {
      setSettingWinner(false)
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

  // Token validation — only enforce if poll has an adminToken (new polls have one; old polls don't)
  const unauthorized = !loading && poll && poll.adminToken && poll.adminToken !== token
  if (unauthorized) {
    return (
      <div style={{ minHeight: '100vh', background: pageBg, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: '#1a3a5c', fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Admin access required</h2>
        <p style={{ color: '#5a7a9a', fontSize: 16, textAlign: 'center', maxWidth: 380, marginBottom: 24, lineHeight: 1.6 }}>
          This admin page is only accessible via the private link shown when the poll was created.
        </p>
        <Link to={`/poll/${slug}${brandQ}`} style={{ padding: '12px 24px', borderRadius: 10, background: ac, color: acText, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
          ← Back to Poll
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: pageBg, fontFamily: 'inherit', paddingBottom: 64 }}>

      {/* Header */}
      <div style={{ background: headerBg, borderBottom: `3px solid ${ac}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {brand?.logo
            ? <img src={brand.logo} alt={brand.shortName} style={{ height: 48, width: 48, objectFit: 'contain', flexShrink: 0, borderRadius: 8 }} />
            : <img src="/logo.png" alt="Game Day Picker" style={{ height: 52, width: 52, objectFit: 'contain', flexShrink: 0 }} />
          }
          <div>
            <div style={{ color: ac, fontWeight: 800, fontSize: 20 }}>⚙ Admin — {poll?.title ?? slug}</div>
            <div style={{ color: '#5a7a9a', fontSize: 15, marginTop: 2 }}>
              {group !== 'default' && (
                <span style={{ background: acRgba(0.12), color: ac, padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{group}</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/${brandQ}`} style={{ padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 15, background: acRgba(0.1), color: ac }}>+ New Poll</Link>
          <Link to={`/poll/${slug}${brandQ}`} style={{ padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 15, background: '#f3f4f6', color: '#2c4a6e' }}>← Back to Poll</Link>
          {token && (
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/poll/${slug}/admin${fullAdminQ}`).catch(()=>{}) }} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 15, background: acRgba(0.15), color: ac, cursor: 'pointer', fontFamily: 'inherit' }}>📋 Copy Admin Link</button>
          )}
        </div>
      </div>

      <ErrorBar error={error} onDismiss={() => setError(null)} />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

        {/* Share link */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#2c4a6e', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Share This Poll</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', color: '#2c4a6e', fontSize: 15, overflowX: 'auto', whiteSpace: 'nowrap', minWidth: 0 }}>
              {pollUrl}
            </code>
            <button onClick={copyLink}
              style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: copied ? '#16a34a' : ac, color: 'white', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>
          </div>
          <div style={{ color: '#8aa3be', fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
            Add ?group=name to create separate vote pools for different groups.
            {brand && <span> Add ?brand={searchParams.get('brand')} to show team branding.</span>}
          </div>
        </div>

        {/* Stats + reset */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ color: '#1a3a5c', fontSize: 24, fontWeight: 800 }}>Results</h2>
            <p style={{ color: '#5a7a9a', fontSize: 16, marginTop: 4, lineHeight: 1.5 }}>
              Highest overall rank · {votes.length} voter{votes.length !== 1 ? 's' : ''}
              {votes.length > 0 && ': ' + votes.map(v => v.name).join(', ')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load}
              style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px solid #d1d5db', background: 'white', color: '#2c4a6e', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 }}>
              {loading ? <><Spinner />Loading…</> : '↻ Refresh'}
            </button>
            <button onClick={handleReset} disabled={resetting || !votes.length}
              style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px solid #fca5a5', background: 'white', color: '#dc2626', fontSize: 15, fontFamily: 'inherit', cursor: resetting || !votes.length ? 'default' : 'pointer', fontWeight: 600, opacity: !votes.length ? 0.4 : 1 }}>
              {resetting ? 'Resetting…' : '🗑 Reset Votes'}
            </button>
          </div>
        </div>

        {loading && <div style={{ color: '#5a7a9a', textAlign: 'center', padding: 48 }}><Spinner />Loading…</div>}
        {!loading && !votes.length && (
          <div style={{ color: '#5a7a9a', textAlign: 'center', padding: 48, fontSize: 18, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb' }}>No votes yet.</div>
        )}
        {!loading && votes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sorted.map((o, i) => {
  const sc         = scores[o.id]
  const pct        = (sc / maxScore) * 100
  const medal      = ['🥇','🥈','🥉'][i] ?? null
  const isWinner   = poll?.winner === o.id
  const cantGoList = votes.filter(v => v.cantGo?.includes(o.id)).map(v => v.name)
  const rankedBy   = votes.filter(v => v.ranking.includes(o.id))
                          .map(v => `${v.name} #${v.ranking.indexOf(o.id) + 1}`)
  return (
    <div key={o.id} style={{ background: isWinner ? '#f0fdf4' : 'white', border: isWinner ? '2px solid #16a34a' : i < 3 ? `1.5px solid ${acRgba(0.35)}` : '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, boxShadow: isWinner ? '0 2px 8px rgba(22,163,74,0.15)' : i === 0 ? '0 2px 8px rgba(253,90,30,0.1)' : '0 1px 3px rgba(0,0,0,0.04)' }}>
      <span style={{ fontSize: 20, width: 30, textAlign: 'center', flexShrink: 0, paddingTop: 2 }}>
        {isWinner ? '👑' : (medal ?? <span style={{ color: '#8aa3be', fontSize: 14, fontWeight: 700 }}>#{i+1}</span>)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          {o.month && <MonthTag month={o.month} />}
          {o.date && <span style={{ color: '#3a5a80', fontSize: 12, fontWeight: 600 }}>{o.date}</span>}
          {isWinner && <span style={{ background: '#16a34a', color: 'white', fontSize: 10, fontWeight: 800, padding: '1px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>Organizer's Pick</span>}
        </div>
        <div style={{ fontWeight: 700, fontSize: 17, color: '#1a3a5c' }}>{o.name}</div>
        <div style={{ marginTop: 6, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', borderRadius: 3, background: isWinner ? '#16a34a' : i === 0 ? ac : i < 3 ? acRgba(0.6) : '#d1d5db', transition: 'width .6s ease' }} />
        </div>
        {rankedBy.length > 0 && (
          <div style={{ marginTop: 5, fontSize: 11, color: '#8aa3be', lineHeight: 1.5 }}>
            {rankedBy.join(' · ')}
          </div>
        )}
        {cantGoList.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
            🚫 Can't go: {cantGoList.join(', ')}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: isWinner ? '#16a34a' : i < 3 ? ac : '#2c4a6e', fontWeight: 800, fontSize: 22 }}>{sc}</div>
        <div style={{ color: '#8aa3be', fontSize: 11, marginBottom: 8 }}>{counts[o.id] || 0} vote{counts[o.id] !== 1 ? 's' : ''}</div>
        <button
          onClick={() => handleSetWinner(o.id)}
          disabled={settingWinner}
          style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${isWinner ? '#16a34a' : '#d1d5db'}`, background: isWinner ? '#16a34a' : 'white', color: isWinner ? 'white' : '#5a7a9a', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          {isWinner ? '✓ Winner' : 'Set Winner'}
        </button>
      </div>
    </div>
  )
})}
          </div>
        )}

        {/* Make it Official */}
        {!loading && votes.length > 0 && (poll?.winner ? options.find(o => o.id === poll.winner) : sorted[0])?.isoDate && (
          (() => {
            const featuredOption = (poll?.winner ? options.find(o => o.id === poll.winner) : sorted[0]) ?? sorted[0]
            return (
              <div style={{ marginTop: 28, background: 'linear-gradient(135deg, #fff7ed, #fef3c7)', border: '2px solid #fed7aa', borderRadius: 16, padding: '20px 22px' }}>
                <div style={{ fontWeight: 800, fontSize: 19, color: '#9a3412', marginBottom: 4 }}>
                  🏆 Your group picked it — now make it official!
                </div>
                <div style={{ color: '#c2410c', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  {featuredOption.name}{featuredOption.date ? ` · ${featuredOption.date}` : ''}{featuredOption.time ? ` · ${featuredOption.time}` : ''}
                </div>
                {featuredOption.note && <div style={{ color: '#9a3412', fontSize: 14, marginBottom: 14 }}>📍 {featuredOption.note}</div>}
                {!featuredOption.note && <div style={{ marginBottom: 14 }} />}
                <div style={{ fontSize: 15, color: '#7c2d12', marginBottom: 14 }}>
                  Add the game to your calendar and share it with your crew:
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => downloadICS(featuredOption, poll?.title, pollUrl)}
                    style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: ac, color: acText, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                    📅 Download .ics
                  </button>
                  {googleCalendarUrl(featuredOption, poll?.title, pollUrl) && (
                    <a href={googleCalendarUrl(featuredOption, poll?.title, pollUrl)} target="_blank" rel="noopener noreferrer"
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
          })()
        )}

        {/* Individual votes */}
        {!loading && votes.length > 0 && (
          <div style={{ marginTop: 36 }}>
            <div style={{ color: '#2c4a6e', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Individual Votes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {votes.map((v, i) => (
                <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ color: '#1a3a5c', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{v.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {v.ranking.map((id, rank) => {
                      const o = options.find(x => x.id === id)
                      return (
                        <span key={id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#2c4a6e' }}>
                          <span style={{ color: ac, fontWeight: 800 }}>#{rank+1}</span> {o?.name ?? id}
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
