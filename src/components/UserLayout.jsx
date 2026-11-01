import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from './nav'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useCompany } from '../context/CompanyContext'
import { inr } from './ui'
import BrandMark from './BrandMark'
import PriceListDialog from './PriceListDialog'
import UserMenu from './UserMenu'
import Footer from './Footer'

export default function UserLayout() {
  const { user, logout, isStaff } = useAuth()
  const { company, has } = useCompany()
  const { count, total } = useCart()
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState({})
  const [plOpen, setPlOpen] = useState(false)

  useEffect(() => { api.get('/api/settings').then((r) => setInfo(r.data)).catch(() => {}) }, [])
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])

  const cls = ({ isActive }) => (isActive ? 'active' : '')
  const name = info.store_name || company.name
  const handleLogout = () => { logout(); nav('/') }

  return (
    <>
      {info.announcement && <div className="announce">{info.announcement}</div>}
      <header className={`nav${open ? ' open' : ''}`}>
        <div className="container">
          <Link to="/" className="brand"><BrandMark name={name} logo={company.logo} icon={company.icon} size={40} />{name}</Link>
          <button className="burger" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <nav className="nav-links">
            {isStaff && <NavLink to="/availability" className={cls}>Check Availability</NavLink>}
            <NavLink to="/products" className={cls}>All Products</NavLink>
            <NavLink to="/track" className={cls}>Track Order</NavLink>
            {has('pricelist') && <button className="lnk" onClick={() => setPlOpen(true)}>⬇ Price List</button>}
            <NavLink to="/quick-buy" className="qb">⚡ Quick Buy</NavLink>
            {user && <NavLink to="/enquiries" className={cls}>My Enquiries</NavLink>}
          </nav>
          <div className="nav-right">
            <Link to="/cart" className="cart-ic" aria-label="Cart">🛒{count > 0 && <b>{count}</b>}</Link>
            {user ? (
              <UserMenu user={user} isStaff={isStaff} onLogout={handleLogout} />
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
      {plOpen && <PriceListDialog onClose={() => setPlOpen(false)} />}

      {count > 0 && loc.pathname !== `/${company.code}/cart` && loc.pathname !== `/${company.code}/quick-buy` && (
        <Link to="/cart" className="fab">🛒 {count}<small>{inr(total)}</small></Link>
      )}
      {/* <footer className="container mute center" style={{ padding: '10px 0 30px' }}>
        {name} {info.phone && `· Call: ${info.phone}`} · <Link to="/admin/login">Admin</Link>
      </footer> */}
      <Footer name={name} company={company} info={info} />
    </>
  )
}


