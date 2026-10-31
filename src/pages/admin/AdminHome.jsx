import { Navigate } from '../../components/nav'
import { useAuth } from '../../context/AuthContext'
import { useMenu } from '../../components/AdminLayout'
import Dashboard from './Dashboard'

export default function AdminHome() {
  const { can } = useAuth()
  const menu = useMenu()
  if (can('dashboard.view')) return <Dashboard />
  const first = menu.find((m) => m.to !== '/admin')
  return first ? <Navigate to={first.to} replace /> : <div className="card center"><h3>No options yet</h3><p className="mute">Ask your company admin to give you access.</p></div>
}
