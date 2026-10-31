import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Swal from 'sweetalert2'

export { Swal }
const Ctx = createContext()
export const useUI = () => useContext(Ctx)

export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
export const imgs = (p) => (p?.images || []).map((i) => i.path)
export const calcPrice = (mrp, d) => Math.round((Number(mrp) * (100 - Number(d || 0))) / 100)

export const STATUS = {
  unpaid: ['Unpaid', 'red'],
  pending_verification: ['Pending Verification', 'amber'],
  paid: ['Paid', 'green'],
  delivered: ['Delivered', 'blue'],
  cancelled: ['Cancelled', 'grey'],
}
export const StatusBadge = ({ status }) => {
  const [label, color] = STATUS[status] || [status, 'grey']
  return <span className={`badge ${color}`}>{label}</span>
}

export function stockInfo(p) {
  if (p.stock <= 0) return { label: 'Out of stock', cls: 'red' }
  if (p.stock <= p.low_stock_level) return { label: `Only ${p.stock} left`, cls: 'amber' }
  return { label: 'In stock', cls: 'green' }
}

/* ---------- SweetAlert2 helpers: toast, confirm, ask, alert ---------- */
const brand = () => getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#e11d48'
const Toast = Swal.mixin({
  toast: true, position: 'top-end', showConfirmButton: false, timer: 3200, timerProgressBar: true,
  didOpen: (t) => { t.onmouseenter = Swal.stopTimer; t.onmouseleave = Swal.resumeTimer },
})
const toast = (msg, type = 'ok') =>
  Toast.fire({ icon: type === 'err' ? 'error' : type === 'warn' ? 'warning' : 'success', title: msg })

const confirm = async (text, o = {}) =>
  (await Swal.fire({
    title: o.title || 'Are you sure?', text, icon: o.icon || 'warning', showCancelButton: true,
    confirmButtonText: o.confirm || 'Yes, continue', cancelButtonText: 'Cancel', reverseButtons: true, focusCancel: true,
    confirmButtonColor: o.danger === false ? brand() : '#dc2626',
  })).isConfirmed

const ask = async (title, o = {}) => {
  const r = await Swal.fire({
    title, text: o.text, input: o.input || 'password', inputPlaceholder: o.placeholder || '', showCancelButton: true,
    confirmButtonColor: brand(), inputValidator: (v) => (!v ? 'Please enter a value' : undefined),
  })
  return r.isConfirmed ? r.value : null
}

const alert = (title, html, icon = 'info') => Swal.fire({ title, html, icon, confirmButtonColor: brand() })

/* ---------- Global image preview (lightbox) ---------- */
export function UIProvider({ children }) {
  const [lb, setLb] = useState(null)

  const preview = useCallback((images, index = 0) => {
    const list = (Array.isArray(images) ? images : [images]).filter(Boolean)
    if (list.length) setLb({ list, index })
  }, [])

  const open = !!lb
  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (e.key === 'Escape') setLb(null)
      if (e.key === 'ArrowRight') setLb((l) => l && { ...l, index: (l.index + 1) % l.list.length })
      if (e.key === 'ArrowLeft') setLb((l) => l && { ...l, index: (l.index - 1 + l.list.length) % l.list.length })
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  const step = (e, d) => { e.stopPropagation(); setLb((l) => ({ ...l, index: (l.index + d + l.list.length) % l.list.length })) }

  return (
    <Ctx.Provider value={{ toast, confirm, ask, alert, preview }}>
      {children}
      {lb && (
        <div className="lightbox" onClick={() => setLb(null)}>
          <button className="lb-close" onClick={() => setLb(null)} aria-label="Close">×</button>
          {lb.list.length > 1 && <button className="lb-nav prev" onClick={(e) => step(e, -1)} aria-label="Previous">‹</button>}
          <img src={lb.list[lb.index]} alt="Preview" onClick={(e) => e.stopPropagation()} />
          {lb.list.length > 1 && <button className="lb-nav next" onClick={(e) => step(e, 1)} aria-label="Next">›</button>}
          {lb.list.length > 1 && <div className="lb-count">{lb.index + 1} / {lb.list.length}</div>}
        </div>
      )}
    </Ctx.Provider>
  )
}

/* Clickable thumbnail: click opens the full-size preview */
export function Thumb({ images, w = 44, h = w, className = '', alt = '' }) {
  const { preview } = useUI()
  const list = (Array.isArray(images) ? images : [images]).filter(Boolean)
  if (!list.length) return <div className={`thumb ph ${className}`} style={{ width: w, height: h }}>🎆</div>
  return (
    <img
      className={`thumb ${className}`} src={list[0]} alt={alt} style={{ width: w, height: h }}
      title="Click to preview" onClick={(e) => { e.stopPropagation(); preview(list, 0) }}
    />
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && !document.querySelector('.swal2-container') && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className={`modal${wide ? ' wide' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-h"><h3>{title}</h3><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  )
}

export function Stepper({ value, max, onChange, disabled }) {
  const set = (v) => onChange(Math.min(max, Math.max(0, v)))
  return (
    <div className={`stepper${disabled ? ' off' : ''}`}>
      <button disabled={disabled || value <= 0} onClick={() => set(value - 1)}>−</button>
      <input type="number" min="0" max={max} value={value} disabled={disabled} onChange={(e) => set(parseInt(e.target.value, 10) || 0)} />
      <button disabled={disabled || value >= max} onClick={() => set(value + 1)}>+</button>
    </div>
  )
}

export const Empty = ({ children }) => <div className="empty">{children}</div>
export const Loading = () => <div className="empty">Loading…</div>
