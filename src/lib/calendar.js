// Calendar invite utilities — ICS download + Google Calendar link

function parseTimeStr(timeStr) {
  if (!timeStr) return null
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return null
  let h = parseInt(match[1])
  const m = parseInt(match[2])
  const ampm = match[3].toUpperCase()
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return { h, m }
}

const pad = n => String(n).padStart(2, '0')

function toICSDate(isoDate, timeStr, offsetHours = 0) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const t = parseTimeStr(timeStr)
  let h = (t?.h ?? 12) + offsetHours
  const m = t?.m ?? 0
  // Handle day overflow (rare but safe)
  if (h >= 24) h -= 24
  return `${year}${pad(month)}${pad(day)}T${pad(h)}${pad(m)}00`
}

export function generateICS(option, pollTitle, pollUrl) {
  if (!option.isoDate) return null
  const start   = toICSDate(option.isoDate, option.time)
  const end     = toICSDate(option.isoDate, option.time, 3)   // +3 hrs
  const summary = `${pollTitle} — ${option.name}`
  const desc    = `Your group's top pick, voted on Game Day Picker.\\n${pollUrl}`

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Game Day Picker//gamedaypicker.com//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@gamedaypicker.com`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    option.note ? `LOCATION:${option.note}` : null,
    `URL:${pollUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

export function downloadICS(option, pollTitle, pollUrl) {
  const content = generateICS(option, pollTitle, pollUrl)
  if (!content) return false
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `gameday-${option.isoDate}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

export function googleCalendarUrl(option, pollTitle, pollUrl) {
  if (!option.isoDate) return null
  const start = toICSDate(option.isoDate, option.time)
  const end   = toICSDate(option.isoDate, option.time, 3)
  const p = new URLSearchParams({
    action:  'TEMPLATE',
    text:    `${pollTitle} — ${option.name}`,
    dates:   `${start}/${end}`,
    details: `Your group's top pick, voted on Game Day Picker.\n${pollUrl}`,
    ...(option.note ? { location: option.note } : {}),
  })
  return `https://calendar.google.com/calendar/render?${p}`
}
