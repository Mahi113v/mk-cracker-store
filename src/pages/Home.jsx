import { useEffect, useState } from 'react'
import { Link } from '../components/nav'
import api from '../api'
import { useCompany } from '../context/CompanyContext'
import ProductCard from '../components/ProductCard'
import { Loading, Thumb } from '../components/ui'

export default function Home() {
  const { company } = useCompany()
  const [info, setInfo] = useState({})
  const [cats, setCats] = useState([])
  const [products, setProducts] = useState(null)

  useEffect(() => {
    api.get('/api/settings').then((r) => setInfo(r.data))
    api.get('/api/categories').then((r) => setCats(r.data))
    api.get('/api/products').then((r) => setProducts(r.data))
  }, [])

  // Home banner: the one set in Admin > Settings, otherwise the cover image from the platform (company) record
  const banner = info.banner_image || company.image
  const bg = banner ? { backgroundImage: `url(${banner})` } : {}
  return (
    <>
      <section className={`hero${banner ? ' img' : ''}`} style={bg}>
        {!banner && (
          <div className="hero-in">
            <h1>Make your celebration unforgettable</h1>
            <p>Festival packs, bulk orders and corporate gifting at up to 75% off.</p>
            <Link to="/quick-buy" className="btn primary">⚡ Order now with Quick Buy</Link>
          </div>
        )}
      </section>

      {cats.length > 0 && (
        <section className="mt">
          <h2 className="mb">Shop by category</h2>
          <div className="cats">
            {
              cats.map((c) => (
                <Link className="cat" key={c.id} to={`/products?category=${c.id}`}>
                  {c.image ? <img className="thumb" src={c.image} alt={c.name} style={{ width: 112, height: 84 }} />
                    : <div className="thumb ph">🎆</div>}
                  <span>{c.name}</span>
                </Link>
              ))
            }
          </div>
        </section>
      )}

      <section className="mt">
        <div className="row between mb"><h2>Popular crackers</h2><Link to="/products" className="btn sm outline">View all products</Link></div>
        {!products ? <Loading /> : (
          <div className="pgrid">{products.slice(0, 12).map((p) => <ProductCard key={p.id} p={p} />)}</div>
        )}
      </section>
    </>
  )
}
