import { useEffect, useState } from 'react'
import { useSearchParams } from '../components/nav'
import api from '../api'
import ProductCard from '../components/ProductCard'
import { Empty, Loading } from '../components/ui'

export default function Products() {
  const [sp, setSp] = useSearchParams()
  const [all, setAll] = useState(null)
  const [cats, setCats] = useState([])
  const [brands, setBrands] = useState([])
  const [search, setSearch] = useState('')
  const category = sp.get('category') || ''
  const [brand, setBrand] = useState('')

  useEffect(() => {
    api.get('/api/products').then((r) => setAll(r.data))
    api.get('/api/categories').then((r) => setCats(r.data))
    api.get('/api/brands').then((r) => setBrands(r.data))
  }, [])

  if (!all) return <Loading />
  const s = search.toLowerCase()
  const list = all.filter((p) =>
    (!category || String(p.category_id) === category) && (!brand || String(p.brand_id) === brand) &&
    (!s || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s)))

  return (
    <>
      <div className="mb">
        <h1>All Products</h1>
        <div className="mute">Showing {list.length} of {all.length} products</div>
      </div>
      <div className="row mb">
        <input className="input grow" style={{ minWidth: 200 }} placeholder="Search by name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ width: 170 }} value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">All Brands</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="input" style={{ width: 210 }} value={category} onChange={(e) => (e.target.value ? setSp({ category: e.target.value }) : setSp({}))}>
          <option value="">All Categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {list.length === 0 ? <Empty>No products match your search.</Empty> : (
        <div className="pgrid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}
    </>
  )
}
