import { useEffect, useState } from 'react'
import api, { errMsg, tokenKey } from '../../api'
import DesignPicker from '../../components/DesignPicker'
import { Empty, Loading, Modal, fmtDate, useUI } from '../../components/ui'

const FEATURE_LABEL = {
  reports: 'Sales & stock reports', pricelist: 'Price list Excel / PDF download', import: 'Upload Excel / PDF quantities',
  quick_discount: 'Quick Buy discount change', print: 'Bill print + discount alter',
}
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
const dbSlug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36)

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
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const onName = (e) => {
    const name = e.target.value
    const n = { ...f, name }
    if (!editing && !touched.code) n.code = slug(name)
    if (!editing && !touched.db) n.db_name = dbSlug(name)
    setF(n)
  }
  const toggle = (k) => setF({ ...f, features: f.features.includes(k) ? f.features.filter((x) => x !== k) : [...f.features, k] })

  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      if (editing) {
        await api.put(`/api/platform/companies/${company.id}`, { name: f.name, design: f.design, brand_color: f.brand_color, features: f.features, status: f.status })
        toast('Company updated')
      } else {
        await api.post('/api/platform/companies', {
          name: f.name, code: f.code, db_name: f.db_name, design: f.design, brand_color: f.brand_color, features: f.features,
          admin: { name: f.admin_name, email: f.admin_email, phone: f.admin_phone, password: f.admin_password },
        })
        toast(`Database "${f.db_name}" created with all tables`)
      }
      onSaved()
    } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }

  return (
    <Modal wide title={editing ? `Edit ${company.name}` : 'Create new company'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="cform" disabled={busy}>{busy ? 'Creating database…' : editing ? 'Save changes' : 'Create company & database'}</button></>}>
      <form id="cform" onSubmit={save}>
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
              <td><b>{c.name}</b><div className="mute">/{c.code}</div></td>
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
