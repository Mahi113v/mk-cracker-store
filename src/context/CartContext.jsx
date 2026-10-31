import { createContext, useContext, useEffect, useState } from 'react'

const Ctx = createContext()
export const useCart = () => useContext(Ctx)

// The cart is saved per company (key = cart_v2_<companyCode>)
export function CartProvider({ co, children }) {
  const KEY = `cart_v2_${co}`
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
  })
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(items)), [items, KEY])

  // p = product (or cart item). qty <= 0 removes it. p.price / p.discount_percent = rate used for this line.
  const setQty = (p, qty) =>
    setItems((list) => {
      const rest = list.filter((i) => i.id !== p.id)
      if (qty <= 0) return rest
      const snap = {
        id: p.id, code: p.code, name: p.name, pack: p.pack, mrp: p.mrp, price: p.price,
        discount_percent: Number(p.discount_percent) || 0, stock: p.stock, image: p.image, qty: Math.min(qty, p.stock),
      }
      const idx = list.findIndex((i) => i.id === p.id)
      if (idx >= 0) { const c = [...list]; c[idx] = snap; return c }
      return [...list, snap]
    })

  const qtyOf = (id) => items.find((i) => i.id === id)?.qty || 0
  const clear = () => setItems([])
  const total = items.reduce((s, i) => s + i.price * i.qty, 0)

  return <Ctx.Provider value={{ items, setQty, qtyOf, clear, count: items.length, total }}>{children}</Ctx.Provider>
}
