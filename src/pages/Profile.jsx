import { useEffect, useState } from 'react'
import api, { errMsg } from '../api'
import { Link, Navigate, useNavigate } from '../components/nav'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../components/ui'

const ENQUIRIES_API = '/api/enquiries'
const PROFILE_API = '/api/auth/profile'
const ACTIVE = ['unpaid', 'pending_verification', 'paid']

const P = {
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  clip: 'M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1zM8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2',
  check: 'M20 6 9 17l-5-5',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
}
const Ic = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)

const initials = (n) => (n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
const memberSince = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '')

export default function Profile() {
  const { user, logout, refresh, isStaff } = useAuth()
  const { toast } = useUI()
  const nav = useNavigate()
  const [stats, setStats] = useState({ total: 0, active: 0 })
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ name: '', email: '', phone: '' })

  useEffect(() => {
    if (!user || isStaff) return
    api.get(ENQUIRIES_API).then((r) => {
      const list = Array.isArray(r.data) ? r.data : r.data?.rows || r.data?.orders || []
      setStats({ total: list.length, active: list.filter((o) => ACTIVE.includes(o.status)).length })
    }).catch(() => {})
  }, [user, isStaff])

  if (!user) return null
  if (isStaff) return <Navigate to="/admin" replace />

  const startEdit = () => {
    setF({ name: user.name || '', email: user.email || '', phone: user.phone || '' })
    setEditing(true)
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    const phone = f.phone.replace(/\D/g, '')
    if (phone && phone.length !== 10) return toast('Enter a valid 10 digit mobile number', 'err')
    setBusy(true)
    try {
      await api.put(PROFILE_API, { name: f.name.trim(), email: f.email.trim(), phone })
      toast('Profile updated')
      setEditing(false)
      if (typeof refresh === 'function') await refresh(); else window.location.reload()
    } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }

  const soon = (what) => () => toast(`${what} is coming soon`, 'warn')

  return (
    <div className="pf">
      <div className="pf-card pf-head">
        <div className="pf-avatar">{initials(editing ? f.name : user.name)}</div>

        {editing ? (
          <form className="pf-form" onSubmit={save}>
            <div className="field"><label className="f">Full Name</label>
              <input className="input" required value={f.name} onChange={set('name')} /></div>
            <div className="field"><label className="f">Email</label>
              <input className="input" type="email" value={f.email} onChange={set('email')} /></div>
            <div className="field"><label className="f">WhatsApp Number</label>
              <input className="input" inputMode="numeric" maxLength={10} value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} /></div>
            <div className="pf-btns">
              <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
              <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="pf-info">
            <h1>{user.name}</h1>
            {user.email && <div>{user.email}</div>}
            {user.phone && <div>{user.phone}</div>}
            {user.created_at && <small>Member since {memberSince(user.created_at)}</small>}
          </div>
        )}

        <div className="pf-actions">
          {!editing && <button className="pf-act" onClick={startEdit}><Ic d={P.edit} size={18} /> Edit</button>}
          <button className="pf-act" onClick={() => { logout(); nav('/') }}><Ic d={P.out} size={18} /> Logout</button>
        </div>
      </div>

      <div className="pf-grid">
        <div className="pf-card pf-stat">
          <div className="pf-top"><span className="pf-ico pink"><Ic d={P.clip} /></span><b>{stats.total}</b></div>
          <div>Total Enquiries</div>
        </div>
        <div className="pf-card pf-stat">
          <div className="pf-top"><span className="pf-ico green"><Ic d={P.check} /></span><b>{stats.active}</b></div>
          <div>Active Enquiries</div>
        </div>
        <div className="pf-card pf-stat">
          <div className="pf-top"><span className="pf-ico red"><Ic d={P.heart} /></span><b>0</b></div>
          <div>Favorites</div>
        </div>
      </div>

      <div className="pf-grid">
        <Link to="/enquiries" className="pf-card pf-link">
          <span className="pf-ico pink"><Ic d={P.clip} /></span>
          <div><b>My Enquiries</b><small>View enquiry history</small></div>
        </Link>
        <button className="pf-card pf-link" onClick={soon('Favorites')}>
          <span className="pf-ico red"><Ic d={P.heart} /></span>
          <div><b>Favorites</b><small>Items you love</small></div>
        </button>
        <button className="pf-card pf-link" onClick={soon('Addresses')}>
          <span className="pf-ico slate"><Ic d={P.pin} /></span>
          <div><b>Addresses</b><small>Manage addresses</small></div>
        </button>
      </div>
    </div>
  )
}

