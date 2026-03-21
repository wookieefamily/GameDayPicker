import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Spinner from '../components/Spinner.jsx'
import ErrorBar from '../components/ErrorBar.jsx'
import ScheduleImporter from '../components/ScheduleImporter.jsx'
import { createPoll } from '../lib/api.js'
import { slugify, monthFromIso, formatDate } from '../lib/slugify.js'
import { getBrand } from '../lib/brands.js'

const EMPTY_OPTION = () => ({ name: '', date: '', time: '', note: '' })

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const brand    = getBrand(searchParams.get('brand'))
  const ac       = brand?.accent    ?? '#fd5a1e'
  const acText   = brand?.accentText ?? 'white'
  const pageBg   = brand?.pageBg   ?? 'linear-gradient(160deg, #0b1628 0%, #0f2040 55%, #1a0e05 100%)'
  const headerBg = brand?.headerBg ?? 'linear-gradient(90deg, #0f1f3d, #1a1008)'
  const brandKey = searchParams.get('brand')
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [options, setOptions]   = useState([EMPTY_OPTION(), EMPTY_OPTION()])
  const [league, setLeague]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const updateOption = (i, field, value) =>
    setOptions(opts => opts.map((o, idx) => idx === i ? { ...o, [field]: value } : o))

  const addOption    = () => setOptions(opts => [...opts, EMPTY_OPTION()])
  const removeOption = i  => setOptions(opts => opts.filter((_, idx) => idx !== i))

  const valid = title.trim() && options.filter(o => o.name.trim()).length >= 2

  const handleCreate = async () => {
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    try {
      const validOptions = options
        .filter(o => o.name.trim())
        .map((o, i) => ({
          id: slugify(o.name) + '-' + i,
          name: o.name.trim(),
          date:  o._displayDate || (o.date ? formatDate(o.date) : ''),
          month: o._month       || (o.date ? monthFromIso(o.date) : ''),
          time:  o.time.trim(),
          note:  o.note.trim() || null,
        }))
      const { slug } = await createPoll({
        title: title.trim(),
        description: desc.trim(),
        options: validOptions,
        league: league ?? undefined,
      })
      navigate(`/poll/${slug}${brandKey ? `?brand=${brandKey}` : ''}`, { state: { justCreated: true } })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: pageBg, fontFamily: 'Georgia, serif', paddingBottom: 56 }}>
      {/* Header */}
      <div style={{ background: headerBg, borderBottom: `3px solid ${ac}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {brand?.logo && <img src={brand.logo} alt={brand.name} style={{ height: 44, width: 44, objectFit: 'contain', borderRadius: 8 }} />}
        <div>
          <div style={{ color: ac, fontWeight: 800, fontSize: 20 }}>
            {brand ? brand.name : '🏆 Game Day Picker'}
          </div>
          <div style={{ color: '#a0b4cc', fontSize: 12, marginTop: 2 }}>
            {brand ? 'Create a poll · Share with your fans' : 'Create a ranked-choice voting poll · Share the link'}
          </div>
        </div>
      </div>

      <ErrorBar error={error} onDismiss={() => setError(null)} />

      {/* Hero */}
      <div style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '32px 20px 28px', textAlign: 'center' }}>
        {/* Sport emoji banner */}
        <div style={{ fontSize: 36, letterSpacing: 8, marginBottom: 16 }}>⚾ 🏈 🏀 🏒 ⚽</div>
        <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
          Stop the group chat debate.
        </h2>
        <p style={{ color: '#7a9abf', fontSize: 15, maxWidth: 480, margin: '0 auto 24px' }}>
          Share a link, everyone ranks their picks, the best date wins.
        </p>
        {/* How it works */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', maxWidth: 640, margin: '0 auto' }}>
          {[
            { icon: '📅', title: 'Add your options', desc: 'Import any team\'s schedule or enter dates manually' },
            { icon: '🔗', title: 'Share the link', desc: 'Your crew ranks their picks in under a minute' },
            { icon: '🏆', title: 'Best date wins', desc: 'Everyone\'s preferences are tallied automatically' },
          ].map(step => (
            <div key={step.title} style={{ flex: '1 1 160px', maxWidth: 200, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 14px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{step.icon}</div>
              <div style={{ color: ac, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{step.title}</div>
              <div style={{ color: '#6a8aaa', fontSize: 12, lineHeight: 1.5 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
        <h2 style={{ color: 'white', fontSize: 20, marginBottom: 24 }}>Create a New Poll</h2>

        {/* Title */}
        <label style={labelStyle}>Poll Title *</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. McCoy Cove 2026"
          style={inputStyle}
        />

        {/* Description */}
        <label style={{ ...labelStyle, marginTop: 18 }}>Description</label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="e.g. SF Giants Day Game Planner · Oracle Park"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />

        {/* Easy option — schedule importer */}
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ background: '#4a9e6b', color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 1 }}>Easy Option</span>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Import Your Favorite Team's Schedule</span>
          </div>
          <p style={{ color: '#5a7a9a', fontSize: 12, marginBottom: 10 }}>
            Search any MLB, NFL, NBA, NHL, or college team — filter by day, time, and home/away — then import in one click.
          </p>
          <ScheduleImporter onImport={(imported, importedLeague) => {
            setLeague(importedLeague)
            setOptions(imported.map(o => ({
              name:         o.name,
              date:         o.isoDate || '',
              time:         o.time,
              note:         o.note || '',
              _displayDate: o.date,
              _month:       o.month,
            })))
          }} />
        </div>

        {/* Manual option */}
        <div style={{ marginTop: 28, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ background: '#3d7ebf', color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 1 }}>Manual Option</span>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Enter Specific Games or Dates</span>
          </div>
          <p style={{ color: '#5a7a9a', fontSize: 12, marginBottom: 12 }}>
            Type in any options you like — not just sports. Date and time are optional.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {options.map((opt, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: ac, fontWeight: 800, fontSize: 12, minWidth: 20 }}>#{i+1}</span>
                <input
                  value={opt.name}
                  onChange={e => updateOption(i, 'name', e.target.value)}
                  placeholder="Option name (e.g. vs. NY Mets)"
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                />
                {options.length > 2 && (
                  <button onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', color: '#c06060', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="date"
                  value={opt.date}
                  onChange={e => updateOption(i, 'date', e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0, flex: 1, colorScheme: 'dark' }}
                />
                <input
                  value={opt.time}
                  onChange={e => updateOption(i, 'time', e.target.value)}
                  placeholder="Time (e.g. 1:05 PM)"
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                />
                <input
                  value={opt.note}
                  onChange={e => updateOption(i, 'note', e.target.value)}
                  placeholder="Note (optional)"
                  style={{ ...inputStyle, marginBottom: 0, flex: 2 }}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addOption}
          style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 10, border: '2px dashed #2a4060', background: 'transparent', color: '#5a7a9a', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          + Add Option
        </button>

        <button
          onClick={handleCreate}
          disabled={!valid || saving}
          style={{ marginTop: 24, width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: valid && !saving ? ac : '#333', color: valid && !saving ? acText : 'white', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', cursor: valid && !saving ? 'pointer' : 'default' }}
        >
          {saving ? <><Spinner />Creating Poll…</> : 'Create Poll & Get Link →'}
        </button>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', color: '#a0b4cc', fontSize: 12, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
}

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '2px solid #2a4060', background: '#0f1f3d', color: 'white',
  fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 0,
  display: 'block',
}
