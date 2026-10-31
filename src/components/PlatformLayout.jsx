import { Link, Outlet, useNavigate } from './nav'
import api, { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useUI } from './ui'

export default function PlatformLayout() {
  const { user, logout } = useAuth()
  const { ask, toast } = useUI()
  const nav = useNavigate()
  const changePw = async () => {
    const password = await ask('New platform admin password', { placeholder: 'At least 6 characters' })
    if (!password) return
    try { await api.put('/api/platform/me/password', { password }); toast('Password changed') } catch (e) { toast(errMsg(e), 'err') }
  }
  return (
    <>
      <header className="nav"><div className="container">
        <Link to="/platform" className="brand"><span className="logo">M</span>MK Platform</Link>
        <div className="nav-links" />
        <div className="nav-right">
          <span className="mute">👤 {user.name}</span>
          <button className="btn sm" onClick={changePw}>Change password</button>
          <button className="btn sm" onClick={() => { logout(); nav('/platform/login') }}>Logout</button>
        </div>
      </div></header>
      <main className="container page"><Outlet /></main>
    </>
  )
}
