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
  const pageBg   = brand?.pageBg    ?? '#f5f7fa'
  const headerBg = brand?.headerBg  ?? '#ffffff'
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
          id:      slugify(o.name) + '-' + i,
          name:    o.name.trim(),
          isoDate: o.date || '',          // YYYY-MM-DD — for calendar invites
          date:    o._displayDate || (o.date ? formatDate(o.date) : ''),
          month:   o._month       || (o.date ? monthFromIso(o.date) : ''),
          time:    o.time.trim(),
          note:    o.note.trim() || null,
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
    <div style={{ minHeight: '100vh', background: pageBg, fontFamily: 'inherit', paddingBottom: 64 }}>

      {/* Header */}
      <div style={{ background: headerBg, borderBottom: `3px solid ${ac}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        {brand?.logo
          ? <img src={brand.logo} alt={brand.name} style={{ height: 48, width: 48, objectFit: 'contain', borderRadius: 8 }} />
          : <img src="/logo.png" alt="Game Day Picker" style={{ height: 52, width: 52, objectFit: 'contain' }} />
        }
        <div>
          <div style={{ color: ac, fontWeight: 800, fontSize: 24 }}>
            {brand ? brand.name : 'Game Day Picker'}
          </div>
          <div style={{ color: '#5a7a9a', fontSize: 15, marginTop: 2 }}>
            {brand ? 'Create a poll · Share with your fans' : 'Create a ranked-choice voting poll · Share the link'}
          </div>
        </div>
      </div>

      <ErrorBar error={error} onDismiss={() => setError(null)} />

      {/* Hero */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '36px 20px 32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <img src="/logo.png" alt="Game Day Picker" style={{ height: 180, objectFit: 'contain', marginBottom: 8 }} />
        <h2 style={{ color: '#1a3a5c', fontSize: 28, fontWeight: 800, marginBottom: 10 }}>
          Less group chat. More game day.
        </h2>
        <p style={{ color: '#3a5a80', fontSize: 18, maxWidth: 500, margin: '0 auto 28px', lineHeight: 1.6 }}>
          Share a link, everyone votes on their favorite dates, and the winner is picked for you — no debates required.
        </p>
        <div className="how-cards">
          {[
            { icon: '📅', title: 'Add your options', desc: 'Import any team\'s schedule or enter dates manually' },
            { icon: '🔗', title: 'Share the link', desc: 'Your crew ranks their picks in under a minute' },
            { icon: '🏆', title: 'Best date wins', desc: 'Everyone\'s preferences are tallied automatically' },
          ].map(step => (
            <div key={step.title} className="how-card">
              <div style={{ fontSize: 30, marginBottom: 10 }}>{step.icon}</div>
              <div style={{ color: ac, fontWeight: 700, fontSize: 16, marginBottom: 5 }}>{step.title}</div>
              <div style={{ color: '#5a7a9a', fontSize: 15, lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
        <h2 style={{ color: '#1a3a5c', fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Create a New Poll</h2>

        {/* Title */}
        <label style={labelStyle}>Poll Title *</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. McCovey Cove 2026 Crew"
          style={inputStyle}
        />

        {/* Description */}
        <label style={{ ...labelStyle, marginTop: 20 }}>Description</label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="e.g. SF Giants Day Game Planner · Oracle Park"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />

        {/* Easy option */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ background: '#16a34a', color: 'white', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 1 }}>Easy Option</span>
            <span style={{ color: '#1a3a5c', fontWeight: 700, fontSize: 17 }}>Import Your Favorite Team's Schedule</span>
          </div>
          <p style={{ color: '#5a7a9a', fontSize: 16, marginBottom: 12, lineHeight: 1.5 }}>
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
        <div style={{ marginTop: 32, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ background: '#2563eb', color: 'white', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 1 }}>Manual Option</span>
            <span style={{ color: '#1a3a5c', fontWeight: 700, fontSize: 17 }}>Enter Specific Games or Dates</span>
          </div>
          <p style={{ color: '#5a7a9a', fontSize: 16, marginBottom: 14, lineHeight: 1.5 }}>
            Type in any options you like — not just sports. Date and time are optional.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {options.map((opt, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                <span style={{ color: ac, fontWeight: 800, fontSize: 16, minWidth: 24 }}>#{i+1}</span>
                <input
                  value={opt.name}
                  onChange={e => updateOption(i, 'name', e.target.value)}
                  placeholder="Option name (e.g. vs. NY Mets)"
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                />
                {options.length > 2 && (
                  <button onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}>✕</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="date"
                  value={opt.date}
                  onChange={e => updateOption(i, 'date', e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0, flex: '1 1 130px', minWidth: 130, colorScheme: 'light' }}
                />
                <input
                  value={opt.time}
                  onChange={e => updateOption(i, 'time', e.target.value)}
                  placeholder="Time (e.g. 1:05 PM)"
                  style={{ ...inputStyle, marginBottom: 0, flex: '1 1 120px' }}
                />
                <input
                  value={opt.note}
                  onChange={e => updateOption(i, 'note', e.target.value)}
                  placeholder="Note (optional)"
                  style={{ ...inputStyle, marginBottom: 0, flex: '2 1 160px' }}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addOption}
          style={{ marginTop: 12, width: '100%', padding: '12px', borderRadius: 10, border: '2px dashed #d1d5db', background: 'transparent', color: '#5a7a9a', fontSize: 17, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          + Add Option
        </button>

        <button
          onClick={handleCreate}
          disabled={!valid || saving}
          style={{ marginTop: 24, width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: valid && !saving ? ac : '#e5e7eb', color: valid && !saving ? acText : '#8aa3be', fontSize: 18, fontWeight: 700, fontFamily: 'inherit', cursor: valid && !saving ? 'pointer' : 'default', boxShadow: valid && !saving ? '0 2px 8px rgba(253,90,30,0.3)' : 'none', transition: 'all 0.2s' }}
        >
          {saving ? <><Spinner />Creating Poll…</> : 'Create Poll & Get Link →'}
        </button>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', color: '#2c4a6e', fontSize: 15, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7,
}

const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1.5px solid #d1d5db', background: 'white', color: '#1a3a5c',
  fontSize: 16, fontFamily: 'inherit', outline: 'none', marginBottom: 0,
  display: 'block', transition: 'border-color 0.15s',
}
