import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from './nav'
import api, { downloadFile, errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useCompany } from '../context/CompanyContext'
import { Swal, inr, useUI } from './ui'

export default function UserLayout() {
  const { user, logout, isStaff } = useAuth()
  const { company, has } = useCompany()
  const { count, total } = useCart()
  const { toast } = useUI()
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState({})

  useEffect(() => { api.get('/api/settings').then((r) => setInfo(r.data)).catch(() => {}) }, [])
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])

  // Price list: ask Excel or PDF, then download
  const priceList = async () => {
    const r = await Swal.fire({
      title: 'Download price list', text: 'Which format do you want?', icon: 'question',
      showDenyButton: true, showCancelButton: true, confirmButtonText: '📗 Excel (.xlsx)', denyButtonText: '📕 PDF',
      confirmButtonColor: '#16a34a', denyButtonColor: '#dc2626', reverseButtons: true,
    })
    const fmt = r.isConfirmed ? 'xlsx' : r.isDenied ? 'pdf' : null
    if (!fmt) return
    try {
      await downloadFile('/api/pricelist', { format: fmt }, `${company.code}-price-list.${fmt}`)
      toast(`Price list (${fmt === 'xlsx' ? 'Excel' : 'PDF'}) downloaded`)
    } catch (e) { toast(errMsg(e), 'err') }
  }

  const cls = ({ isActive }) => (isActive ? 'active' : '')
  const name = info.store_name || company.name
  return (
    <>
      {info.announcement && <div className="announce">{info.announcement}</div>}
      <header className={`nav${open ? ' open' : ''}`}>
        <div className="container">
          <Link to="/" className="brand"><span className="logo">{name.slice(0, 1).toUpperCase()}</span>{name}</Link>
          <button className="burger" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <nav className="nav-links">
            <NavLink to="/availability" className={cls}>Check Availability</NavLink>
            <NavLink to="/products" className={cls}>All Products</NavLink>
            <NavLink to="/track" className={cls}>Track Order</NavLink>
            {has('pricelist') && <button className="lnk" onClick={priceList}>⬇ Price List</button>}
            <NavLink to="/quick-buy" className="qb">⚡ Quick Buy</NavLink>
            {user && <NavLink to="/enquiries" className={cls}>My Enquiries</NavLink>}
          </nav>
          <div className="nav-right">
            <Link to="/cart" className="cart-ic" aria-label="Cart">🛒{count > 0 && <b>{count}</b>}</Link>
            {user ? (
              <>
                {isStaff && <Link to="/admin" className="btn sm outline">Admin Panel</Link>}
                <span className="mute">👤 {user.name}</span>
                <button className="btn sm" onClick={() => { logout(); nav('/') }}>Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn sm">Login</Link>
                <Link to="/register" className="btn sm primary">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container page"><Outlet /></main>

      {count > 0 && loc.pathname !== `/${company.code}/cart` && loc.pathname !== `/${company.code}/quick-buy` && (
        <Link to="/cart" className="fab">🛒 {count}<small>{inr(total)}</small></Link>
      )}
      <footer className="container mute center" style={{ padding: '10px 0 30px' }}>
        {name} {info.phone && `· Call: ${info.phone}`} · <Link to="/admin/login">Admin</Link>
      </footer>
    </>
  )
}
