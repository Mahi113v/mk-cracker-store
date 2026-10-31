// Router helpers that automatically add the company prefix:  Link to="/quick-buy"  ->  /mk/quick-buy
import * as RR from 'react-router-dom'
export * from 'react-router-dom'

export const useBase = () => {
  const { co } = RR.useParams()
  return co ? `/${co}` : ''
}
const fix = (base, to) => {
  if (typeof to !== 'string' || !to.startsWith('/') || !base) return to
  if (to === base || to.startsWith(base + '/')) return to
  return to === '/' ? base : base + to
}

export function Link({ to, ...p }) { const b = useBase(); return <RR.Link to={fix(b, to)} {...p} /> }
export function NavLink({ to, ...p }) { const b = useBase(); return <RR.NavLink to={fix(b, to)} {...p} /> }
export function Navigate({ to, ...p }) { const b = useBase(); return <RR.Navigate to={fix(b, to)} {...p} /> }
export function useNavigate() {
  const nav = RR.useNavigate()
  const b = useBase()
  return (to, opts) => (typeof to === 'string' ? nav(fix(b, to), opts) : nav(to, opts))
}
