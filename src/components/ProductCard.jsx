import { useCart } from '../context/CartContext'
import { Stepper, Thumb, imgs, inr, stockInfo } from './ui'

export default function ProductCard({ p }) {
  const { qtyOf, setQty } = useCart()
  const q = qtyOf(p.id)
  const st = stockInfo(p)
  return (
    <div className="pcard">
      {p.discount_percent > 0 && <span className="disc">-{Math.round(p.discount_percent)}%</span>}
      <Thumb images={imgs(p)} w="100%" h={170} className="pimg" alt={p.name} />
      <div className="nm">{p.name}</div>
      <div className="pk">{p.code} · {p.pack} {p.brand && `· ${p.brand}`}</div>
      <div><span className="pr">{inr(p.price)}</span> <span className="strike">{inr(p.mrp)}</span></div>
      <span className={`badge ${st.cls}`} style={{ alignSelf: 'flex-start' }}>{st.label}</span>
      <div className="act">
        {p.stock <= 0 ? (
          <button className="btn" disabled style={{ width: '100%' }}>Out of stock</button>
        ) : q === 0 ? (
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setQty(p, 1)}>Add to cart</button>
        ) : (
          <Stepper value={q} max={p.stock} onChange={(v) => setQty(p, v)} />
        )}
      </div>
    </div>
  )
}
