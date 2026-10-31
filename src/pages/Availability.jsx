import { useEffect, useState } from 'react'
import api from '../api'
import { Empty, Loading, Thumb, imgs, inr, stockInfo } from '../components/ui'

export default function Availability() {
  const [all, setAll] = useState(null)
  const [q, setQ] = useState('')
  useEffect(() => { api.get('/api/products').then((r) => setAll(r.data)) }, [])
  if (!all) return <Loading />
  const s = q.toLowerCase()
  const list = all.filter((p) => !s || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s))
  return (
    <>
      <h1 className="mb">Check Availability</h1>
      <input className="input mb" style={{ maxWidth: 420 }} placeholder="Type product name or code…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card flush tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Product</th><th>Code</th><th>Pack</th><th className="num">Price</th><th>Availability</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="5"><Empty>No product found.</Empty></td></tr>}
            {list.map((p) => { const st = stockInfo(p); return (
              <tr key={p.id}>
                <td><div className="row" style={{ flexWrap: 'nowrap' }}><Thumb images={imgs(p)} w={36} />{p.name}</div></td>
                <td className="mute">{p.code}</td><td>{p.pack}</td><td className="num">{inr(p.price)}</td>
                <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
              </tr>) })}
          </tbody>
        </table>
      </div>
    </>
  )
}
