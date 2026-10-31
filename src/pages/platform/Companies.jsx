import { useEffect, useRef, useState } from 'react'
import api, { errMsg, tokenKey } from '../../api'
import DesignPicker from '../../components/DesignPicker'
import { Empty, Loading, Modal, fmtDate, useUI } from '../../components/ui'
import './companies.css'

const FEATURE_LABEL = {
  reports: 'Sales & stock reports', pricelist: 'Price list Excel / PDF download', import: 'Upload Excel / PDF quantities',
  quick_discount: 'Quick Buy discount change', print: 'Bill print + discount alter',
}
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
const dbSlug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36)
const initial = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?'

// ---- brand images (stored as a path like /uploads/companies/xxxx.png in the companies table) ----
const MAX_MB = 3
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon']
const ASSETS = [
  { key: 'image', label: 'Cover image', hint: '1600 x 900 wide banner', shape: 'banner' },
  { key: 'logo', label: 'Logo', hint: 'Square PNG, 512 x 512', shape: 'logo' },
  { key: 'icon', label: 'Icon', hint: '64 x 64 PNG or ICO', shape: 'icon' },
]

function useObjectUrl(file) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file) { setUrl(null); return undefined }
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return url
}

function AssetPicker({ spec, src, onPick, onRemove, onError }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)

  const take = (file) => {
    if (!file) return
    if (!ALLOWED.includes(file.type)) return onError('Only PNG, JPG, WEBP, GIF or ICO images are allowed')
    if (file.size > MAX_MB * 1024 * 1024) return onError(`Image must be smaller than ${MAX_MB} MB`)
    onPick(file)
  }
  const open = () => inputRef.current && inputRef.current.click()

  return (
    <div className={`asset asset-${spec.shape}`}>
      <div className="asset-head"><b>{spec.label}</b><small className="mute">{spec.hint}</small></div>
      <div
        className={`drop${over ? ' over' : ''}${src ? ' has' : ''}`}
        role="button" tabIndex={0} aria-label={`Upload ${spec.label}`}
        onClick={open}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files && e.dataTransfer.files[0]) }}
      >
        {src
          ? <img src={src} alt={spec.label} />
          : <div className="drop-empty"><span className="drop-plus">+</span><span>Drop or click</span></div>}
      </div>
      <input ref={inputRef} type="file" hidden accept={ALLOWED.join(',')}
        onChange={(e) => { take(e.target.files && e.target.files[0]); e.target.value = '' }} />
      {src && (
        <div className="asset-actions">
          <button type="button" className="btn sm" onClick={open}>Replace</button>
          <button type="button" className="btn sm danger" onClick={onRemove}>Remove</button>
        </div>
      )}
    </div>
  )
}

function BrandPreview({ name, color, image, logo, icon }) {
  return (
    <div className="bp">
      <div className="bp-tab">
        <span className="bp-ico">{icon ? <img src={icon} alt="" /> : <i style={{ background: color }} />}</span>
        <span className="bp-title">{name || 'Company name'}</span>
      </div>
      <div className="bp-cover" style={image ? { backgroundImage: `url("${image}")` } : { background: `linear-gradient(135deg, ${color}, ${color}88)` }} />
      <div className="bp-body">
        <div className="bp-logo">{logo ? <img src={logo} alt="" /> : <b style={{ background: color }}>{initial(name)}</b>}</div>
        <div className="bp-text">
          <div className="bp-name">{name || 'Company name'}</div>
          <div className="bp-sub">Live preview</div>
        </div>
      </div>
    </div>
  )
}

function CompanyForm({ company, meta, onClose, onSaved }) {
  const { toast } = useUI()
  const editing = !!company
  const [f, setF] = useState({
    name: company?.name || '', code: company?.code || '', db_name: company?.db_name || '', design: company?.design || 'normal',
    brand_color: company?.brand_color || '#e11d48', features: company?.features || meta.features, status: company?.status || 'active',
    admin_name: '', admin_email: '', admin_phone: '', admin_password: '',
  })
  const [touched, setTouched] = useState({ code: false, db: false })
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState({ image: null, logo: null, icon: null })
  const [removed, setRemoved] = useState({ image: false, logo: false, icon: false })
  const urls = { image: useObjectUrl(files.image), logo: useObjectUrl(files.logo), icon: useObjectUrl(files.icon) }

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const onName = (e) => {
    const name = e.target.value
    const n = { ...f, name }
    if (!editing && !touched.code) n.code = slug(name)
    if (!editing && !touched.db) n.db_name = dbSlug(name)
    setF(n)
  }
  const toggle = (k) => setF({ ...f, features: f.features.includes(k) ? f.features.filter((x) => x !== k) : [...f.features, k] })

  const srcOf = (k) => urls[k] || (!removed[k] && company && company[k]) || null
  const pick = (k) => (file) => { setFiles((s) => ({ ...s, [k]: file })); setRemoved((s) => ({ ...s, [k]: false })) }
  const clear = (k) => () => { setFiles((s) => ({ ...s, [k]: null })); setRemoved((s) => ({ ...s, [k]: !!(company && company[k]) })) }
  const hasAssetChange = ASSETS.some(({ key }) => files[key] || removed[key])

  const uploadAssets = async (id) => {
    const fd = new FormData()
    ASSETS.forEach(({ key }) => {
      if (files[key]) fd.append(key, files[key])
      else if (removed[key]) fd.append(`remove_${key}`, '1')
    })
    await api.put(`/api/platform/companies/${id}/assets`, fd)
  }

  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      let id = company && company.id
      let msg
      if (editing) {
        await api.put(`/api/platform/companies/${company.id}`, { name: f.name, design: f.design, brand_color: f.brand_color, features: f.features, status: f.status })
        msg = 'Company updated'
      } else {
        const { data } = await api.post('/api/platform/companies', {
          name: f.name, code: f.code, db_name: f.db_name, design: f.design, brand_color: f.brand_color, features: f.features,
          admin: { name: f.admin_name, email: f.admin_email, phone: f.admin_phone, password: f.admin_password },
        })
        id = (data && (data.id || (data.company && data.company.id))) || null
        if (!id && hasAssetChange) {
          const list = (await api.get('/api/platform/companies')).data
          const found = list.find((c) => c.code === f.code)
          id = found ? found.id : null
        }
        msg = `Database "${f.db_name}" created with all tables`
      }
      if (hasAssetChange && id) {
        try { await uploadAssets(id) } catch (err) { toast(`Saved, but image upload failed: ${errMsg(err)}`, 'err'); onSaved(); return }
      }
      toast(msg)
      onSaved()
    } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }

  const pickerProps = (spec) => ({
    spec, src: srcOf(spec.key), onPick: pick(spec.key), onRemove: clear(spec.key), onError: (m) => toast(m, 'err'),
  })

  return (
    <Modal wide title={editing ? `Edit ${company.name}` : 'Create new company'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="cform" disabled={busy}>{busy ? (editing ? 'Saving…' : 'Creating database…') : editing ? 'Save changes' : 'Create company & database'}</button></>}>
      <form id="cform" onSubmit={save} style={{ '--brand': f.brand_color }}>
        <div className="grid2">
          <div className="field"><label className="f">Company name *</label><input className="input" required value={f.name} onChange={onName} /></div>
          <div className="field"><label className="f">Company code (store URL) *</label>
            <input className="input" required disabled={editing} value={f.code} onChange={(e) => { setTouched({ ...touched, code: true }); set('code')(e) }} placeholder="mk" />
            {!editing && <small className="mute">Store link: /{f.code || 'code'}</small>}</div>
        </div>
        <div className="field"><label className="f">Database name *</label>
          <input className="input" required disabled={editing} value={f.db_name} onChange={(e) => { setTouched({ ...touched, db: true }); set('db_name')(e) }} placeholder="mk_crackers" />
          <small className="mute">{editing ? 'The database cannot be changed after creation.' : 'Only the name is needed. The database and all required tables are created automatically, and only this company will use it.'}</small></div>

        <label className="f">Design</label>
        <DesignPicker value={f.design} onChange={(design) => setF({ ...f, design })} color={f.brand_color} />
        <div className="row mt mb"><label className="f" style={{ margin: 0 }}>Brand colour</label><input type="color" value={f.brand_color} onChange={set('brand_color')} /><span className="mute">{f.brand_color}</span></div>

        <label className="f">Brand images</label>
        <div className="brand-grid">
          <div className="assets">
            <AssetPicker {...pickerProps(ASSETS[0])} />
            <div className="asset-pair">
              <AssetPicker {...pickerProps(ASSETS[1])} />
              <AssetPicker {...pickerProps(ASSETS[2])} />
            </div>
            <small className="mute">PNG, JPG, WEBP, GIF or ICO, up to {MAX_MB} MB each. Images are saved on the server and only the path is stored in the database.</small>
          </div>
          <BrandPreview name={f.name} color={f.brand_color} image={srcOf('image')} logo={srcOf('logo')} icon={srcOf('icon')} />
        </div>

        <label className="f">Features for this company</label>
        <div className="checks mb">
          {meta.features.map((k) => (
            <label key={k} className="chk"><input type="checkbox" checked={f.features.includes(k)} onChange={() => toggle(k)} /> {FEATURE_LABEL[k] || k}</label>
          ))}
        </div>

        {editing ? (
          <div className="field"><label className="f">Status</label>
            <select className="input" value={f.status} onChange={set('status')}><option value="active">Active</option><option value="blocked">Blocked (nobody can login)</option></select></div>
        ) : (
          <>
            <h3 className="mt mb">Company admin login</h3>
            <div className="grid2">
              <div className="field"><label className="f">Admin name *</label><input className="input" required value={f.admin_name} onChange={set('admin_name')} /></div>
              <div className="field"><label className="f">Admin email *</label><input className="input" type="email" required value={f.admin_email} onChange={set('admin_email')} /></div>
              <div className="field"><label className="f">Phone</label><input className="input" value={f.admin_phone} onChange={set('admin_phone')} /></div>
              <div className="field"><label className="f">Password * (min 6)</label><input className="input" minLength="6" required value={f.admin_password} onChange={set('admin_password')} /></div>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}

export default function Companies() {
  const { toast, confirm, ask } = useUI()
  const [list, setList] = useState(null)
  const [meta, setMeta] = useState(null)
  const [edit, setEdit] = useState(null)
  const load = () => api.get('/api/platform/companies').then((r) => setList(r.data))
  useEffect(() => { load(); api.get('/api/platform/meta').then((r) => setMeta(r.data)) }, [])

  const loginAs = async (c) => {
    try {
      const { data } = await api.post(`/api/platform/companies/${c.id}/impersonate`)
      localStorage.setItem(tokenKey(data.code), data.token)
      window.open(`/${data.code}/admin`, '_blank')
    } catch (e) { toast(errMsg(e), 'err') }
  }
  const resetPw = async (c) => {
    const password = await ask(`New password for ${c.name} admin`, { placeholder: 'At least 6 characters' })
    if (!password) return
    try { const { data } = await api.put(`/api/platform/companies/${c.id}/admin-password`, { password }); toast(data.message) } catch (e) { toast(errMsg(e), 'err') }
  }
  const toggleBlock = async (c) => {
    const block = c.status === 'active'
    if (!(await confirm(block ? `Block ${c.name}? Nobody from this company can login.` : `Activate ${c.name} again?`, { confirm: block ? 'Block' : 'Activate', danger: block }))) return
    try { await api.put(`/api/platform/companies/${c.id}`, { status: block ? 'blocked' : 'active' }); toast('Company updated'); load() } catch (e) { toast(errMsg(e), 'err') }
  }

  if (!list || !meta) return <Loading />
  return (
    <>
      <div className="row between mb">
        <div><h1>Companies</h1><div className="mute">Every company has its own database, its own users, products, stock and orders.</div></div>
        <button className="btn primary" onClick={() => setEdit({})}>+ New company</button>
      </div>
      <div className="card flush tbl-wrap"><table className="tbl" style={{ minWidth: 900 }}>
        <thead><tr><th>Company</th><th>Database</th><th>Design</th><th className="num">Users</th><th className="num">Products</th><th className="num">Orders</th><th>Status</th><th>Created</th><th /></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan="9"><Empty>No companies yet. Create the first one.</Empty></td></tr>}
          {list.map((c) => (
            <tr key={c.id}>
              <td>
                <div className="co-cell">
                  <span className="co-avatar" style={{ background: c.logo ? '#fff' : c.brand_color }}>
                    {c.logo ? <img src={c.logo} alt="" /> : initial(c.name)}
                  </span>
                  <div><b>{c.name}</b><div className="mute">/{c.code}</div></div>
                </div>
              </td>
              <td><code>{c.db_name}</code></td>
              <td><span className="badge blue">{c.design}</span> <span className="swatch" style={{ background: c.brand_color }} /></td>
              <td className="num">{c.counts?.users ?? '-'}</td><td className="num">{c.counts?.products ?? '-'}</td><td className="num">{c.counts?.orders ?? '-'}</td>
              <td><span className={`badge ${c.status === 'active' ? 'green' : 'red'}`}>{c.status}</span></td>
              <td className="mute">{fmtDate(c.created_at)}</td>
              <td className="num" style={{ whiteSpace: 'nowrap' }}>
                <a className="btn sm" href={`/${c.code}`} target="_blank" rel="noreferrer">Store</a>{' '}
                <button className="btn sm" onClick={() => loginAs(c)}>Login as admin</button>{' '}
                <button className="btn sm" onClick={() => setEdit(c)}>Edit</button>{' '}
                <button className="btn sm" onClick={() => resetPw(c)}>Admin password</button>{' '}
                <button className={`btn sm ${c.status === 'active' ? 'danger' : ''}`} onClick={() => toggleBlock(c)}>{c.status === 'active' ? 'Block' : 'Activate'}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {edit && <CompanyForm key={edit.id || 'new'} company={edit.id ? edit : null} meta={meta} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

