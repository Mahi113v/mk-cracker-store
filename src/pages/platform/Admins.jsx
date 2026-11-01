import { useEffect, useState } from 'react'
import api, { errMsg } from '../../api'
import { useAuth } from '../../context/AuthContext'
import PasswordInput from '../../components/PasswordInput'
import { Empty, Loading, Modal, fmtDate, useUI } from '../../components/ui'

function AdminForm({ admin, onClose, onSaved }) {
  const { toast } = useUI()
  const editing = !!admin
  const [f, setF] = useState({ name: admin?.name || '', email: admin?.email || '', password: '', status: admin?.status || 'active' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      if (editing) await api.put(`/api/platform/admins/${admin.id}`, { name: f.name, email: f.email, status: f.status })
      else await api.post('/api/platform/admins', { name: f.name, email: f.email, password: f.password })
      toast(editing ? 'Super admin updated' : 'Super admin created'); onSaved()
    } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal title={editing ? `Edit ${admin.name}` : 'New super admin'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="aform" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <form id="aform" onSubmit={save}>
        <div className="field"><label className="f">Name *</label><input className="input" required value={f.name} onChange={set('name')} /></div>
        <div className="field"><label className="f">Email (login) *</label><input className="input" type="email" required value={f.email} onChange={set('email')} /></div>
        {!editing && <div className="field"><label className="f">Password * (min 6)</label><PasswordInput minLength="6" required autoComplete="new-password" value={f.password} onChange={set('password')} /></div>}
        {editing && <div className="field"><label className="f">Status</label>
          <select className="input" value={f.status} onChange={set('status')}><option value="active">Active</option><option value="blocked">Blocked (cannot login)</option></select></div>}
      </form>
    </Modal>
  )
}

export default function Admins() {
  const { toast, confirm, ask } = useUI()
  const { user } = useAuth()
  const [list, setList] = useState(null)
  const [edit, setEdit] = useState(null)
  const load = () => api.get('/api/platform/admins').then((r) => setList(r.data))
  useEffect(() => { load() }, [])

  const resetPw = async (a) => {
    const password = await ask(`New password for ${a.name}`, { placeholder: 'At least 6 characters' })
    if (!password) return
    try { await api.put(`/api/platform/admins/${a.id}/password`, { password }); toast('Password changed') } catch (e) { toast(errMsg(e), 'err') }
  }
  const del = async (a) => {
    if (!(await confirm(`Delete super admin "${a.name}"? This cannot be undone.`))) return
    try { await api.delete(`/api/platform/admins/${a.id}`); toast('Super admin deleted'); load() } catch (e) { toast(errMsg(e), 'err') }
  }
  const toggle = async (a) => {
    const block = a.status === 'active'
    if (!(await confirm(block ? `Block ${a.name}? They cannot login.` : `Activate ${a.name} again?`, { confirm: block ? 'Block' : 'Activate', danger: block }))) return
    try { await api.put(`/api/platform/admins/${a.id}`, { name: a.name, email: a.email, status: block ? 'blocked' : 'active' }); load() } catch (e) { toast(errMsg(e), 'err') }
  }

  if (!list) return <Loading />
  return (
    <>
      <div className="row between mb">
        <div><h1>Super admins</h1><div className="mute">People who can login to this platform panel and manage every company.</div></div>
        <button className="btn primary" onClick={() => setEdit({})}>+ New super admin</button>
      </div>
      <div className="card flush tbl-wrap"><table className="tbl">
        <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Created</th><th /></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan="5"><Empty>No super admins.</Empty></td></tr>}
          {list.map((a) => (
            <tr key={a.id}>
              <td><div className="co-cell"><span className="co-avatar" style={{ background: 'var(--red)' }}>{a.name.charAt(0).toUpperCase()}</span><b>{a.name}</b>{a.id === user.id && <span className="badge blue">You</span>}</div></td>
              <td>{a.email}</td>
              <td><span className={`badge ${a.status === 'active' ? 'green' : 'red'}`}>{a.status}</span></td>
              <td className="mute">{fmtDate(a.created_at)}</td>
              <td className="num" style={{ whiteSpace: 'nowrap' }}>
                <button className="btn sm" onClick={() => setEdit(a)}>Edit</button>{' '}
                <button className="btn sm" onClick={() => resetPw(a)}>Password</button>{' '}
                {a.id !== user.id && <><button className={`btn sm ${a.status === 'active' ? 'danger' : ''}`} onClick={() => toggle(a)}>{a.status === 'active' ? 'Block' : 'Activate'}</button>{' '}
                  <button className="btn sm danger" onClick={() => del(a)}>Delete</button></>}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {edit && <AdminForm key={edit.id || 'new'} admin={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}
