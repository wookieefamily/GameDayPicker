import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Spinner from '../components/Spinner.jsx'
import ErrorBar from '../components/ErrorBar.jsx'
import ScheduleImporter from '../components/ScheduleImporter.jsx'
import { createPoll } from '../lib/api.js'
import { slugify, monthFromIso, formatDate } from '../lib/slugify.js'

const EMPTY_OPTION = () => ({ name: '', date: '', time: '', note: '' })

export default function Home() {
  const navigate = useNavigate()
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [options, setOptions]   = useState([EMPTY_OPTION(), EMPTY_OPTION()])
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
          // Imported options carry pre-computed display values; manual ones have an ISO date
          date:  o._displayDate || (o.date ? formatDate(o.date) : ''),
          month: o._month       || (o.date ? monthFromIso(o.date) : ''),
          time:  o.time.trim(),
          note:  o.note.trim() || null,
        }))
      const { slug } = await createPoll({
        title: title.trim(),
        description: desc.trim(),
        options: validOptions,
      })
      navigate(`/poll/${slug}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0b1628 0%, #0f2040 55%, #1a0e05 100%)', fontFamily: 'Georgia, serif', paddingBottom: 56 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg, #0f1f3d, #1a1008)', borderBottom: '3px solid #fd5a1e', padding: '16px 20px' }}>
        <div style={{ color: '#fd5a1e', fontWeight: 800, fontSize: 20 }}>🗳 Poll Builder</div>
        <div style={{ color: '#a0b4cc', fontSize: 12, marginTop: 2 }}>Create a ranked-choice voting poll · Share the link</div>
      </div>

      <ErrorBar error={error} onDismiss={() => setError(null)} />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
        <h2 style={{ color: 'white', fontSize: 20, marginBottom: 6 }}>Create a New Poll</h2>
        <p style={{ color: '#7a9abf', fontSize: 13, marginBottom: 28 }}>
          Participants will rank your options using Borda count voting. Each poll gets its own shareable URL.
        </p>

        {/* Title */}
        <label style={{ display: 'block', color: '#a0b4cc', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Poll Title *
        </label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. McCoy Cove 2026"
          style={inputStyle}
        />

        {/* Description */}
        <label style={{ display: 'block', color: '#a0b4cc', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 18 }}>
          Description
        </label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="e.g. SF Giants Day Game Planner · Oracle Park"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />

        {/* Schedule importer */}
        <div style={{ marginTop: 24 }}>
          <ScheduleImporter onImport={imported => setOptions(imported.map(o => ({
            name:         o.name,
            date:         o.isoDate || '',   // populates the date input
            time:         o.time,
            note:         o.note || '',
            _displayDate: o.date,            // pre-formatted display date for poll config
            _month:       o.month,
          })))} />
        </div>

        {/* Options */}
        <div style={{ marginTop: 8, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ color: '#a0b4cc', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            Options * (min 2)
          </label>
          <span style={{ color: '#5a7a9a', fontSize: 11 }}>Date and time are optional</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {options.map((opt, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: '#fd5a1e', fontWeight: 800, fontSize: 12, minWidth: 20 }}>#{i+1}</span>
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
          style={{ marginTop: 24, width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: valid && !saving ? '#fd5a1e' : '#333', color: 'white', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', cursor: valid && !saving ? 'pointer' : 'default' }}
        >
          {saving ? <><Spinner />Creating Poll…</> : 'Create Poll & Get Link →'}
        </button>

        <p style={{ color: '#3a5a7a', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
          Poll config stored in Netlify Blobs · Votes stored in JSONBin
        </p>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '2px solid #2a4060', background: '#0f1f3d', color: 'white',
  fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 0,
  display: 'block',
}
