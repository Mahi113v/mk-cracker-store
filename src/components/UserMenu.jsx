import { useEffect, useRef, useState } from 'react'
import { Link } from './nav'

const Ico = ({ d }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)
const I = {
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  clip: 'M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1zM8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  admin: 'M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z',
}

export default function UserMenu({ user, isStaff, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return undefined
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  return (
    <div className="um" ref={ref}>
      <button className="um-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Ico d={I.user} /> <span>{user.name}</span>
      </button>

      {open && (
        <div className="um-menu" role="menu">
          <div className="um-head">
            <b>{user.name}</b>
            <small>{user.phone || user.email}</small>
          </div>

          {isStaff ? (
            <Link to="/admin" className="um-item" onClick={close}><Ico d={I.admin} /> Admin Panel</Link>
          ) : (
            <>
              <Link to="/profile" className="um-item" onClick={close}><Ico d={I.user} /> My Profile</Link>
              <Link to="/enquiries" className="um-item" onClick={close}><Ico d={I.clip} /> My Enquiries</Link>
            </>
          )}

          <div className="um-sep" />
          <button className="um-item" onClick={() => { close(); onLogout() }}><Ico d={I.out} /> Sign Out</button>
        </div>
      )}
    </div>
  )
}


