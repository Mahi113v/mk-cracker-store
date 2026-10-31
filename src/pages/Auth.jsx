import { useState } from 'react'
import { Link, useLocation, useNavigate } from '../components/nav'
import { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'

function Shell({ title, sub, children, error }) {
  return (
    <div className="card auth">
      <h1>{title}</h1>
      <p className="mute mb">{sub}</p>
      {error && <div className="err">{error}</div>}
      {children}
    </div>
  )
}

function Fields({ f, setF }) {
  return (
    <>
      <div className="field"><label className="f">Email</label><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div className="field"><label className="f">Password</label><input className="input" type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
    </>
  )
}

export function Login() {
  const { login } = useAuth()
  const { company } = useCompany()
  const nav = useNavigate()
  const from = useLocation().state?.from || '/'
  const [f, setF] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try { await login(f.email, f.password); nav(from, { replace: true }) } catch (err) { setError(errMsg(err)) }
  }
  return (
    <Shell title="Login" sub={`Welcome to ${company.name}. Login to place and track your enquiries.`} error={error}>
      <form onSubmit={submit}>
        <Fields f={f} setF={setF} />
        <button className="btn primary block">Login</button>
      </form>
      <p className="mute center">New here? <Link to="/register" className="link">Create an account</Link></p>
      <p className="mute center" style={{ fontSize: 13 }}>Store staff? <Link to="/admin/login" className="link">Admin login</Link></p>
    </Shell>
  )
}

export function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try { await register(f); nav('/') } catch (err) { setError(errMsg(err)) }
  }
  return (
    <Shell title="Create account" sub="Sign up to order crackers online." error={error}>
      <form onSubmit={submit}>
        <div className="field"><label className="f">Full name</label><input className="input" required value={f.name} onChange={set('name')} /></div>
        <div className="field"><label className="f">Email</label><input className="input" type="email" required value={f.email} onChange={set('email')} /></div>
        <div className="field"><label className="f">Phone</label><input className="input" required value={f.phone} onChange={set('phone')} /></div>
        <div className="field"><label className="f">Password (min 6 characters)</label><input className="input" type="password" minLength="6" required value={f.password} onChange={set('password')} /></div>
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
      <Shell title={`${company.name} · Admin`} sub="Company admin and staff only. Customers please use the normal login." error={error}>
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
  const nav = useNavigate()
  const [f, setF] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try { await login(f.email, f.password); nav('/platform', { replace: true }) } catch (err) { setError(errMsg(err)) }
  }
  return (
    <div className="dark-page">
      <Shell title="Platform Admin" sub="Create companies, databases and control access for every company." error={error}>
        <form onSubmit={submit}>
          <Fields f={f} setF={setF} />
          <button className="btn primary block">Login</button>
        </form>
        <p className="center"><Link to="/" className="mute">← Home</Link></p>
      </Shell>
    </div>
  )
}
