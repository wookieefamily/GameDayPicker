const MONTH_COLORS = {
  January: '#c94040', February: '#9b5fb5', March: '#3d7ebf',
  April: '#4a9e6b', May: '#3d7ebf', June: '#9b5fb5',
  July: '#e07b39', August: '#c94040', September: '#7a6a2e',
  October: '#e07b39', November: '#4a9e6b', December: '#3d7ebf',
}

export default function MonthTag({ month }) {
  const c = MONTH_COLORS[month] ?? '#888'
  return (
    <span style={{
      background: c + '22', color: c, border: `1px solid ${c}55`,
      fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
      letterSpacing: '.5px', textTransform: 'uppercase', flexShrink: 0,
    }}>{month}</span>
  )
}
