import { useEffect, useState } from 'react'
import api, { errMsg } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useCompany } from '../../context/CompanyContext'
import DesignPicker from '../../components/DesignPicker'
import { Loading, useUI } from '../../components/ui'

export default function Settings() {
  const { toast, preview } = useUI()
  const { user } = useAuth()
  const { company, refresh } = useCompany()
  const [f, setF] = useState(null)
  const [banner, setBanner] = useState(null)
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
    if (banner) fd.append('banner', banner)
    if (removeBanner) fd.append('remove_banner', '1')
    setBusy(true)
    try { await api.put('/api/admin/settings', fd); toast('Settings saved'); setBanner(null); setRemoveBanner(false); load() } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }
  const saveDesign = async () => {
    try { await api.put('/api/admin/design', { design, brand_color: color }); toast('Design changed'); refresh() } catch (err) { toast(errMsg(err), 'err') }
  }
  const shown = banner ? URL.createObjectURL(banner) : !removeBanner && f.banner_image

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
        <input type="file" accept="image/*" onChange={(e) => { setBanner(e.target.files[0] || null); setRemoveBanner(false) }} />
        {shown && (
          <div className="imgs-edit"><div className="ie">
            <img className="thumb" src={shown} alt="" style={{ width: 200, height: 90 }} onClick={() => preview(shown)} />
            <button type="button" className="rm" onClick={() => { setBanner(null); setRemoveBanner(true) }}>×</button>
          </div></div>
        )}
        <div className="mt"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
      </form>
    </>
  )
}
