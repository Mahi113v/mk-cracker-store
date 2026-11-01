import { useEffect, useState } from 'react'
import { Link, useParams } from '../components/nav'
import api, { errMsg } from '../api'
import PrintBill from '../components/PrintBill'
import { useCompany } from '../context/CompanyContext'
import FileDrop, { FileTile } from '../components/FileDrop'
import { Loading, StatusBadge, Thumb, fmtDateTime, inr, useUI } from '../components/ui'

const STEPS = ['Enquiry placed', 'Payment verified', 'Delivered']
const stepIndex = (s) => ({ unpaid: 0, pending_verification: 0, paid: 1, delivered: 2 }[s] ?? -1)

export default function EnquiryDetail() {
  const { id } = useParams()
  const { toast, preview, confirm } = useUI()
  const [o, setO] = useState(null)
  const [files, setFiles] = useState([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [bill, setBill] = useState(false)
  const { has } = useCompany()

  const load = () => api.get(`/api/orders/${id}`).then((r) => setO(r.data)).catch((e) => toast(errMsg(e), 'err'))
  useEffect(() => { load() }, [id])

  if (!o) return <Loading />
  const open = o.status === 'unpaid' || o.status === 'pending_verification'
  const pay = o.payment

  const upload = async () => {
    if (!files[0]) return toast('Choose the payment screenshot first', 'err')
    const fd = new FormData()
    fd.append('screenshot', files[0])
    fd.append('note', note)
    setBusy(true)
    try {
      const { data } = await api.post(`/api/orders/${id}/payment`, fd)
      toast(data.message); setFiles([]); setNote('')
      load()
    } catch (e) { toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  const cancel = async () => {
    if (!await confirm('Cancel this enquiry?')) return
    try { await api.post(`/api/orders/${id}/cancel`); toast('Enquiry cancelled'); load() } catch (e) { toast(errMsg(e), 'err') }
  }
  const copy = () => navigator.clipboard?.writeText(pay.upi_id).then(() => toast('UPI ID copied'))
  const idx = stepIndex(o.status)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Link to="/enquiries" className="mute">← Back to enquiries</Link>
      <div className="card mt">
        <div className="row between">
          <div><div className="row"><h1>{o.order_no}</h1><StatusBadge status={o.status} /></div><div className="mute">Enquired on {fmtDateTime(o.created_at)}</div></div>
          <div className="right"><div className="mute">Total Amount</div><div className="big">{inr(o.total)}</div>{has('print') && <button className="btn sm mt" onClick={() => setBill(true)}>🖨 Print</button>}</div>
        </div>
        {idx >= 0 && (
          <div className="timeline">{STEPS.map((s, i) => <div key={s} className={`tl${i <= idx ? ' done' : ''}`}><i>{i <= idx ? '✓' : i + 1}</i>{s}</div>)}</div>
        )}
        {o.admin_note && <div className="err" style={{ background: '#fffbe8', borderColor: '#fde68a', color: '#78350f' }}>Store note: {o.admin_note}</div>}
        <div className="mute">Delivery to</div>
        <div><b>{o.name}</b> · {o.phone}<br />{o.address}</div>
      </div>

      <div className="card flush tbl-wrap mt">
        <table className="tbl">
          <thead><tr><th>Item</th><th className="num">Price</th><th className="num">Qty</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {o.items.map((i) => (
              <tr key={i.id}>
                <td><div className="row" style={{ flexWrap: 'nowrap' }}><Thumb images={[i.image]} w={40} /><div><b>{i.name}</b><div className="mute">{i.code} · {i.pack}</div></div></div></td>
                <td className="num">{inr(i.price)}</td><td className="num">{i.qty}</td><td className="num"><b>{inr(i.amount)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && pay && (
        <div className="card mt">
          <h3 className="mb">Pay for this enquiry</h3>
          <div className="pay">
            {pay.qr ? <img className="qr" src={pay.qr} alt="UPI QR" title="Click to enlarge" onClick={() => preview(pay.qr)} /> : <div className="mute">UPI not set up yet. Contact the store.</div>}
            <div className="grow">
              <div className="mute">Amount to pay</div><div className="big">{inr(o.total)}</div>
              {pay.upi_id && <div className="upi mt">UPI ID <b>{pay.upi_id}</b> <button className="btn sm" onClick={copy}>Copy</button></div>}
              <p className="mute">Scan the QR with any UPI app (Google Pay, PhonePe, Paytm, BHIM). The amount and order number are already filled in.</p>
              <p style={{ color: 'var(--amber)' }}>After paying, upload the payment screenshot below so we can verify it.</p>
            </div>
          </div>

          <h3 className="mt mb">Payment screenshot</h3>
          <div className="grid2">
            <FileDrop value={files} onChange={setFiles} icon="📸" title="Drop the payment screenshot or click to browse" hint="JPG, PNG or WEBP · up to 5 MB">
              {o.payment_proof && <FileTile src={o.payment_proof} name="Uploaded" tag="Uploaded" onPreview={() => preview(o.payment_proof)} />}
            </FileDrop>
            <div>
              <input className="input mt" placeholder="Transaction ID / note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="row mt">
                <button className="btn primary" disabled={busy} onClick={upload}>{busy ? 'Uploading…' : o.payment_proof ? 'Upload again' : 'Upload screenshot'}</button>
                {o.status === 'unpaid' && <button className="btn danger" onClick={cancel}>Cancel enquiry</button>}
              </div>
              {o.status === 'pending_verification' && <p className="mute">Screenshot received. We are verifying your payment.</p>}
            </div>
          </div>
        </div>
      )}
      {!open && o.payment_proof && (
        <div className="card mt row"><Thumb images={[o.payment_proof]} w={70} h={70} /><span className="mute">Payment screenshot (click to preview)</span></div>
      )}
      {bill && <PrintBill order={o} onClose={() => setBill(false)} />}
    </div>
  )
}
