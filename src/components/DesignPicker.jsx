export const DESIGNS = [
  ['default', 'Default', 'Plain and simple. Fast, clean, works for every project.'],
  ['normal', 'Normal', 'Better looking: rounded cards, soft shadows, gradient banner.'],
  ['current', 'Current', 'Latest trend: glass navbar, gradients, pill buttons, smooth hover effects.'],
]

export default function DesignPicker({ value, onChange, color }) {
  return (
    <div className="dpicker">
      {DESIGNS.map(([k, t, d]) => (
        <button type="button" key={k} className={`dp${value === k ? ' on' : ''}`} onClick={() => onChange(k)}>
          <div className={`dp-prev ${k}`} style={{ '--c': color || '#e11d48' }}><i className="n" /><i className="h" /><span><i /><i /><i /></span></div>
          <b>{t}</b><small>{d}</small>
        </button>
      ))}
    </div>
  )
}
