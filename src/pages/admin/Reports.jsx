import { useEffect, useState } from 'react'
import api, { downloadFile, errMsg } from '../../api'
import { Empty, Loading, fmtDate, inr, useUI } from '../../components/ui'

const PERIODS = [['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['year', 'Yearly']]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const label = (period, v) => {
  if (period === 'day') return fmtDate(v)
  if (period === 'week') return `Week of ${fmtDate(v)}`
  if (period === 'month') { const [y, m] = v.split('-'); return `${MONTHS[Number(m) - 1]} ${y}` }
  return v
}
const Card = ({ title, value, cls = '' }) => <div className={`stat ${cls}`}>{title}<b>{value}</b></div>

export default function Reports() {
  const { toast } = useUI()
  const [kind, setKind] = useState('sales')
  const [period, setPeriod] = useState('day')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [scope, setScope] = useState('sales')
  const [data, setData] = useState(null)
  const [prod, setProd] = useState(null)
  const params = { period, scope, from: from || undefined, to: to || undefined }

  useEffect(() => {
    let alive = true
    setData(null); setProd(null)
    const base = `/api/admin/reports/${kind}`
    Promise.all([api.get(base, { params }), api.get(`${base}/products`, { params })])
      .then(([a, b]) => { if (alive) { setData(a.data); setProd(b.data) } })
      .catch((e) => toast(errMsg(e), 'err'))
    return () => { alive = false }
  }, [kind, period, from, to, scope]) // eslint-disable-line

  const dl = (path, name) => downloadFile(path, { ...params, format: 'xlsx' }, name).then(() => toast('Excel downloaded')).catch((e) => toast(errMsg(e), 'err'))
  const maxNet = data && kind === 'sales' ? Math.max(1, ...data.rows.map((r) => Number(r.net))) : 1
  const stockValue = prod && kind === 'stock' ? prod.rows.reduce((s, r) => s + r.value, 0) : 0

  return (
    <>
      <div className="row between mb"><h1>Reports</h1>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={`tab${kind === 'sales' ? ' on' : ''}`} onClick={() => setKind('sales')}>💰 Sales report</button>
          <button className={`tab${kind === 'stock' ? ' on' : ''}`} onClick={() => setKind('stock')}>📦 Stock report</button>
        </div>
      </div>

      <div className="card filters mb">
        <div className="field"><label className="f">Period</label>
          <div className="seg">{PERIODS.map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</div></div>
        <div className="field"><label className="f">From date</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label className="f">To date</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {kind === 'sales' && (
          <div className="field"><label className="f">Orders counted</label>
            <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}><option value="sales">Paid &amp; delivered only</option><option value="all">All (incl. unpaid / pending)</option></select></div>
        )}
        <div className="field"><label className="f">&nbsp;</label><button className="btn" onClick={() => { setFrom(''); setTo('') }}>Last range</button></div>
      </div>

      {!data || !prod ? <Loading /> : (
        <>
          <div className="mute mb">Showing {fmtDate(data.from)} → {fmtDate(data.to)}</div>
          {kind === 'sales' ? (
            <>
              <div className="stats">
                <Card title="Net sales" value={inr(data.totals.net)} cls="g" />
                <Card title="Orders" value={data.totals.orders} />
                <Card title="Qty sold" value={data.totals.qty} cls="b" />
                <Card title="Discount given" value={inr(data.totals.discount)} cls="a" />
              </div>
              <div className="row between mb"><h3>{PERIODS.find((p) => p[0] === period)[1]} sales</h3>
                <button className="btn sm" onClick={() => dl('/api/admin/reports/sales', `sales-${period}.xlsx`)}>⬇ Excel</button></div>
              <div className="card flush tbl-wrap mb"><table className="tbl">
                <thead><tr><th>Period</th><th className="num">Orders</th><th className="num">Qty</th><th className="num">MRP value</th><th className="num">Discount</th><th className="num">Net sales</th><th style={{ width: 160 }} /></tr></thead>
                <tbody>
                  {data.rows.length === 0 && <tr><td colSpan="7"><Empty>No sales in this range.</Empty></td></tr>}
                  {data.rows.map((r) => (
                    <tr key={r.period}><td><b>{label(period, r.period)}</b></td><td className="num">{r.orders}</td><td className="num">{r.qty}</td>
                      <td className="num">{inr(r.mrp_total)}</td><td className="num">{inr(r.discount)}</td><td className="num"><b>{inr(r.net)}</b></td>
                      <td><div className="bar"><i style={{ width: `${(Number(r.net) / maxNet) * 100}%` }} /></div></td></tr>
                  ))}
                </tbody>
                {data.rows.length > 0 && <tfoot><tr><td><b>TOTAL</b></td><td className="num">{data.totals.orders}</td><td className="num">{data.totals.qty}</td><td className="num">{inr(data.totals.mrp_total)}</td><td className="num">{inr(data.totals.discount)}</td><td className="num"><b>{inr(data.totals.net)}</b></td><td /></tr></tfoot>}
              </table></div>

              <div className="row between mb"><h3>Product-wise sales</h3>
                <button className="btn sm" onClick={() => dl('/api/admin/reports/sales/products', 'product-sales.xlsx')}>⬇ Excel</button></div>
              <div className="card flush tbl-wrap"><table className="tbl">
                <thead><tr><th>Code</th><th>Product</th><th className="num">Qty sold</th><th className="num">MRP value</th><th className="num">Net sales</th></tr></thead>
                <tbody>
                  {prod.rows.length === 0 && <tr><td colSpan="5"><Empty>No sales in this range.</Empty></td></tr>}
                  {prod.rows.map((r) => <tr key={r.code}><td className="mute">{r.code}</td><td>{r.name}</td><td className="num">{r.qty}</td><td className="num">{inr(r.mrp_total)}</td><td className="num"><b>{inr(r.net)}</b></td></tr>)}
                </tbody>
              </table></div>
            </>
          ) : (
            <>
              <div className="stats">
                <Card title="Stock added" value={data.totals.stock_in} cls="g" />
                <Card title="Stock removed" value={data.totals.stock_out} cls="a" />
                <Card title="Sold (orders)" value={data.totals.sold} cls="b" />
                <Card title="Stock value now" value={inr(stockValue)} />
              </div>
              <div className="row between mb"><h3>{PERIODS.find((p) => p[0] === period)[1]} stock movement</h3>
                <button className="btn sm" onClick={() => dl('/api/admin/reports/stock', `stock-${period}.xlsx`)}>⬇ Excel</button></div>
              <div className="card flush tbl-wrap mb"><table className="tbl">
                <thead><tr><th>Period</th><th className="num">Stock in</th><th className="num">Stock out</th><th className="num">Adjusted</th><th className="num">Sold</th><th className="num">Returned (cancel)</th></tr></thead>
                <tbody>
                  {data.rows.length === 0 && <tr><td colSpan="6"><Empty>No stock movement in this range.</Empty></td></tr>}
                  {data.rows.map((r) => <tr key={r.period}><td><b>{label(period, r.period)}</b></td><td className="num">{r.stock_in}</td><td className="num">{r.stock_out}</td><td className="num">{r.adjusted}</td><td className="num">{r.sold}</td><td className="num">{r.returned}</td></tr>)}
                </tbody>
                {data.rows.length > 0 && <tfoot><tr><td><b>TOTAL</b></td><td className="num">{data.totals.stock_in}</td><td className="num">{data.totals.stock_out}</td><td className="num">{data.totals.adjusted}</td><td className="num">{data.totals.sold}</td><td className="num">{data.totals.returned}</td></tr></tfoot>}
              </table></div>

              <div className="row between mb"><h3>Product-wise stock</h3>
                <button className="btn sm" onClick={() => dl('/api/admin/reports/stock/products', 'product-stock.xlsx')}>⬇ Excel</button></div>
              <div className="card flush tbl-wrap"><table className="tbl" style={{ minWidth: 900 }}>
                <thead><tr><th>Code</th><th>Product</th><th className="num">Opening</th><th className="num">In</th><th className="num">Out</th><th className="num">Adjusted</th><th className="num">Sold</th><th className="num">Returned</th><th className="num">Closing</th><th className="num">Stock now</th><th className="num">Value</th></tr></thead>
                <tbody>
                  {prod.rows.map((r) => (
                    <tr key={r.code}><td className="mute">{r.code}</td><td>{r.name}</td><td className="num">{r.opening}</td><td className="num">{r.stock_in}</td><td className="num">{r.stock_out}</td>
                      <td className="num">{r.adjusted}</td><td className="num">{r.sold}</td><td className="num">{r.returned}</td><td className="num"><b>{r.closing}</b></td><td className="num">{r.current_stock}</td><td className="num">{inr(r.value)}</td></tr>
                  ))}
                </tbody>
              </table></div>
            </>
          )}
        </>
      )}
    </>
  )
}
