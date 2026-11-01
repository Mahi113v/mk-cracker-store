import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from './nav'
import api, { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { usePlatformBranding } from '../context/PlatformContext'
import { setFavicon, setTheme } from '../theme'
import BrandMark from './BrandMark'
import { useUI } from './ui'

// Super admin panel: always uses the "current" (latest trend) design
export function usePlatformLook() {
  const b = usePlatformBranding()
  useEffect(() => {
    setTheme({ design: 'current', brand_color: b.brand_color })
    setFavicon(b.icon || b.logo)
    document.title = b.name
    return () => { setTheme(null); setFavicon(null); document.title = 'MK Crackers' }
  }, [b.brand_color, b.icon, b.logo, b.name])
  return b
}

const MENU = [
  { to: '/platform', label: '🏢 Companies', end: true },
  { to: '/platform/admins', label: '🛡 Super admins' },
  { to: '/platform/settings', label: '⚙ Settings' },
]

export default function PlatformLayout() {
  const { user, logout } = useAuth()
  const { ask, toast } = useUI()
  const nav = useNavigate()
  const b = usePlatformLook()
  const [open, setOpen] = useState(false)
  const changePw = async () => {
    const password = await ask('New super admin password', { placeholder: 'At least 6 characters' })
    if (!password) return
    try { await api.put('/api/platform/me/password', { password }); toast('Password changed') } catch (e) { toast(errMsg(e), 'err') }
  }
  return (
    <div className="admin platform">
      <aside className={`side${open ? ' open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand"><BrandMark name={b.name} logo={b.logo} icon={b.icon} size={40} /><span>{b.name}</span></div>
        <div className="side-user">{user.name}<small>Super admin</small></div>
        {MENU.map((m) => <NavLink key={m.to} to={m.to} end={m.end}>{m.label}</NavLink>)}
        <hr />
        <a href="#pw" onClick={(e) => { e.preventDefault(); changePw() }}>🔑 Change password</a>
        <Link to="/">🏠 Home</Link>
        <a href="#logout" onClick={(e) => { e.preventDefault(); logout(); nav('/platform/login') }}>🚪 Logout</a>
      </aside>
      <div>
        <div className="admin-top"><button className="btn sm" onClick={() => setOpen(!open)}>☰ Menu</button><b>{b.name}</b></div>
        <div className="admin-main"><Outlet /></div>
      </div>
    </div>
  )
}
