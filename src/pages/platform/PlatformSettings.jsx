import { useEffect, useState } from 'react'
import api, { errMsg } from '../../api'
import AssetPicker, { MAX_MB } from '../../components/AssetPicker'
import BrandMark from '../../components/BrandMark'
import { refreshBranding, usePlatformBranding } from '../../context/PlatformContext'
import { Loading, useUI } from '../../components/ui'
import './companies.css'

const SPECS = [
  { key: 'logo', label: 'Logo', hint: 'Square PNG, 512 x 512', shape: 'logo' },
  { key: 'icon', label: 'Icon', hint: '64 x 64 PNG or ICO (browser tab icon)', shape: 'icon' },
]

export default function PlatformSettings() {
  const { toast } = useUI()
  const b = usePlatformBranding()
  const [meta, setMeta] = useState(null)
  const [f, setF] = useState(null)
  const [files, setFiles] = useState({ logo: null, icon: null })
  const [removed, setRemoved] = useState({ logo: false, icon: false })
  const [busy, setBusy] = useState(false)
  const [phone, setPhone] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => { api.get('/api/platform/meta').then((r) => setMeta(r.data)) }, [])
  useEffect(() => { if (!b.loading && !f) setF({ name: b.name, brand_color: b.brand_color }) }, [b, f])
  const [urls, setUrls] = useState({})
  useEffect(() => {
    const u = {}
    Object.entries(files).forEach(([k, file]) => { if (file) u[k] = URL.createObjectURL(file) })
    setUrls(u)
    return () => Object.values(u).forEach((x) => URL.revokeObjectURL(x))
  }, [files])
  if (!meta || !f) return <Loading />

  const srcOf = (k) => urls[k] || (!removed[k] && b[k]) || null
  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    const fd = new FormData()
    fd.append('name', f.name); fd.append('brand_color', f.brand_color)
    SPECS.forEach(({ key }) => { if (files[key]) fd.append(key, files[key]); else if (removed[key]) fd.append(`remove_${key}`, '1') })
    try {
      await api.put('/api/platform/branding', fd)
      await refreshBranding(); setFiles({ logo: null, icon: null }); setRemoved({ logo: false, icon: false }); toast('Platform settings saved')
    } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }
  const test = async () => {
    setTesting(true)
    try {
      const { data } = await api.post('/api/platform/whatsapp/test', { phone })
      toast(data.status === 'sent' ? 'Test message sent' : `Not sent: ${data.error}`, data.status === 'sent' ? 'ok' : 'warn')
    } catch (err) { toast(errMsg(err), 'err') } finally { setTesting(false) }
  }
  const wp = meta.wa_provider

  return (
    <>
      <h1 className="mb">Platform settings</h1>
      <form className="card mb" style={{ maxWidth: 860, '--brand': f.brand_color }} onSubmit={save}>
        <h3 className="mb">Branding</h3>
        <p className="mute" style={{ marginTop: 0 }}>Shown at the top of the super admin panel, on the login page and as the browser tab icon. Without a logo / icon the first letter of the name is used.</p>
        <div className="grid2">
          <div className="field"><label className="f">Platform name</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label className="f">Accent colour</label><div className="row"><input type="color" value={f.brand_color} onChange={(e) => setF({ ...f, brand_color: e.target.value })} /><span className="mute">{f.brand_color}</span></div></div>
        </div>
        <div className="asset-pair mb">
          {SPECS.map((spec) => (
            <AssetPicker key={spec.key} spec={spec} src={srcOf(spec.key)} onError={(m) => toast(m, 'err')}
              onPick={(file) => { setFiles((s) => ({ ...s, [spec.key]: file })); setRemoved((s) => ({ ...s, [spec.key]: false })) }}
              onRemove={() => { setFiles((s) => ({ ...s, [spec.key]: null })); setRemoved((s) => ({ ...s, [spec.key]: !!b[spec.key] })) }} />
          ))}
          <div className="asset"><div className="asset-head"><b>Preview</b></div><div className="row"><BrandMark name={f.name} logo={srcOf('logo')} icon={srcOf('icon')} size={52} /><b>{f.name}</b></div></div>
        </div>
        <small className="mute">PNG, JPG, WEBP, GIF or ICO, up to {MAX_MB} MB each.</small>
        <div className="mt"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
      </form>

      <div className="card" style={{ maxWidth: 860 }}>
        <h3 className="mb">WhatsApp</h3>
        <p className="mute" style={{ marginTop: 0 }}>
          Choose <b>With / Without WhatsApp</b>, the messages and the unpaid reminder time for each company in <b>Companies → Edit</b>.
          Messages are always sent in <b>Tamil + English</b> in one message.
        </p>
        <div className="row mb">
          <span>Server provider:</span><span className="badge blue">{wp.provider}</span>
          <span className={`badge ${wp.configured ? 'green' : 'amber'}`}>{wp.configured ? 'configured' : 'not configured - messages are only logged, nothing is sent'}</span>
        </div>
        {!wp.configured && <p className="mute">Set <code>WHATSAPP_PROVIDER</code> (cloud, twilio or webhook) and its keys in the server <code>.env</code> (see <code>.env.example</code>), then restart.</p>}
        <div className="row">
          <input className="input" style={{ maxWidth: 220 }} placeholder="Mobile number for a test" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="btn" onClick={test} disabled={testing || !phone}>{testing ? 'Sending…' : '📲 Send test message'}</button>
        </div>
      </div>
    </>
  )
}
