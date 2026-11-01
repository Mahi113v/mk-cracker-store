import { useState } from 'react'
import { Link, useLocation, useNavigate } from '../components/nav'
import { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { usePlatformLook } from '../components/PlatformLayout'
import BrandMark from '../components/BrandMark'
import PasswordInput from '../components/PasswordInput'

function Shell({ title, sub, children, error, mark }) {
  return (
    <div className="card auth">
      {mark && <div className="auth-mark">{mark}</div>}
      <h1>{title}</h1>
      <p className="mute mb">{sub}</p>
      {error && <div className="err">{error}</div>}
      {children}
    </div>
  )
}

// Email only (admin + platform login)
function Fields({ f, setF }) {
  return (
    <>
      <div className="field"><label className="f">Email</label><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div className="field"><label className="f">Password</label><PasswordInput required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
    </>
  )
}

// Email OR mobile number (customer login)
const normalizeIdentifier = (v) => {
  const s = String(v || '').trim()
  return s.includes('@') ? s.toLowerCase() : s.replace(/\D/g, '').slice(-10)
}

export function Login() {
  const { login } = useAuth()
  const { company } = useCompany()
  const nav = useNavigate()
  const from = useLocation().state?.from || '/'
  const [f, setF] = useState({ identifier: '', password: '' })
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setError('')
    const id = normalizeIdentifier(f.identifier)
    if (!id.includes('@') && id.length !== 10) return setError('Enter a valid email or 10 digit mobile number')
    try { await login(id, f.password); nav(from, { replace: true }) } catch (err) { setError(errMsg(err)) }
  }
  return (
    <Shell mark={<BrandMark name={company.name} logo={company.logo} icon={company.icon} size={56} />} title="Login" sub={`Welcome to ${company.name}. Login to place and track your enquiries.`} error={error}>
      <form onSubmit={submit}>
        <div className="field">
          <label className="f">Email or Mobile number</label>
          <input className="input" required autoComplete="username" value={f.identifier}
            placeholder="you@mail.com or 9876543210"
            onChange={(e) => setF({ ...f, identifier: e.target.value })} />
        </div>
        <div className="field"><label className="f">Password</label>
          <PasswordInput required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <button className="btn primary block">Login</button>
      </form>
      <p className="mute center">New here? <Link to="/register" className="link">Create an account</Link></p>
      <p className="mute center" style={{ fontSize: 13 }}>Store staff? <Link to="/admin/login" className="link">Admin login</Link></p>
    </Shell>
  )
}

export function Register() {
  const { register } = useAuth()
  const { company } = useCompany()
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setError('')
    const phone = f.phone.replace(/\D/g, '').slice(-10)
    if (phone.length !== 10) return setError('Enter a valid 10 digit mobile number')
    try { await register({ ...f, email: f.email.trim().toLowerCase(), phone }); nav('/') } catch (err) { setError(errMsg(err)) }
  }
  return (
    <Shell mark={<BrandMark name={company.name} logo={company.logo} icon={company.icon} size={56} />} title="Create account" sub="Sign up to order crackers online." error={error}>
      <form onSubmit={submit}>
        <div className="field"><label className="f">Full name</label><input className="input" required value={f.name} onChange={set('name')} /></div>
        <div className="field"><label className="f">Email</label><input className="input" type="email" required value={f.email} onChange={set('email')} /></div>
        <div className="field"><label className="f">Mobile number</label>
          <input className="input" type="tel" inputMode="numeric" maxLength={10} required value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} /></div>
        <div className="field"><label className="f">Password (min 6 characters)</label><PasswordInput minLength="6" required autoComplete="new-password" value={f.password} onChange={set('password')} /></div>
        <button className="btn primary block">Create account</button>
      </form>
      <p className="mute center">Already registered? <Link to="/login" className="link">Login</Link></p>
    </Shell>
  )
}

// Company admin / staff login:  /<company>/admin/login
export function AdminLogin() {
  const { login } = useAuth()
  const { company } = useCompany()
  const nav = useNavigate()
  const [f, setF] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try { await login(f.email, f.password, 'admin'); nav('/admin', { replace: true }) } catch (err) { setError(errMsg(err)) }
  }
  return (
    <div className="dark-page">
      <Shell mark={<BrandMark name={company.name} logo={company.logo} icon={company.icon} size={56} />} title={`${company.name} · Admin`} sub="Company admin and staff only. Customers please use the normal login." error={error}>
        <form onSubmit={submit}>
          <Fields f={f} setF={setF} />
          <button className="btn primary block">Login to admin panel</button>
        </form>
        <p className="center"><Link to="/" className="mute">← Back to store</Link></p>
      </Shell>
    </div>
  )
}

// Platform (product owner) login:  /platform/login
export function PlatformLogin() {
  const { login } = useAuth()
  const b = usePlatformLook()
  const nav = useNavigate()
  const [f, setF] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try { await login(f.email, f.password); nav('/platform', { replace: true }) } catch (err) { setError(errMsg(err)) }
  }
  return (
    <div className="dark-page">
      <Shell mark={<BrandMark name={b.name} logo={b.logo} icon={b.icon} size={56} />} title={b.name} sub="Super admin login. Create companies, databases and control access for every company." error={error}>
        <form onSubmit={submit}>
          <Fields f={f} setF={setF} />
          <button className="btn primary block">Login</button>
        </form>
        <p className="center"><Link to="/" className="mute">← Home</Link></p>
      </Shell>
    </div>
  )
}


