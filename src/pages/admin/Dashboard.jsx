import { useEffect, useState } from 'react'
import { Link } from '../../components/nav'
import api from '../../api'
import { Loading, StatusBadge, fmtDate, inr } from '../../components/ui'

export default function Dashboard() {
  const [s, setS] = useState(null)
  useEffect(() => { api.get('/api/admin/stats').then((r) => setS(r.data)) }, [])
  if (!s) return <Loading />
  const o = s.orders
  return (
    <>
      <h1 className="mb">Dashboard</h1>
      <div className="stats">
        <div className="stat g">Today's sales<b>{inr(s.today_sales)}</b></div>
        <div className="stat g">This month<b>{inr(s.month_sales)}</b></div>
        <div className="stat g">Total revenue (paid)<b>{inr(s.revenue)}</b></div>
        <div className="stat a">Pending verification<b>{o.pending_verification || 0}</b></div>
        <div className="stat">Unpaid enquiries<b>{o.unpaid || 0}</b></div>
        <div className="stat b">Customers<b>{s.users}</b></div>
        <div className="stat">Products<b>{s.products}</b></div>
        <div className="stat a">Low stock<b>{s.low_stock}</b></div>
        <div className="stat">Out of stock<b>{s.out_of_stock}</b></div>
      </div>
      <div className="card flush">
        <div className="row between" style={{ padding: '14px 16px' }}><h3>Recent enquiries</h3><Link to="/admin/orders" className="btn sm">View all</Link></div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th className="num">Total</th><th>Status</th></tr></thead>
          <tbody>
            {s.recent.length === 0 && <tr><td colSpan="5" className="empty">No enquiries yet</td></tr>}
            {s.recent.map((r) => <tr key={r.id}><td><b>{r.order_no}</b></td><td>{r.user_name}</td><td>{fmtDate(r.created_at)}</td><td className="num">{inr(r.total)}</td><td><StatusBadge status={r.status} /></td></tr>)}
          </tbody>
        </table></div>
      </div>
    </>
  )
}
