import { useEffect, useState } from 'react'
import api, { errMsg } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useCompany } from '../../context/CompanyContext'
import DesignPicker from '../../components/DesignPicker'
import { Link } from '../../components/nav'
import FileDrop, { FileTile } from '../../components/FileDrop'
import PasswordInput from '../../components/PasswordInput'
import { Loading, Modal, fmtDate, inr, useUI } from '../../components/ui'

export default function Settings() {
  const { toast, preview } = useUI()
  const { user } = useAuth()
  const { company, refresh } = useCompany()
  const [f, setF] = useState(null)
  const [banner, setBanner] = useState([])
  const [removeBanner, setRemoveBanner] = useState(false)
  const [busy, setBusy] = useState(false)
  const [design, setDesign] = useState(company.design)
  const [color, setColor] = useState(company.brand_color)
  const load = () => api.get('/api/admin/settings').then((r) => setF(r.data))
  useEffect(() => { load() }, [])
  if (!f) return <Loading />
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    const fd = new FormData()
    ;['store_name', 'phone', 'announcement', 'upi_id', 'upi_name'].forEach((k) => fd.append(k, f[k] || ''))
    if (banner[0]) fd.append('banner', banner[0])
    if (removeBanner) fd.append('remove_banner', '1')
    setBusy(true)
    try { await api.put('/api/admin/settings', fd); toast('Settings saved'); setBanner([]); setRemoveBanner(false); load() } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }
  const saveDesign = async () => {
    try { await api.put('/api/admin/design', { design, brand_color: color }); toast('Design changed'); refresh() } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <>
      <h1 className="mb">Settings</h1>
      {user.role === 'company_admin' && (
        <div className="card mb" style={{ maxWidth: 820 }}>
          <h3 className="mb">Design</h3>
          {/* <DesignPicker value={design} onChange={setDesign} color={color} /> */}
          <div className="row mt">
            <label className="f" style={{ margin: 0 }}>Brand colour</label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            <button className="btn primary" onClick={saveDesign}>Apply design</button>
            <span className="mute">Changes the look of your store and admin panel for everyone in {company.name}.</span>
          </div>
        </div>
      )}
      <form className="card" style={{ maxWidth: 820 }} onSubmit={save}>
        <h3 className="mb">Store details</h3>
        <div className="grid2">
          <div className="field"><label className="f">Store name</label><input className="input" value={f.store_name || ''} onChange={set('store_name')} /></div>
          <div className="field"><label className="f">Contact phone</label><input className="input" value={f.phone || ''} onChange={set('phone')} /></div>
        </div>
        <div className="field"><label className="f">Top announcement bar</label><input className="input" value={f.announcement || ''} onChange={set('announcement')} /></div>

        <h3 className="mt mb">Payment (UPI)</h3>
        <div className="grid2">
          <div className="field"><label className="f">UPI ID</label><input className="input" placeholder="yourshop@okaxis" value={f.upi_id || ''} onChange={set('upi_id')} /></div>
          <div className="field"><label className="f">Payee name</label><input className="input" value={f.upi_name || ''} onChange={set('upi_name')} /></div>
        </div>
        <p className="mute" style={{ marginTop: 0 }}>The QR code on every enquiry is generated from this UPI ID with the order amount filled in.</p>

        <h3 className="mt mb">Home page banner</h3>
        <FileDrop value={banner} onChange={(f) => { setBanner(f); setRemoveBanner(false) }} icon="🎆" title="Drop the home page banner or click to browse" hint="Wide image (about 1600 × 600) · JPG, PNG or WEBP · up to 5 MB">
          {f.banner_image && !removeBanner && !banner.length && <FileTile src={f.banner_image} name="Current" tag="Current" onPreview={() => preview(f.banner_image)} onRemove={() => setRemoveBanner(true)} />}
        </FileDrop>
        <div className="mt"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
      </form>
      {user.role === 'company_admin' && <YearEnd />}
    </>
  )
}

// ---------------------------------------------------------------- YEAR-END: backup + clear orders
function YearEnd() {
  const { toast } = useUI()
  const [pv, setPv] = useState(null)
  const [list, setList] = useState([])
  const [open, setOpen] = useState(false)
  const load = () => {
    api.get('/api/admin/archives/preview').then((r) => setPv(r.data)).catch(() => {})
    api.get('/api/admin/archives').then((r) => setList(r.data)).catch(() => {})
  }
  useEffect(() => { load() }, [])
  return (
    <div className="card mt" style={{ maxWidth: 820 }}>
      <h3 className="mb">Year-end · Database reset</h3>
      <p className="mute" style={{ marginTop: 0 }}>
        Start a fresh year without losing anything. We first make a <b>full backup copy of the whole database</b>, check that every table was copied,
        and only then empty the <b>orders</b> (and order items). Products, stock, users and settings stay as they are.
        The old year stays in <Link to="/admin/archives" className="link">Old Data</Link> so you can view it any time.
      </p>
      {pv && (
        <div className="row mb">
          <span className="badge blue">{pv.orders} orders now</span>
          <span className="badge green">{inr(pv.sales)} sales</span>
          {pv.open_orders > 0 && <span className="badge amber">{pv.open_orders} unpaid / pending</span>}
        </div>
      )}
      <button className="btn danger" onClick={() => setOpen(true)} disabled={!pv || !pv.orders}>🗄 Close year &amp; reset orders…</button>
      {pv && !pv.orders && <span className="mute"> No orders to archive yet.</span>}
      {list.length > 0 && (
        <div className="mt">
          <b>Previous years</b>
          <div className="row mt">{list.map((a) => <Link key={a.id} to="/admin/archives" className="chip">{a.label} · {a.orders_count} orders · {fmtDate(a.created_at)}</Link>)}</div>
        </div>
      )}
      {open && pv && <CloseYearModal pv={pv} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />}
    </div>
  )
}

function CloseYearModal({ pv, onClose, onDone }) {
  const { toast, alert } = useUI()
  const [label, setLabel] = useState(pv.label)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const blocked = pv.open_orders > 0
  const go = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.post('/api/admin/archives/close', { label, password, confirm })
      await alert('Year closed', `Backup saved as <code>${data.db_name}</code> (${data.orders_count} orders).<br/>The orders table is empty now - a new year has started.`, 'success')
      onDone()
    } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal title="Close year & reset orders" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" form="yform" disabled={busy || blocked || confirm.trim().toUpperCase() !== 'RESET' || !password}>{busy ? 'Backing up…' : 'Backup & reset'}</button></>}>
      <form id="yform" onSubmit={go}>
        <ol className="steps">
          <li>Full copy of the database is saved as <code>{`${pv.db_name}_${label || '…'}`.replace(/-/g, '_')}</code></li>
          <li>Every table is counted and compared with the copy</li>
          <li>Only then the <b>orders</b> table is emptied ({pv.orders} orders, {inr(pv.sales)} sales)</li>
        </ol>
        {blocked && <div className="err">{pv.open_orders} order(s) are still Unpaid / Pending verification. Verify, mark paid or cancel them first.</div>}
        <div className="field"><label className="f">Label for this year</label><input className="input" required value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div className="field"><label className="f">Your admin password</label><PasswordInput required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div className="field"><label className="f">Type <b>RESET</b> to confirm</label><input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="RESET" /></div>
        <p className="mute" style={{ marginBottom: 0 }}>Customers cannot place or change orders for a minute while this runs. Uploaded images are not touched.</p>
      </form>
    </Modal>
  )
}
