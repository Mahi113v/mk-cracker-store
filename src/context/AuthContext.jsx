import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api, { tokenKey } from '../api'

const Ctx = createContext()
export const useAuth = () => useContext(Ctx)

// One login per scope: each company has its own login, the platform admin has another
export function AuthProvider({ children }) {
  const scope = useLocation().pathname.split('/')[1] || ''
  const [st, setSt] = useState({ scope: null, user: null })

  useEffect(() => {
    let alive = true
    const tk = scope && localStorage.getItem(tokenKey(scope))
    if (!tk) { setSt({ scope, user: null }); return }
    api.get(scope === 'platform' ? '/api/platform/me' : '/api/auth/me')
      .then((r) => alive && setSt({ scope, user: r.data.user }))
      .catch(() => { localStorage.removeItem(tokenKey(scope)); alive && setSt({ scope, user: null }) })
    return () => { alive = false }
  }, [scope])

  const loading = st.scope !== scope
  const user = loading ? null : st.user

  const finish = (data) => {
    localStorage.setItem(tokenKey(scope), data.token)
    setSt({ scope, user: data.user })
    return data.user
  }
  const login = async (email, password, mode = 'customer') => {
    const url = scope === 'platform' ? '/api/platform/login' : mode === 'admin' ? '/api/auth/admin/login' : '/api/auth/login'
    return finish((await api.post(url, { email, password })).data)
  }
  const register = async (form) => finish((await api.post('/api/auth/register', form)).data)
  const logout = () => { localStorage.removeItem(tokenKey(scope)); setSt({ scope, user: null }) }
  const can = (p) => !!user && (user.role === 'company_admin' || (user.permissions || []).includes(p))
  const isStaff = !!user && (user.role === 'company_admin' || user.role === 'staff')

  return <Ctx.Provider value={{ user, loading, login, register, logout, can, isStaff }}>{children}</Ctx.Provider>
}
