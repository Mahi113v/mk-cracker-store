import { useEffect, useMemo, useRef, useState } from 'react'
import { useUI } from './ui'

const isImg = (f) => f && String(f.type).startsWith('image/')
const ext = (f) => (String(f.name).split('.').pop() || 'file').slice(0, 4).toUpperCase()

// One tile (already saved image, or a newly chosen file). children = extra buttons.
export function FileTile({ src, name, tag, onRemove, onPreview, children, doc }) {
  return (
    <div className="fd-tile">
      {doc ? <div className="fd-doc"><b>{doc}</b><span>{name}</span></div>
        : <img src={src} alt="" onClick={onPreview} title="Click to preview" />}
      {tag && <span className="fd-tag">{tag}</span>}
      {onRemove && <button type="button" className="fd-x" onClick={onRemove} aria-label="Remove">×</button>}
      {children}
    </div>
  )
}

// Drag & drop / click upload box.   value = File[]   onChange(File[])
// children = tiles of images that are already saved (shown before the new files)
export default function FileDrop({
  value = [], onChange, multiple = false, max = 1, maxMb = 5, accept = 'image/*', title, hint, icon = '🖼', children, compact = false,
}) {
  const { toast, preview } = useUI()
  const inputRef = useRef()
  const [over, setOver] = useState(false)
  const urls = useMemo(() => value.map((f) => (isImg(f) ? URL.createObjectURL(f) : null)), [value])
  useEffect(() => () => urls.forEach((u) => u && URL.revokeObjectURL(u)), [urls])

  const wantsImages = accept.startsWith('image')
  const take = (list) => {
    const picked = Array.from(list || [])
    if (!picked.length) return
    const ok = []
    for (const f of picked) {
      if (wantsImages && !isImg(f)) { toast('Only image files are allowed', 'err'); continue }
      if (f.size > maxMb * 1024 * 1024) { toast(`${f.name} is larger than ${maxMb} MB`, 'err'); continue }
      ok.push(f)
    }
    if (!ok.length) return
    if (!multiple) return onChange([ok[0]])
    const next = [...value, ...ok]
    if (next.length > max) toast(`You can add up to ${max} file(s)`, 'warn')
    return onChange(next.slice(0, max))
  }
  const full = multiple && value.length >= max

  return (
    <div className={`fd${compact ? ' compact' : ''}`}>
      {!full && (
        <div
          className={`fd-zone${over ? ' over' : ''}`} role="button" tabIndex={0}
          onClick={() => inputRef.current.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current.click() } }}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files) }}
        >
          <span className="fd-ic">{icon}</span>
          <span className="fd-t"><b>{title || (multiple ? 'Drop images here or click to browse' : 'Drop a file here or click to browse')}</b>
            {hint && <small>{hint}</small>}</span>
          <span className="fd-btn">Browse</span>
        </div>
      )}
      <input ref={inputRef} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { take(e.target.files); e.target.value = '' }} />
      {(children || value.length > 0) && (
        <div className="fd-grid">
          {children}
          {value.map((f, i) => (
            <FileTile key={`${f.name}-${i}`} src={urls[i]} name={f.name} doc={isImg(f) ? null : ext(f)} tag="New"
              onPreview={() => preview(urls[i])} onRemove={() => onChange(value.filter((_, k) => k !== i))} />
          ))}
        </div>
      )}
    </div>
  )
}
