export default function ErrorBar({ error, onDismiss }) {
  if (!error) return null
  return (
    <div style={{
      background: '#4a1010', borderBottom: '1px solid #a03030',
      padding: '10px 20px', color: '#ffaaaa', fontSize: 15,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      ⚠️ {error}
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#ff8888', cursor: 'pointer', fontSize: 18 }}>✕</button>
    </div>
  )
}
