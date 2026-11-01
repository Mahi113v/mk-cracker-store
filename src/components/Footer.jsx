import { Link } from './nav'
import { useAuth } from '../context/AuthContext'
import BrandMark from './BrandMark'

const Ic = ({ d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)
const I = {
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
}

const SOCIAL_ICON = {
  Facebook: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.5-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" /></svg>,
  Instagram: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>,
  YouTube: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.5 12 31 31 0 0 0 23 7.2zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" /></svg>,
  WhatsApp: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z" /><path d="M9 8.5c0 3 2.5 5.5 5.5 5.5l1-1.3-1.8-1-.8.6a3 3 0 0 1-1.4-1.4l.6-.8-1-1.8z" fill="currentColor" stroke="none" /></svg>,
}

const link = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)
const tel = (p) => String(p).replace(/[^\d+]/g, '')
const waUrl = (digits) => `https://wa.me/${digits.length === 10 ? '91' + digits : digits}`

// info = /api/settings data. Keys: tagline, address, phone, phone2, email, hours,
// whatsapp, facebook, instagram, youtube
export default function Footer({ name, company, info = {} }) {
  const { user } = useAuth()
  const year = new Date().getFullYear()
  const wa = String(info.whatsapp || info.phone || '').replace(/\D/g, '')
  const socials = [
    info.facebook && ['Facebook', link(info.facebook)],
    info.instagram && ['Instagram', link(info.instagram)],
    info.youtube && ['YouTube', link(info.youtube)],
    wa && ['WhatsApp', waUrl(wa)],
  ].filter(Boolean)

  return (
    <footer className="ft">
      <div className="container">
        <div className="ft-grid">
          <div>
            <div className="ft-brand">
              <BrandMark name={name} logo={company.logo} icon={company.icon} size={48} />
              <span>{name}</span>
            </div>
            <p className="ft-tag">{info.tagline || 'Light Up Your Celebrations'}</p>
            {socials.length > 0 && (
              <div className="ft-social">
                {socials.map(([label, url]) => (
                  <a key={label} href={url} target="_blank" rel="noreferrer" aria-label={label} title={label}>{SOCIAL_ICON[label]}</a>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4>Quick Links</h4>
            <Link to="/">Home</Link>
            <Link to="/products">All Products</Link>
            <Link to="/quick-buy">Quick Buy</Link>
            <Link to="/track">Track Order</Link>
          </div>

          <div>
            <h4>My Account</h4>
            {user ? (
              <>
                <Link to="/profile">My Profile</Link>
                <Link to="/enquiries">My Enquiries</Link>
                <Link to="/cart">Cart</Link>
              </>
            ) : (
              <>
                <Link to="/login">Login</Link>
                <Link to="/register">Sign up</Link>
                <Link to="/cart">Cart</Link>
              </>
            )}
          </div>

          <div>
            <h4>Contact Info</h4>
            {info.address && <div className="ft-row"><span className="ft-ic"><Ic d={I.pin} /></span><span>{info.address}</span></div>}
            {(info.phone || info.phone2) && (
              <div className="ft-row"><span className="ft-ic"><Ic d={I.phone} /></span>
                <span>
                  {info.phone && <a href={`tel:${tel(info.phone)}`}>{info.phone}</a>}
                  {info.phone2 && <><br /><a href={`tel:${tel(info.phone2)}`}>{info.phone2}</a></>}
                </span></div>
            )}
            {info.email && <div className="ft-row"><span className="ft-ic"><Ic d={I.mail} /></span><a href={`mailto:${info.email}`}>{info.email}</a></div>}
            {info.hours && <div className="ft-row"><span className="ft-ic"><Ic d={I.clock} /></span><span className="ft-open">{info.hours}</span></div>}
          </div>
        </div>

        {wa && (
          <div className="ft-cta">
            <h3>Need help with your order?</h3>
            <p>Chat with us on WhatsApp for prices, availability and safety tips.</p>
            <a className="ft-btn" href={waUrl(wa)} target="_blank" rel="noreferrer">Chat on WhatsApp</a>
          </div>
        )}

        <div className="ft-bottom">
          <span>© {year} {name}. All rights reserved.</span>
          <span><Link to="/admin/login">Admin</Link></span>
        </div>
      </div>
    </footer>
  )
}


