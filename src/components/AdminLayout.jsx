import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from './nav'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'

// Menu items: each needs one of the permissions in "any" (company admin has all)
export const MENU = [
  { to: '/admin', label: '📊 Dashboard', end: true, any: ['dashboard.view'] },
  { to: '/admin/products', label: '📦 Products', any: ['products.view', 'products.manage'] },
  { to: '/admin/categories', label: '🗂 Categories', any: ['categories.manage'] },
  { to: '/admin/brands', label: '🏷 Brands', any: ['categories.manage'] },
  { to: '/admin/stock', label: '📈 Stock', any: ['stock.view', 'stock.manage', 'stock.history'] },
  { to: '/admin/orders', label: '🧾 Orders / Enquiries', any: ['orders.view', 'orders.manage'] },
  { to: '/admin/reports', label: '📑 Reports', any: ['reports.view'], feature: 'reports' },
  { to: '/admin/users', label: '👥 Users & Access', any: ['users.manage'] },
  { to: '/admin/settings', label: '⚙ Settings', any: ['settings.manage'] },
]

export function useMenu() {
  const { can } = useAuth()
  const { has } = useCompany()
  return MENU.filter((m) => m.any.some(can) && (!m.feature || has(m.feature)))
}

export function Can({ any, feature, children }) {
  const { can } = useAuth()
  const { has } = useCompany()
  const ok = any.some(can) && (!feature || has(feature))
  return ok ? children : (
    <div className="card center"><h3>🔒 No access</h3><p className="mute">You do not have access to this option. Ask your company admin.</p></div>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { company } = useCompany()
  const nav = useNavigate()
  const menu = useMenu()
  const [open, setOpen] = useState(false)
  return (
    <div className="admin">
      <aside className={`side${open ? ' open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand"><span className="logo">{company.name.slice(0, 1).toUpperCase()}</span>{company.name}</div>
        <div className="side-user">{user.name}<small>{user.role === 'company_admin' ? 'Company admin' : 'Staff'}</small></div>
        {menu.map((m) => <NavLink key={m.to} to={m.to} end={m.end}>{m.label}</NavLink>)}
        <hr />
        <Link to="/">🛍 View store</Link>
        <a href="#logout" onClick={(e) => { e.preventDefault(); logout(); nav('/admin/login') }}>🚪 Logout</a>
      </aside>
      <div>
        <div className="admin-top"><button className="btn sm" onClick={() => setOpen(!open)}>☰ Menu</button><b>{company.name}</b></div>
        <div className="admin-main"><Outlet /></div>
      </div>
    </div>
  )
}
