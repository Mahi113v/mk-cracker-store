import { Fragment, useEffect, useState } from 'react'
import { Link } from '../components/nav'
import api, { errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useCompany } from '../context/CompanyContext'
import ImportDialog from '../components/ImportDialog'
import { Empty, Loading, Stepper, Thumb, calcPrice, imgs, inr, useUI } from '../components/ui'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const clampPct = (v) => Math.min(100, Math.max(0, Number(v) || 0))

export default function QuickBuy() {
  const { items, setQty, qtyOf, count, total } = useCart()
  const { can } = useAuth()
  const { has } = useCompany()
  const { toast, alert } = useUI()
  const canDisc = can('discount.change') && has('quick_discount') // only company admin / allowed staff
  const [importOpen, setImportOpen] = useState(false)

  const [all, setAll] = useState(null)
  const [cats, setCats] = useState([])
  const [brands, setBrands] = useState([])
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [disc, setDisc] = useState({}) // product id -> discount % override (admin only)
  const [gd, setGd] = useState('')

  useEffect(() => {
    api.get('/api/products').then((r) => setAll(r.data))
    api.get('/api/categories').then((r) => setCats(r.data))
    api.get('/api/brands').then((r) => setBrands(r.data))
  }, [])

  // restore discount overrides that are already inside the cart
  useEffect(() => {
    if (!all || !canDisc) return
    const init = {}
    items.forEach((i) => {
      const p = all.find((x) => x.id === i.id)
      if (p && Number(i.discount_percent) !== Number(p.discount_percent)) init[i.id] = Number(i.discount_percent)
    })
    setDisc(init)
  }, [all, canDisc]) // eslint-disable-line

  if (!all) return <Loading />

  const dOf = (p) => (canDisc && disc[p.id] !== undefined ? disc[p.id] : Number(p.discount_percent))
  const line = (p, d = dOf(p)) => ({ ...p, discount_percent: d, price: calcPrice(p.mrp, d) })
  const reprice = (map) => items.forEach((i) => { const p = all.find((x) => x.id === i.id); if (p) setQty(line(p, map(p)), i.qty) })

  const applyAll = () => {
    if (gd === '') return toast('Enter a discount % first', 'warn')
    const d = clampPct(gd)
    const next = {}
    all.forEach((p) => { next[p.id] = d })
    setDisc(next)
    reprice(() => d)
    toast(`${d}% discount applied to all products`)
  }
  const resetAll = () => { setDisc({}); setGd(''); reprice((p) => Number(p.discount_percent)); toast('Discount reset to product discounts') }
  const changeRow = (p, v) => {
    const d = clampPct(v)
    setDisc({ ...disc, [p.id]: d })
    if (qtyOf(p.id) > 0) setQty(line(p, d), qtyOf(p.id))
  }

  // Excel / PDF upload -> fill quantities
  const applyImport = (data) => {
    let added = 0
    const notes = []
    data.items.forEach(({ code, qty }) => {
      const p = all.find((x) => x.code.toUpperCase() === code.toUpperCase())
      if (!p) return
      if (p.stock <= 0) { notes.push(`${p.code}: out of stock`); return }
      const q = Math.min(qty, p.stock)
      if (q < qty) notes.push(`${p.code}: only ${p.stock} available (file has ${qty})`)
      setQty(line(p), q)
      added++
    })
    data.unknown.forEach((c) => notes.push(`${c}: code not found`))
    if (!added && !notes.length) return toast('No quantities found in the file', 'warn')
    alert(`${added} product(s) added to cart`,
      notes.length ? `<div style="text-align:left;font-size:14px"><b>Please check:</b><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : 'Quantities were read from your file.',
      added ? 'success' : 'warning')
  }

  // search box: clear button; changing brand / category also clears the search
  const clearSearch = () => setSearch('')
  const onBrand = (v) => { setBrand(v); clearSearch() }
  const onCategory = (v) => { setCategory(v); clearSearch() }

  const s = search.toLowerCase()
  const list = all.filter((p) =>
    (!category || String(p.category_id) === category) && (!brand || String(p.brand_id) === brand) &&
    (!s || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s)))

  let lastCat = null
  let sno = 0
  const cols = canDisc ? 10 : 10
  return (
    <>
      <div className="row between mb">
        <h1>Quick Buy</h1>
        <div className="row">
          {has('import') && (
            <button className="btn outline" onClick={() => setImportOpen(true)}>⬆ Upload Excel / PDF</button>
          )}
        </div>
      </div>
      <div className="row mb">
        <div className="searchbox grow" style={{ minWidth: 200 }}>
          <input className="input" placeholder="Search by name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button type="button" className="sb-clear" onClick={clearSearch} aria-label="Clear search" title="Clear">×</button>}
        </div>
        <select className="input" style={{ width: 170 }} value={brand} onChange={(e) => onBrand(e.target.value)}>
          <option value="">All Brands</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="input" style={{ width: 210 }} value={category} onChange={(e) => onCategory(e.target.value)}>
          <option value="">All Categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {canDisc && (
        <div className="card discbar mb">
          <b>Discount</b>
          <input className="input" type="number" min="0" max="100" step="0.5" placeholder="%" value={gd} onChange={(e) => setGd(e.target.value)} style={{ width: 90 }} />
          <button className="btn primary sm" onClick={applyAll}>Apply to all</button>
          <button className="btn sm" onClick={resetAll}>Reset</button>
          <span className="mute">Amount is calculated from MRP with the discount you enter. You can also change each row.</span>
        </div>
      )}

      <div className="card flush tbl-wrap">
        <table className="tbl" style={{ minWidth: 980 }}>
          <thead>
            <tr><th>SNO</th><th>CODE</th><th>NAME</th><th>BRAND</th><th>PACK</th><th className="num">MRP</th><th>DISCOUNT</th><th className="num">PRICE</th><th>QTY</th><th className="num">AMOUNT</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={cols}><Empty>No products found.</Empty></td></tr>}
            {list.map((p) => {
              const head = p.category !== lastCat
              lastCat = p.category
              const q = qtyOf(p.id)
              const d = dOf(p)
              const price = calcPrice(p.mrp, d)
              return (
                <Fragment key={p.id}>
                  {head && <tr className="group"><td colSpan={cols}>{(p.category || 'Others').toUpperCase()}</td></tr>}
                  <tr className={`${q > 0 ? 'sel' : ''}${p.stock <= 0 ? ' dim' : ''}`}>
                    <td>{++sno}</td>
                    <td className="mute">{p.code}</td>
                    <td><div className="row" style={{ flexWrap: 'nowrap' }}><Thumb images={imgs(p)} w={34} /><span>{p.name}</span></div></td>
                    <td className="mute">{p.brand}</td>
                    <td>{p.pack}</td>
                    <td className="num strike">{inr(p.mrp)}</td>
                    <td>
                      {canDisc
                        ? <input className="input disc-in" type="number" min="0" max="100" step="0.5" value={d} onChange={(e) => changeRow(p, e.target.value)} />
                        : <span className="off-tag">{Math.round(d)}% OFF</span>}
                    </td>
                    <td className="num"><b>{inr(price)}</b></td>
                    <td>{p.stock <= 0 ? <span className="badge red">Out of stock</span> : <Stepper value={q} max={p.stock} onChange={(v) => setQty(line(p), v)} />}</td>
                    <td className="num"><b>{inr(price * q)}</b></td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onResult={applyImport} />}
      <div className="qb-sticky">
        <div className="container row between">
          <div><b>{count}</b> item{count !== 1 && 's'} selected · Total <b style={{ fontSize: 18 }}>{inr(total)}</b></div>
          <Link to="/cart" className="btn primary" style={count ? {} : { pointerEvents: 'none', opacity: 0.5 }}>Go to cart →</Link>
        </div>
      </div>
    </>
  )
}
