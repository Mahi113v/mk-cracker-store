import { useEffect, useState } from 'react'
import api, { errMsg } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Empty, Loading, Modal, Thumb, fmtDateTime, imgs, useUI } from '../../components/ui'

const TYPE_LABEL = { IN: ['Stock In', 'green'], OUT: ['Stock Out', 'red'], SET: ['Set / Correction', 'blue'], ORDER: ['Customer order', 'amber'], CANCEL: ['Order cancelled', 'green'] }

function AdjustModal({ product, onClose, onSaved }) {
  const { toast } = useUI()
  const [type, setType] = useState('IN')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const n = parseInt(qty, 10)
  const after = Number.isInteger(n) ? (type === 'IN' ? product.stock + n : type === 'OUT' ? product.stock - n : n) : null

  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      await api.post('/api/admin/stock/adjust', { product_id: product.id, type, qty: n, reason })
      toast('Stock updated'); onSaved()
    } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal title="Stock adjustment" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="sform" disabled={busy || after === null || after < 0}>Update stock</button></>}>
      <div className="row mb" style={{ flexWrap: 'nowrap' }}><Thumb images={imgs(product)} w={56} /><div><b>{product.name}</b><div className="mute">{product.code} · Current stock: <b>{product.stock}</b></div></div></div>
      <form id="sform" onSubmit={save}>
        <div className="tabs">
          {[['IN', '＋ Stock In'], ['OUT', '－ Stock Out'], ['SET', '＝ Set exact']].map(([k, l]) => (
            <button type="button" key={k} className={`tab${type === k ? ' on' : ''}`} onClick={() => setType(k)}>{l}</button>
          ))}
        </div>
        <div className="field"><label className="f">{type === 'SET' ? 'New stock quantity' : 'Quantity'}</label><input className="input" type="number" min="0" required value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></div>
        <div className="field"><label className="f">Reason / note</label><input className="input" placeholder="New lot received, damaged, count correction…" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {after !== null && <p className={after < 0 ? 'err' : 'mute'}>Stock after update: <b>{after}</b>{after < 0 && ' (not allowed)'}</p>}
      </form>
    </Modal>
  )
}

export default function Stock() {
  const { can } = useAuth()
  const showStock = can('stock.view') || can('stock.manage')
  const showHist = can('stock.history')
  const canManage = can('stock.manage')
  const [tab, setTab] = useState(showStock ? 'stock' : 'moves')

  // --- current stock
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [list, setList] = useState(null)
  const [adj, setAdj] = useState(null)
  const loadStock = () => { if (showStock) api.get('/api/admin/stock', { params: { filter, search } }).then((r) => setList(r.data)) }
  useEffect(() => { const t = setTimeout(loadStock, 250); return () => clearTimeout(t) }, [filter, search])

  // --- history with date + product filter
  const [products, setProducts] = useState([])
  const [h, setH] = useState({ product_id: '', type: '', from: '', to: '' })
  const [moves, setMoves] = useState(null)
  useEffect(() => { if (showHist) api.get('/api/products').then((r) => setProducts(r.data)) }, [])
  useEffect(() => {
    if (!showHist || tab !== 'moves') return
    setMoves(null)
    const params = Object.fromEntries(Object.entries(h).filter(([, v]) => v))
    api.get('/api/admin/stock/movements', { params }).then((r) => setMoves(r.data))
  }, [h, tab])

  const totalIn = (moves || []).filter((m) => m.qty > 0).reduce((s, m) => s + m.qty, 0)
  const totalOut = (moves || []).filter((m) => m.qty < 0).reduce((s, m) => s - m.qty, 0)
  const setHF = (k) => (e) => setH({ ...h, [k]: e.target.value })

  return (
    <>
      <h1 className="mb">Stock</h1>
      <div className="tabs">
        {showStock && <button className={`tab${tab === 'stock' ? ' on' : ''}`} onClick={() => setTab('stock')}>Current stock</button>}
        {showHist && <button className={`tab${tab === 'moves' ? ' on' : ''}`} onClick={() => setTab('moves')}>Stock history</button>}
      </div>

      {tab === 'stock' && showStock && (
        <>
          <div className="row mb">
            <input className="input" style={{ maxWidth: 260 }} placeholder="Search name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {[['', 'All'], ['low', 'Low stock'], ['out', 'Out of stock']].map(([k, l]) => (
              <button key={k} className={`tab${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          {!list ? <Loading /> : (
            <div className="card flush tbl-wrap"><table className="tbl">
              <thead><tr><th>Image</th><th>Code</th><th>Product</th><th>Category</th><th className="num">Stock</th><th className="num">Alert at</th><th /></tr></thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan="7"><Empty>Nothing here.</Empty></td></tr>}
                {list.map((p) => (
                  <tr key={p.id}>
                    <td><Thumb images={imgs(p)} w={40} /></td><td className="mute">{p.code}</td><td><b>{p.name}</b> <span className="mute">{p.pack}</span></td><td>{p.category}</td>
                    <td className="num"><span className={`badge ${p.stock <= 0 ? 'red' : p.stock <= p.low_stock_level ? 'amber' : 'green'}`}>{p.stock}</span></td>
                    <td className="num mute">{p.low_stock_level}</td>
                    <td className="num">{canManage && <button className="btn sm primary" onClick={() => setAdj(p)}>Adjust</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </>
      )}

      {tab === 'moves' && showHist && (
        <>
          <div className="card filters mb">
            <div className="field"><label className="f">Product</label>
              <select className="input" value={h.product_id} onChange={setHF('product_id')}>
                <option value="">All products</option>{products.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select></div>
            <div className="field"><label className="f">Type</label>
              <select className="input" value={h.type} onChange={setHF('type')}>
                <option value="">All types</option>{Object.entries(TYPE_LABEL).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
            <div className="field"><label className="f">From date</label><input className="input" type="date" value={h.from} onChange={setHF('from')} /></div>
            <div className="field"><label className="f">To date</label><input className="input" type="date" value={h.to} onChange={setHF('to')} /></div>
            <div className="field"><label className="f">&nbsp;</label><button className="btn" onClick={() => setH({ product_id: '', type: '', from: '', to: '' })}>Clear filters</button></div>
          </div>
          {!moves ? <Loading /> : (
            <>
              <div className="mute mb">{moves.length} record(s) · Added <b style={{ color: 'var(--green)' }}>+{totalIn}</b> · Reduced <b style={{ color: 'var(--red)' }}>−{totalOut}</b></div>
              <div className="card flush tbl-wrap"><table className="tbl">
                <thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="num">Change</th><th className="num">Balance</th><th>Reason</th><th>By</th></tr></thead>
                <tbody>
                  {moves.length === 0 && <tr><td colSpan="7"><Empty>No stock movements for this filter.</Empty></td></tr>}
                  {moves.map((m) => { const [l, c] = TYPE_LABEL[m.type]; return (
                    <tr key={m.id}>
                      <td className="mute">{fmtDateTime(m.created_at)}</td><td><b>{m.name}</b> <span className="mute">{m.code}</span></td>
                      <td><span className={`badge ${c}`}>{l}</span></td>
                      <td className="num" style={{ color: m.qty < 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>{m.qty > 0 ? '+' : ''}{m.qty}</td>
                      <td className="num">{m.balance}</td><td>{m.reason}</td><td className="mute">{m.user_name}</td>
                    </tr>) })}
                </tbody>
              </table></div>
            </>
          )}
        </>
      )}

      {adj && <AdjustModal product={adj} onClose={() => setAdj(null)} onSaved={() => { setAdj(null); loadStock() }} />}
    </>
  )
}
