import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useParams } from './components/nav'
import api, { errMsg } from './api'
import { useAuth } from './context/AuthContext'
import { CompanyProvider } from './context/CompanyContext'
import { CartProvider } from './context/CartContext'
import UserLayout from './components/UserLayout'
import AdminLayout, { Can } from './components/AdminLayout'
import PlatformLayout from './components/PlatformLayout'
import { Loading } from './components/ui'
import { setFavicon, setTheme } from './theme'
import Landing from './pages/Landing'
import Home from './pages/Home'
import Products from './pages/Products'
import QuickBuy from './pages/QuickBuy'
import Cart from './pages/Cart'
import Enquiries from './pages/Enquiries'
import EnquiryDetail from './pages/EnquiryDetail'
import TrackOrder from './pages/TrackOrder'
import Availability from './pages/Availability'
import { Login, Register, AdminLogin, PlatformLogin } from './pages/Auth'
import Companies from './pages/platform/Companies'
import Admins from './pages/platform/Admins'
import PlatformSettings from './pages/platform/PlatformSettings'
import Archives from './pages/admin/Archives'
import AdminHome from './pages/admin/AdminHome'
import AdminProducts from './pages/admin/Products'
import Categories from './pages/admin/Categories'
import Brands from './pages/admin/Brands'
import Stock from './pages/admin/Stock'
import AdminOrders from './pages/admin/Orders'
import Users from './pages/admin/Users'
import Reports from './pages/admin/Reports'
import Settings from './pages/admin/Settings'

// Loads the company (design + brand colour + features) from the company code in the URL
function CompanyShell() {
  const { co } = useParams()
  const [st, setSt] = useState({ co: null, company: null, error: '' })
  const load = () => api.get('/api/company')
    .then((r) => setSt({ co, company: r.data, error: '' }))
    .catch((e) => setSt({ co, company: null, error: errMsg(e) }))

  useEffect(() => { setSt((s) => (s.co === co ? s : { co: null, company: null, error: '' })); load() }, [co])
  useEffect(() => {
    if (st.company) {
      setTheme(st.company); document.title = st.company.name
      setFavicon(st.company.icon || st.company.logo) // company icon (or logo) = browser tab icon
    }
    return () => { setTheme(null); setFavicon(null); document.title = 'MK Crackers' }
  }, [st.company])

  if (st.co !== co) return <Loading />
  if (st.error) {
    return (
      <div className="card auth center">
        <h2>Company not found</h2>
        <p className="mute">{st.error}</p>
        <Link to="/platform/login" className="btn">Back</Link>
      </div>
    )
  }
  const has = (f) => (st.company.features || []).includes(f)
  return (
    <CompanyProvider value={{ company: st.company, refresh: load, has }}>
      <CartProvider key={co} co={co}><Outlet /></CartProvider>
    </CompanyProvider>
  )
}

function RequireUser({ children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Loading />
  return user ? children : <Navigate to="/login" state={{ from: loc.pathname }} replace />
}
function RequireStaff({ children }) {
  const { user, loading, isStaff } = useAuth()
  if (loading) return <Loading />
  return user && isStaff ? children : <Navigate to="/admin/login" replace />
}
// Only company admin / staff (e.g. Check Availability)
function StaffOnly({ children }) {
  const { loading, isStaff } = useAuth()
  if (loading) return <Loading />
  return isStaff ? children : <Navigate to="/" replace />
}
function RequirePlatform({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return user ? children : <Navigate to="/platform/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/platform" element={<RequirePlatform><PlatformLayout /></RequirePlatform>}>
        <Route index element={<Companies />} />
        <Route path="admins" element={<Admins />} />
        <Route path="settings" element={<PlatformSettings />} />
      </Route>

      <Route path="/:co" element={<CompanyShell />}>
        <Route element={<UserLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="quick-buy" element={<QuickBuy />} />
          <Route path="availability" element={<StaffOnly><Availability /></StaffOnly>} />
          <Route path="track" element={<TrackOrder />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="cart" element={<RequireUser><Cart /></RequireUser>} />
          <Route path="enquiries" element={<RequireUser><Enquiries /></RequireUser>} />
          <Route path="enquiries/:id" element={<RequireUser><EnquiryDetail /></RequireUser>} />
        </Route>
        <Route path="admin/login" element={<AdminLogin />} />
        <Route path="admin" element={<RequireStaff><AdminLayout /></RequireStaff>}>
          <Route index element={<AdminHome />} />
          <Route path="products" element={<Can any={['products.view', 'products.manage']}><AdminProducts /></Can>} />
          <Route path="categories" element={<Can any={['categories.manage']}><Categories /></Can>} />
          <Route path="brands" element={<Can any={['categories.manage']}><Brands /></Can>} />
          <Route path="stock" element={<Can any={['stock.view', 'stock.manage', 'stock.history']}><Stock /></Can>} />
          <Route path="orders" element={<Can any={['orders.view', 'orders.manage']}><AdminOrders /></Can>} />
          <Route path="reports" element={<Can any={['reports.view']} feature="reports"><Reports /></Can>} />
          <Route path="users" element={<Can any={['users.manage']}><Users /></Can>} />
          <Route path="settings" element={<Can any={['settings.manage']}><Settings /></Can>} />
          <Route path="archives" element={<Can any={['reports.view', 'orders.view']}><Archives /></Can>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
