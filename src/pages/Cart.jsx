import { useState } from 'react'
import { Link, useNavigate } from '../components/nav'
import api, { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { Empty, Stepper, Thumb, inr, useUI } from '../components/ui'

export default function Cart() {
  const { user } = useAuth()
  const { items, setQty, clear, total } = useCart()
  const { toast, confirm } = useUI()
  const nav = useNavigate()
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', address: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  if (!items.length) return <Empty>Your cart is empty. <Link to="/quick-buy" className="btn primary sm">Start with Quick Buy</Link></Empty>

  const place = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.post('/api/orders', { ...form, items: items.map((i) => ({ product_id: i.id, qty: i.qty, discount_percent: i.discount_percent })) })
      clear()
      toast(`Enquiry ${data.order_no} placed. Please complete the payment.`)
      nav(`/enquiries/${data.id}`)
    } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }

  return (
    <>
      <div className="row between mb">
        <h1>My Cart</h1>
        <button className="btn sm danger" onClick={async () => { if (await confirm('Remove all items from your cart?', { title: 'Clear cart?', confirm: 'Yes, clear' })) { clear(); toast('Cart cleared') } }}>🗑 Clear cart</button>
      </div>
      <div className="card flush tbl-wrap mb">
        <table className="tbl">
          <thead><tr><th>Product</th><th className="num">Price</th><th>Qty</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td><div className="row" style={{ flexWrap: 'nowrap' }}><Thumb images={[i.image]} w={44} /><div><b>{i.name}</b><div className="mute">{i.code} · {i.pack}</div></div></div></td>
                <td className="num">{inr(i.price)} <div className="strike">{inr(i.mrp)}</div><div className="off-tag">{Math.round(i.discount_percent)}% off</div></td>
                <td><Stepper value={i.qty} max={i.stock} onChange={(v) => setQty(i, v)} /></td>
                <td className="num"><b>{inr(i.price * i.qty)}</b></td>
                <td><button className="btn sm danger" onClick={() => setQty(i, 0)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan="3" className="right"><b>Total</b></td><td className="num big" style={{ fontSize: 20 }}>{inr(total)}</td><td /></tr></tfoot>
        </table>
      </div>

      <form className="card" onSubmit={place} style={{ maxWidth: 640 }}>
        <h3 className="mb">Delivery details</h3>
        <div className="grid2">
          <div className="field"><label className="f">Name</label><input className="input" required value={form.name} onChange={set('name')} /></div>
          <div className="field"><label className="f">Phone</label><input className="input" required value={form.phone} onChange={set('phone')} /></div>
        </div>
        <div className="field"><label className="f">Delivery address</label><textarea className="input" rows="3" required value={form.address} onChange={set('address')} /></div>
        <button className="btn primary" disabled={busy}>{busy ? 'Placing…' : `Place enquiry · ${inr(total)}`}</button>
        <p className="mute" style={{ marginBottom: 0 }}>After placing the enquiry you can pay by UPI QR and upload the payment screenshot.</p>
      </form>
    </>
  )
}
