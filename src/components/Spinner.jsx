export default function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white',
      animation: 'spin 0.7s linear infinite', verticalAlign: 'middle', marginRight: 6,
    }} />
  )
}
