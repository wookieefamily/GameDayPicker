import MonthTag from './MonthTag.jsx'

export default function GamePill({ option, rank, onClick, draggable, onDragStart, onDragOver, onDrop, onDragEnd }) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 10,
        cursor: onClick ? 'pointer' : 'default',
        background: 'white', border: '1.5px solid #e8e2d8',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', userSelect: 'none',
      }}
    >
      {rank != null && (
        <span style={{
          minWidth: 26, height: 26, borderRadius: '50%', background: '#fd5a1e', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, flexShrink: 0,
        }}>{rank}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {option.month && <MonthTag month={option.month} />}
          <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{option.date}</span>
          {option.time && <span style={{ fontSize: 11, color: '#aaa' }}>{option.time}</span>}
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#1a3a5c', marginTop: 2 }}>
          {option.name}
        </div>
        {option.note && <div style={{ fontSize: 11, color: '#5a7a9a', marginTop: 1 }}>{option.note}</div>}
      </div>
      {onClick && rank == null && <span style={{ fontSize: 22, color: '#d1d5db', flexShrink: 0 }}>＋</span>}
      {rank != null && draggable && <span style={{ fontSize: 16, color: '#8aa3be', flexShrink: 0, cursor: 'grab' }}>⠿</span>}
    </div>
  )
}
