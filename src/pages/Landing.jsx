import { useState } from 'react'
import { Link, useNavigate } from '../components/nav'
import { usePlatformLook } from '../components/PlatformLayout'
import BrandMark from '../components/BrandMark'

export default function Landing() {
  const nav = useNavigate()
  const b = usePlatformLook()
  const [code, setCode] = useState('')
  const go = (e) => { e.preventDefault(); if (code.trim()) nav(`/${code.trim().toLowerCase()}`) }
  return (
    <div className="landing">
      <div className="landing-card">
        <div className="auth-mark"><BrandMark name={b.name} logo={b.logo} icon={b.icon} size={64} /></div>
        <h1>{b.name}</h1>
        <p className="mute">Crackers store &amp; stock software for many companies. Enter your company code to continue.</p>
        <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={go}>
          <input className="input" placeholder="Company code (example: mk)" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          <button className="btn primary">Open</button>
        </form>
        {/* <p className="mute" style={{ fontSize: 13 }}>Demo companies: <b>mk</b> and <b>m-trio</b></p> */}
        <hr />
        <Link to="/platform/login" className="mute">Platform admin login →</Link>
      </div>
    </div>
  )
}
