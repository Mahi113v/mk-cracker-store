import { useEffect, useState } from 'react'
import api, { downloadFile, errMsg } from '../../api'
import { useCompany } from '../../context/CompanyContext'
import PrintBill from '../../components/PrintBill'
import { Empty, Loading, Modal, StatusBadge, Thumb, fmtDate, fmtDateTime, inr, useUI } from '../../components/ui'

const TABS = [['', 'All'], ['paid', 'Paid'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']]

function OldOrder({ aid, id, onClose }) {
  const { has } = useCompany()
  const [o, setO] = useState(null)
  const [bill, setBill] = useState(false)
  useEffect(() => { api.get(`/api/admin/archives/${aid}/orders/${id}`).then((r) => setO(r.data)) }, [aid, id])
  if (!o) return <Modal title="Order" onClose={onClose}><Loading /></Modal>
  return (
    <Modal wide title={`Order ${o.order_no} (old data)`} onClose={onClose} footer={has('print') ? <button className="btn" onClick={() => setBill(true)}>🖨 Print bill</button> : null}>
      <div className="row between mb"><div><StatusBadge status={o.status} /> <span className="mute">{fmtDateTime(o.created_at)}</span></div><div className="big">{inr(o.total)}</div></div>
      <div className="card mb"><b>{o.name}</b> · {o.phone}<br />{o.address}</div>
      <div className="card flush tbl-wrap"><table className="tbl">
        <thead><tr><th>Item</th><th className="num">MRP</th><th className="num">Disc %</th><th className="num">Rate</th><th className="num">Qty</th><th className="num">Amount</th></tr></thead>
        <tbody>{o.items.map((i) => (
          <tr key={i.id}><td><div className="row" style={{ flexWrap: 'nowrap' }}><Thumb images={[i.image]} w={36} /><div>{i.name}<div className="mute">{i.code} · {i.pack}</div></div></div></td>
            <td className="num">{inr(i.mrp)}</td><td className="num">{Math.round(i.discount_percent)}%</td><td className="num">{inr(i.price)}</td><td className="num">{i.qty}</td><td className="num"><b>{inr(i.amount)}</b></td></tr>
        ))}</tbody>
      </table></div>
      {bill && <PrintBill order={o} onClose={() => setBill(false)} />}
    </Modal>
  )
}

export default function Archives() {
  const { toast } = useUI()
  const [list, setList] = useState(null)
  const [sel, setSel] = useState(null)
  const [sum, setSum] = useState(null)
  const [orders, setOrders] = useState(null)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)

  useEffect(() => { api.get('/api/admin/archives').then((r) => { setList(r.data); if (r.data[0]) setSel(r.data[0].id) }) }, [])
  useEffect(() => {
    if (!sel) return
    setSum(null)
    api.get(`/api/admin/archives/${sel}/summary`).then((r) => setSum(r.data)).catch((e) => toast(errMsg(e), 'err'))
  }, [sel])
  useEffect(() => {
    if (!sel) return undefined
    const t = setTimeout(() => api.get(`/api/admin/archives/${sel}/orders`, { params: { status, search } }).then((r) => setOrders(r.data)), 250)
    return () => clearTimeout(t)
  }, [sel, status, search])

  if (!list) return <Loading />
  if (!list.length) return <><h1 className="mb">Old Data</h1><div className="card"><Empty>No old years yet. When the year ends, use <b>Settings → Year-end · Database reset</b>. The closed year will appear here.</Empty></div></>
  const cur = list.find((a) => a.id === sel)
  const max = sum ? Math.max(1, ...sum.months.map((m) => Number(m.sales))) : 1
  return (
    <>
      <div className="row between mb"><h1>Old Data</h1><span className="mute">Read-only copy of closed years</span></div>
      <div className="tabs">{list.map((a) => <button key={a.id} className={`tab${sel === a.id ? ' on' : ''}`} onClick={() => { setSel(a.id); setOrders(null); setStatus(''); setSearch('') }}>{a.label}</button>)}</div>
      {cur && (
        <div className="stats">
          <div className="stat"><span className="mute">Orders</span><b>{cur.orders_count}</b></div>
          <div className="stat g"><span className="mute">Sales (paid + delivered)</span><b>{inr(cur.sales_total)}</b></div>
          <div className="stat b"><span className="mute">Period</span><b style={{ fontSize: 16 }}>{fmtDate(cur.first_order_at)} – {fmtDate(cur.last_order_at)}</b></div>
          <div className="stat a"><span className="mute">Closed</span><b style={{ fontSize: 16 }}>{fmtDate(cur.created_at)}</b><small className="mute">by {cur.created_by || '—'}</small></div>
        </div>
      )}
      {sum && sum.months.length > 0 && (
        <div className="card mb"><h3 className="mb">Monthly sales</h3>
          <div className="mbars">{sum.months.map((m) => (
            <div key={m.month} className="mbar"><span>{m.month}</span><div className="bar"><i style={{ width: `${(Number(m.sales) / max) * 100}%` }} /></div><b>{inr(m.sales)}</b><small className="mute">{m.orders} orders</small></div>
          ))}</div>
        </div>
      )}
      <div className="row between mb">
        <div className="tabs" style={{ margin: 0 }}>{TABS.map(([k, l]) => <button key={k} className={`tab${status === k ? ' on' : ''}`} onClick={() => setStatus(k)}>{l}</button>)}</div>
        <div className="row">
          <input className="input" style={{ width: 240 }} placeholder="Search order, name, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn" onClick={() => downloadFile(`/api/admin/archives/${sel}/orders`, { format: 'xlsx', status, search }, `orders-${cur.label}.xlsx`).catch((e) => toast(errMsg(e), 'err'))}>⬇ Excel</button>
        </div>
      </div>
      {!orders ? <Loading /> : (
        <div className="card flush tbl-wrap"><table className="tbl">
          <thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Date</th><th className="num">Items</th><th className="num">Total</th><th>Status</th><th /></tr></thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan="8"><Empty>No orders found.</Empty></td></tr>}
            {orders.map((o) => (
              <tr key={o.id}><td><b>{o.order_no}</b></td><td>{o.user_name}</td><td>{o.phone}</td><td className="mute">{fmtDateTime(o.created_at)}</td>
                <td className="num">{o.items_count}</td><td className="num"><b>{inr(o.total)}</b></td><td><StatusBadge status={o.status} /></td>
                <td className="num"><button className="btn sm primary" onClick={() => setOpen(o.id)}>Open</button></td></tr>
            ))}
          </tbody>
        </table></div>
      )}
      {open && <OldOrder aid={sel} id={open} onClose={() => setOpen(null)} />}
    </>
  )
}
