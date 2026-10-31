import { useEffect, useState } from 'react'
import api, { errMsg } from '../../api'
import { Empty, Loading, Modal, fmtDate, useUI } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

const ROLE = { company_admin: ['Company admin', 'blue'], staff: ['Staff', 'amber'], user: ['Customer', 'grey'] }

// Access control: tick which options this staff user can use
function AccessPicker({ meta, value, onChange }) {
  const has = (k) => value.includes(k)
  const toggle = (k) => onChange(has(k) ? value.filter((x) => x !== k) : [...value, k])
  const presets = { manager: 'Manager', stock_keeper: 'Stock keeper', sales: 'Sales', viewer: 'View only' }
  return (
    <div>
      <div className="row mb">
        <span className="mute">Quick set:</span>
        {Object.entries(presets).map(([k, l]) => <button type="button" key={k} className="btn sm" onClick={() => onChange(meta.presets[k])}>{l}</button>)}
        <button type="button" className="btn sm" onClick={() => onChange(meta.groups.flatMap((g) => g.items.map((i) => i[0])))}>All</button>
        <button type="button" className="btn sm" onClick={() => onChange([])}>None</button>
      </div>
      <div className="perm-grid">
        {meta.groups.map((g) => (
          <div className="perm-group" key={g.group}>
            <b>{g.group}</b>
            {g.items.map(([k, label]) => (
              <label key={k} className="chk"><input type="checkbox" checked={has(k)} onChange={() => toggle(k)} /> {label}</label>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function UserForm({ u, meta, onClose, onSaved }) {
  const { toast } = useUI()
  const { user: me } = useAuth()
  const isCA = me.role === 'company_admin'
  const editing = !!u
  const [f, setF] = useState({ name: u?.name || '', email: u?.email || '', phone: u?.phone || '', role: u?.role || 'user', status: u?.status || 'active', password: '' })
  const [perms, setPerms] = useState(u?.permissions || [])
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      const body = { ...f, permissions: f.role === 'staff' ? perms : [] }
      if (editing) await api.put(`/api/admin/users/${u.id}`, body); else await api.post('/api/admin/users', body)
      toast('User saved'); onSaved()
    } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal wide={f.role === 'staff'} title={editing ? 'Edit user' : 'Add user'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="uform" disabled={busy}>Save</button></>}>
      <form id="uform" onSubmit={save}>
        <div className="grid2">
          <div className="field"><label className="f">Name *</label><input className="input" required value={f.name} onChange={set('name')} /></div>
          <div className="field"><label className="f">Email *</label><input className="input" type="email" required disabled={editing} value={f.email} onChange={set('email')} /></div>
          <div className="field"><label className="f">Phone</label><input className="input" value={f.phone} onChange={set('phone')} /></div>
          {!editing && <div className="field"><label className="f">Password * (min 6)</label><input className="input" type="text" minLength="6" required value={f.password} onChange={set('password')} /></div>}
          {isCA && (
            <div className="field"><label className="f">Role</label>
              <select className="input" value={f.role} onChange={set('role')}>
                <option value="user">Customer (shop only)</option>
                <option value="staff">Staff (admin panel, limited access)</option>
                <option value="company_admin">Company admin (full access)</option>
              </select></div>
          )}
          {editing && <div className="field"><label className="f">Status</label><select className="input" value={f.status} onChange={set('status')}><option value="active">Active</option><option value="blocked">Blocked</option></select></div>}
        </div>
        {isCA && f.role === 'staff' && (
          <>
            <h3 className="mt mb">Access control</h3>
            <p className="mute" style={{ marginTop: 0 }}>This staff user will see only the options you tick.</p>
            <AccessPicker meta={meta} value={perms} onChange={setPerms} />
          </>
        )}
        {isCA && f.role === 'company_admin' && <p className="mute">Company admins can use every option, change prices on print and give access to others.</p>}
      </form>
    </Modal>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const { toast, confirm, ask } = useUI()
  const [list, setList] = useState(null)
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('')
  const [edit, setEdit] = useState(null)
  const load = () => api.get('/api/admin/users', { params: { search } }).then((r) => setList(r.data))
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [search])
  useEffect(() => { api.get('/api/admin/permissions').then((r) => setMeta(r.data)) }, [])

  const toggle = async (u) => {
    const status = u.status === 'active' ? 'blocked' : 'active'
    if (!(await confirm(`${status === 'blocked' ? 'Block' : 'Unblock'} ${u.name}?`, { confirm: status === 'blocked' ? 'Block' : 'Unblock', danger: status === 'blocked' }))) return
    try { await api.put(`/api/admin/users/${u.id}`, { ...u, status }); toast(`User ${status}`); load() } catch (e) { toast(errMsg(e), 'err') }
  }
  const resetPw = async (u) => {
    const password = await ask(`New password for ${u.name}`, { placeholder: 'At least 6 characters' })
    if (!password) return
    try { await api.put(`/api/admin/users/${u.id}/password`, { password }); toast('Password changed') } catch (e) { toast(errMsg(e), 'err') }
  }
  const del = async (u) => {
    if (!(await confirm(`Delete ${u.name}? This cannot be undone.`, { confirm: 'Delete' }))) return
    try { await api.delete(`/api/admin/users/${u.id}`); toast('User deleted'); load() } catch (e) { toast(errMsg(e), 'err') }
  }

  if (!list || !meta) return <Loading />
  const shown = list.filter((u) => !tab || (tab === 'team' ? u.role !== 'user' : u.role === 'user'))
  const canEdit = (u) => me.role === 'company_admin' || u.role === 'user'
  return (
    <>
      <div className="row between mb">
        <div><h1>Users &amp; Access</h1><div className="mute">Create staff and choose exactly which options each user can use.</div></div>
        <div className="row"><input className="input" style={{ width: 240 }} placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} /><button className="btn primary" onClick={() => setEdit({})}>+ Add user</button></div>
      </div>
      <div className="tabs">
        {[['', 'All'], ['team', 'Admin & Staff'], ['customers', 'Customers']].map(([k, l]) => <button key={k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="card flush tbl-wrap"><table className="tbl" style={{ minWidth: 860 }}>
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Access</th><th>Status</th><th className="num">Orders</th><th>Joined</th><th /></tr></thead>
        <tbody>
          {shown.length === 0 && <tr><td colSpan="9"><Empty>No users found.</Empty></td></tr>}
          {shown.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name}</b>{u.id === me.id && <span className="mute"> (you)</span>}</td><td>{u.email}</td><td>{u.phone}</td>
              <td><span className={`badge ${ROLE[u.role][1]}`}>{ROLE[u.role][0]}</span></td>
              <td className="mute">{u.role === 'company_admin' ? 'Everything' : u.role === 'staff' ? `${u.permissions.length} option(s)` : 'Shop only'}</td>
              <td><span className={`badge ${u.status === 'active' ? 'green' : 'red'}`}>{u.status === 'active' ? 'Active' : 'Blocked'}</span></td>
              <td className="num">{u.orders_count}</td><td className="mute">{fmtDate(u.created_at)}</td>
              <td className="num" style={{ whiteSpace: 'nowrap' }}>
                {canEdit(u) && <><button className="btn sm" onClick={() => setEdit(u)}>{u.role === 'staff' ? 'Access' : 'Edit'}</button>{' '}
                  <button className="btn sm" onClick={() => resetPw(u)}>Password</button>{' '}</>}
                {canEdit(u) && u.id !== me.id && <><button className="btn sm" onClick={() => toggle(u)}>{u.status === 'active' ? 'Block' : 'Unblock'}</button>{' '}<button className="btn sm danger" onClick={() => del(u)}>Delete</button></>}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {edit && <UserForm key={edit.id || 'new'} u={edit.id ? edit : null} meta={meta} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}
