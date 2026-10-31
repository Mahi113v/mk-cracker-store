import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { Modal, calcPrice, fmtDateTime, inr } from './ui'

// Bill / invoice preview + print.  "Alter discount" is shown only for the company admin.
export default function PrintBill({ order, onClose }) {
  const { user } = useAuth()
  const { company, has } = useCompany()
  const [info, setInfo] = useState({})
  const [d, setD] = useState('')
  useEffect(() => { api.get('/api/settings').then((r) => setInfo(r.data)).catch(() => {}) }, [])

  const canAlter = user?.role === 'company_admin' && has('print')
  const altered = canAlter && d !== ''
  const pct = Math.min(100, Math.max(0, Number(d) || 0))
  const rows = order.items.map((i) => {
    const dp = altered ? pct : Number(i.discount_percent || 0)
    const rate = altered ? calcPrice(i.mrp, pct) : Number(i.price)
    return { ...i, dp, rate, amt: rate * i.qty }
  })
  const total = rows.reduce((s, r) => s + r.amt, 0)
  const mrpTotal = rows.reduce((s, r) => s + Number(r.mrp) * r.qty, 0)

  const Bill = () => (
    <div className="bill">
      <div className="bill-head">
        <div><h2>{info.store_name || company.name}</h2>{info.phone && <div>Phone: {info.phone}</div>}</div>
        <div className="right"><b>ENQUIRY / BILL</b><div>No: <b>{order.order_no}</b></div><div>{fmtDateTime(order.created_at)}</div></div>
      </div>
      <div className="bill-to"><b>{order.name}</b> · {order.phone}<br />{order.address}</div>
      <table className="bill-tbl">
        <thead><tr><th>#</th><th>Code</th><th>Item</th><th>Pack</th><th className="r">MRP</th><th className="r">Disc %</th><th className="r">Rate</th><th className="r">Qty</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}><td>{i + 1}</td><td>{r.code}</td><td>{r.name}</td><td>{r.pack}</td><td className="r">{r.mrp}</td><td className="r">{Math.round(r.dp * 100) / 100}</td><td className="r">{r.rate}</td><td className="r">{r.qty}</td><td className="r">{r.amt}</td></tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan="8" className="r">MRP value</td><td className="r">{mrpTotal}</td></tr>
          <tr><td colSpan="8" className="r">You save</td><td className="r">{mrpTotal - total}</td></tr>
          <tr className="grand"><td colSpan="8" className="r"><b>TOTAL</b></td><td className="r"><b>{inr(total)}</b></td></tr>
        </tfoot>
      </table>
      <div className="bill-foot">Thank you for your order!</div>
    </div>
  )

  return (
    <>
      <Modal wide title={`Bill · ${order.order_no}`} onClose={onClose}
        footer={<><button className="btn" onClick={onClose}>Close</button><button className="btn primary" onClick={() => window.print()}>🖨 Print</button></>}>
        {canAlter && (
          <div className="row mb discbar card">
            <b>Alter discount for this print</b>
            <input className="input" type="number" min="0" max="100" step="0.5" placeholder="%" value={d} onChange={(e) => setD(e.target.value)} style={{ width: 90 }} />
            <button className="btn sm" onClick={() => setD('')}>Original</button>
            <span className="mute">Only the printed bill changes. The saved order is not modified.</span>
          </div>
        )}
        <Bill />
      </Modal>
      {createPortal(<Bill />, document.getElementById('print-root'))}
    </>
  )
}
