import { useRef, useState } from 'react'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon']
export const MAX_MB = 3

// Logo / icon / cover picker (platform side). Same look as FileDrop, with a fixed shape.
export default function AssetPicker({ spec, src, onPick, onRemove, onError }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const take = (file) => {
    if (!file) return
    if (!ALLOWED.includes(file.type)) return onError('Only PNG, JPG, WEBP, GIF or ICO images are allowed')
    if (file.size > MAX_MB * 1024 * 1024) return onError(`Image must be smaller than ${MAX_MB} MB`)
    onPick(file)
  }
  const open = () => inputRef.current && inputRef.current.click()
  return (
    <div className={`asset asset-${spec.shape}`}>
      <div className="asset-head"><b>{spec.label}</b><small className="mute">{spec.hint}</small></div>
      <div className={`drop${over ? ' over' : ''}${src ? ' has' : ''}`} role="button" tabIndex={0} aria-label={`Upload ${spec.label}`}
        onClick={open} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files && e.dataTransfer.files[0]) }}>
        {src ? <img src={src} alt={spec.label} /> : <div className="drop-empty"><span className="drop-plus">+</span><span>Drop or click</span></div>}
      </div>
      <input ref={inputRef} type="file" hidden accept={ALLOWED.join(',')} onChange={(e) => { take(e.target.files && e.target.files[0]); e.target.value = '' }} />
      {src && (
        <div className="asset-actions">
          <button type="button" className="btn sm" onClick={open}>Replace</button>
          <button type="button" className="btn sm danger" onClick={onRemove}>Remove</button>
        </div>
      )}
    </div>
  )
}
