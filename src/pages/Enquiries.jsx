import { useEffect, useState } from 'react'
import { Link } from '../components/nav'
import api from '../api'
import { Empty, Loading, StatusBadge, fmtDate, inr } from '../components/ui'

const TABS = [['all', 'All Enquiries'], ['unpaid', 'Unpaid'], ['pending_verification', 'Pending Verification'], ['paid', 'Paid']]

export default function Enquiries() {
  const [orders, setOrders] = useState(null)
  const [tab, setTab] = useState('all')
  useEffect(() => { api.get('/api/orders').then((r) => setOrders(r.data)) }, [])
  if (!orders) return <Loading />
  const list = tab === 'all' ? orders : orders.filter((o) => o.status === tab || (tab === 'paid' && o.status === 'delivered'))

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1>My Enquiries</h1>
      <p className="mute mb">Track and manage your enquiries</p>
      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
            {label}{k === 'all' && ` (${orders.length})`}
          </button>
        ))}
      </div>
      {list.length === 0 && <Empty>No enquiries here yet.</Empty>}
      {list.map((o) => (
        <div className="card mb" key={o.id}>
          <div className="row between">
            <div>
              <div className="row"><h2>{o.order_no}</h2><StatusBadge status={o.status} /></div>
              <div className="mute">Enquired on {fmtDate(o.created_at)} · {o.items_count} item(s)</div>
            </div>
            <Link to={`/enquiries/${o.id}`} className="btn primary">👁 View Details</Link>
          </div>
          <div className="mt mute">Total Amount</div>
          <div className="big">{inr(o.total)}</div>
        </div>
      ))}
    </div>
  )
}
