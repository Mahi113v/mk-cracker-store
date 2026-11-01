import { useEffect, useState } from 'react'
import api, { errMsg } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useCompany } from '../../context/CompanyContext'
import PrintBill from '../../components/PrintBill'
import { Empty, Loading, Modal, StatusBadge, Thumb, fmtDateTime, inr, useUI } from '../../components/ui'

const TABS = [['', 'All'], ['pending_verification', 'Pending verification'], ['unpaid', 'Unpaid'], ['paid', 'Paid'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']]

function OrderModal({ id, onClose, onChanged }) {
  const { toast, confirm } = useUI()
  const { can } = useAuth()
  const { has, company } = useCompany()
  const canManage = can('orders.manage')
  const [o, setO] = useState(null)
  const [note, setNote] = useState('')
  const [bill, setBill] = useState(false)
  const load = () => api.get(`/api/admin/orders/${id}`).then((r) => { setO(r.data); setNote(r.data.admin_note || '') })
  useEffect(() => { load() }, [id])

  const setStatus = async (status, confirmMsg) => {
    if (confirmMsg && !(await confirm(confirmMsg, { confirm: 'Yes', danger: status === 'cancelled' }))) return
    try { await api.put(`/api/admin/orders/${id}/status`, { status, admin_note: note }); toast('Order updated'); await load(); onChanged() } catch (e) { toast(errMsg(e), 'err') }
  }
  const [waEvent, setWaEvent] = useState('')
  const resendWa = async () => {
    try {
      const { data } = await api.post(`/api/admin/orders/${id}/whatsapp`, { event: waEvent || undefined })
      toast(data.status === 'sent' ? 'WhatsApp message sent' : data.status === 'skipped' ? `Not sent: ${data.error}` : `Failed: ${data.error}`, data.status === 'sent' ? 'ok' : 'warn')
      load()
    } catch (e) { toast(errMsg(e), 'err') }
  }
  if (!o) return <Modal title="Order" onClose={onClose}><Loading /></Modal>
  const locked = o.status === 'cancelled'
  return (
    <Modal wide title={`Order ${o.order_no}`} onClose={onClose}
      footer={has('print') ? <button className="btn" onClick={() => setBill(true)}>🖨 Print bill</button> : null}>
      <div className="row between mb">
        <div><StatusBadge status={o.status} /> <span className="mute">{fmtDateTime(o.created_at)}</span></div>
        <div className="big">{inr(o.total)}</div>
      </div>
      <div className="grid2 mb">
        <div className="card"><div className="mute">Customer</div><b>{o.user_name}</b><br />{o.user_email}<br />{o.user_phone}</div>
        <div className="card"><div className="mute">Delivery to</div><b>{o.name}</b> · {o.phone}<br />{o.address}</div>
      </div>
      <div className="card flush tbl-wrap mb"><table className="tbl">
        <thead><tr><th>Item</th><th className="num">MRP</th><th className="num">Disc %</th><th className="num">Rate</th><th className="num">Qty</th><th className="num">Amount</th></tr></thead>
        <tbody>{o.items.map((i) => (
          <tr key={i.id}><td><div className="row" style={{ flexWrap: 'nowrap' }}><Thumb images={[i.image]} w={36} /><div>{i.name}<div className="mute">{i.code} · {i.pack}</div></div></div></td>
            <td className="num">{inr(i.mrp)}</td><td className="num">{Math.round(i.discount_percent)}%</td><td className="num">{inr(i.price)}</td><td className="num">{i.qty}</td><td className="num"><b>{inr(i.amount)}</b></td></tr>
        ))}</tbody>
      </table></div>

      <div className="card mb">
        <h3 className="mb">Payment proof</h3>
        {o.payment_proof ? (
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Thumb images={[o.payment_proof]} w={120} h={120} />
            <div><div className="mute">Click the screenshot to open full size.</div>{o.payment_note && <div className="mt">Customer note: <b>{o.payment_note}</b></div>}</div>
          </div>
        ) : <span className="mute">Customer has not uploaded a screenshot yet.</span>}
      </div>

      {company.whatsapp && (
        <div className="card mb">
          <div className="row between"><h3>WhatsApp messages</h3>{canManage && (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <select className="input" style={{ width: 210 }} value={waEvent} onChange={(e) => setWaEvent(e.target.value)}>
                <option value="">Message for current status</option>
                <option value="created">Order created</option>
                <option value="pending_verification">Pending verification</option>
                <option value="paid">Paid</option>
                <option value="delivered">Delivered / track order</option>
                <option value="cancelled">Cancelled</option>
                <option value="reminder_12h">Reminder - 12 hours</option>
                <option value="reminder_1h">Reminder - 1 hour</option>
              </select>
              <button className="btn sm primary" onClick={resendWa}>📲 Send</button>
            </div>
          )}</div>
          {(o.wa_log || []).length === 0 ? <div className="mute mt">No message sent yet.</div> : (
            <div className="mt">{o.wa_log.map((w) => (
              <div key={w.id} className="row" style={{ gap: 8 }}>
                <span className={`badge ${w.status === 'sent' ? 'green' : w.status === 'failed' ? 'red' : 'grey'}`}>{w.status}</span>
                <span>{w.event.replace(/_/g, ' ')}</span><span className="mute">{fmtDateTime(w.created_at)}</span>{w.error && <span className="mute">· {w.error}</span>}
              </div>
            ))}</div>
          )}
        </div>
      )}

      {!canManage ? <p className="mute">You can view this order. You do not have access to change it.</p>
        : locked ? <p className="mute">This order is cancelled and cannot be changed. Stock was returned.</p> : (
          <>
            <div className="field"><label className="f">Note for customer (optional)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="row">
              {o.status !== 'paid' && o.status !== 'delivered' && <button className="btn primary" onClick={() => setStatus('paid', 'Mark this payment as verified and paid?')}>✓ Verify &amp; mark Paid</button>}
              {o.status === 'paid' && <button className="btn primary" onClick={() => setStatus('delivered')}>🚚 Mark Delivered</button>}
              {(o.status === 'paid' || o.status === 'delivered') && <button className="btn" onClick={() => setStatus('unpaid', 'Move back to Unpaid (payment not received)?')}>Mark as Unpaid</button>}
              {o.status === 'pending_verification' && <button className="btn" onClick={() => setStatus('unpaid')}>Reject screenshot</button>}
              <button className="btn danger" onClick={() => setStatus('cancelled', 'Cancel this order and return stock?')}>Cancel order</button>
              <button className="btn" onClick={() => setStatus(o.status)}>Save note</button>
            </div>
          </>
        )}
      {bill && <PrintBill order={o} onClose={() => setBill(false)} />}
    </Modal>
  )
}

export default function AdminOrders() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [list, setList] = useState(null)
  const [open, setOpen] = useState(null)
  const load = () => api.get('/api/admin/orders', { params: { status, search } }).then((r) => setList(r.data))
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [status, search])

  return (
    <>
      <div className="row between mb"><h1>Orders / Enquiries</h1><input className="input" style={{ width: 260 }} placeholder="Search order no, name, phone…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={`tab${status === k ? ' on' : ''}`} onClick={() => setStatus(k)}>{l}</button>)}</div>
      {!list ? <Loading /> : (
        <div className="card flush tbl-wrap"><table className="tbl">
          <thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Date</th><th className="num">Items</th><th className="num">Total</th><th>Proof</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="9"><Empty>No orders found.</Empty></td></tr>}
            {list.map((o) => (
              <tr key={o.id}>
                <td><b>{o.order_no}</b></td><td>{o.user_name}</td><td>{o.phone}</td><td className="mute">{fmtDateTime(o.created_at)}</td>
                <td className="num">{o.items_count}</td><td className="num"><b>{inr(o.total)}</b></td>
                <td>{o.payment_proof ? <Thumb images={[o.payment_proof]} w={36} /> : <span className="mute">—</span>}</td>
                <td><StatusBadge status={o.status} /></td>
                <td className="num"><button className="btn sm primary" onClick={() => setOpen(o.id)}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {open && <OrderModal id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  )
}
