export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

// Derive month name from an ISO date string like "2026-04-05"
export function monthFromIso(iso) {
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]
  const [, , ] = iso.split('-')
  const d = new Date(iso + 'T12:00:00')
  return months[d.getMonth()]
}

// Format ISO date like "2026-04-05" -> "Sun, Apr 5"
export function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
