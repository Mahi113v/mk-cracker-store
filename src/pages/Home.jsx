import { useEffect, useState } from 'react'
import { Link } from '../components/nav'
import api from '../api'
import ProductCard from '../components/ProductCard'
import { Loading, Thumb } from '../components/ui'

export default function Home() {
  const [info, setInfo] = useState({})
  const [cats, setCats] = useState([])
  const [products, setProducts] = useState(null)

  useEffect(() => {
    api.get('/api/settings').then((r) => setInfo(r.data))
    api.get('/api/categories').then((r) => setCats(r.data))
    api.get('/api/products').then((r) => setProducts(r.data))
  }, [])

  const bg = info.banner_image ? { backgroundImage: `url(${info.banner_image})` } : {}
  return (
    <>
      <section className={`hero${info.banner_image ? ' img' : ''}`} style={bg}>
        {!info.banner_image && (
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
            {cats.map((c) => (
              <div className="cat" key={c.id}>
                {c.image ? <Thumb images={[c.image]} w={112} h={84} /> : <Link to={`/products?category=${c.id}`}><div className="thumb ph">🎆</div></Link>}
                <Link to={`/products?category=${c.id}`}>{c.name}</Link>
              </div>
            ))}
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
