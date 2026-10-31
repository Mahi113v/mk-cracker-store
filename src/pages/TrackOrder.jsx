import { useState } from 'react'
import api, { errMsg } from '../api'
import { StatusBadge, fmtDate, inr } from '../components/ui'

const STEPS = ['Enquiry placed', 'Payment verified', 'Delivered']
const idx = (s) => ({ unpaid: 0, pending_verification: 0, paid: 1, delivered: 2 }[s] ?? -1)

export default function TrackOrder() {
  const [no, setNo] = useState('')
  const [o, setO] = useState(null)
  const [error, setError] = useState('')

  const go = async (e) => {
    e.preventDefault(); setError(''); setO(null)
    try { setO((await api.get(`/api/track/${encodeURIComponent(no.trim())}`)).data) } catch (err) { setError(errMsg(err)) }
  }
  const i = o ? idx(o.status) : -1
  return (
    <div style={{ maxWidth: 560, margin: '20px auto' }}>
      <h1 className="mb">Track Order</h1>
      <form className="row mb" onSubmit={go}>
        <input className="input grow" placeholder="Enter order number, e.g. O-1001" value={no} onChange={(e) => setNo(e.target.value)} required />
        <button className="btn primary">Track</button>
      </form>
      {error && <div className="err">{error}</div>}
      {o && (
        <div className="card">
          <div className="row between"><h2>{o.order_no}</h2><StatusBadge status={o.status} /></div>
          <div className="mute">Placed on {fmtDate(o.created_at)} · {inr(o.total)}</div>
          {i >= 0 ? <div className="timeline">{STEPS.map((s, k) => <div key={s} className={`tl${k <= i ? ' done' : ''}`}><i>{k <= i ? '✓' : k + 1}</i>{s}</div>)}</div>
            : <p>This order was cancelled.</p>}
        </div>
      )}
    </div>
  )
}
