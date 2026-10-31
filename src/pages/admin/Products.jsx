import { useEffect, useState } from 'react'
import api, { errMsg } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Loading, Modal, Thumb, imgs, inr, useUI } from '../../components/ui'

const EMPTY = { code: '', name: '', brand_id: '', category_id: '', pack: '', mrp: '', discount_percent: '0', stock: '0', low_stock_level: '10', description: '', is_active: '1' }

function ProductForm({ product, cats, brands, onClose, onSaved }) {
  const { toast, preview, confirm } = useUI()
  const editing = !!product
  const [f, setF] = useState(editing ? {
    ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, product[k] ?? ''])), is_active: String(product.is_active),
  } : EMPTY)
  const [existing, setExisting] = useState(product?.images || [])
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const price = Math.round((Number(f.mrp) || 0) * (100 - (Number(f.discount_percent) || 0)) / 100)

  const addFiles = (e) => { setFiles([...files, ...Array.from(e.target.files)].slice(0, 8)); e.target.value = '' }
  const removeExisting = async (img) => {
    if (!await confirm('Remove this image?')) return
    try { await api.delete(`/api/admin/products/${product.id}/images/${img.id}`); setExisting(existing.filter((i) => i.id !== img.id)); onSaved(false) } catch (e) { toast(errMsg(e), 'err') }
  }
  const makeMain = async (img) => {
    try { await api.put(`/api/admin/products/${product.id}/images/${img.id}/main`); setExisting([img, ...existing.filter((i) => i.id !== img.id)]); onSaved(false) } catch (e) { toast(errMsg(e), 'err') }
  }

  const save = async (e) => {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(f).forEach(([k, v]) => { if (!(editing && k === 'stock')) fd.append(k, v) })
    files.forEach((file) => fd.append('images', file))
    setBusy(true)
    try {
      if (editing) await api.put(`/api/admin/products/${product.id}`, fd)
      else await api.post('/api/admin/products', fd)
      toast(editing ? 'Product updated' : 'Product added')
      onSaved(true)
    } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }

  return (
    <Modal wide title={editing ? `Edit ${product.name}` : 'Add product'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="pform" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button></>}>
      <form id="pform" onSubmit={save}>
        <div className="grid3">
          <div className="field"><label className="f">Product code *</label><input className="input" required value={f.code} onChange={set('code')} placeholder="CK-0031" /></div>
          <div className="field" style={{ gridColumn: 'span 2' }}><label className="f">Name *</label><input className="input" required value={f.name} onChange={set('name')} /></div>
        </div>
        <div className="grid3">
          <div className="field"><label className="f">Category</label><select className="input" value={f.category_id} onChange={set('category_id')}><option value="">— none —</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label className="f">Brand</label><select className="input" value={f.brand_id} onChange={set('brand_id')}><option value="">— none —</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div className="field"><label className="f">Pack</label><input className="input" value={f.pack} onChange={set('pack')} placeholder="5 PCS" /></div>
        </div>
        <div className="grid3">
          <div className="field"><label className="f">MRP (₹) *</label><input className="input" type="number" min="0" step="0.01" required value={f.mrp} onChange={set('mrp')} /></div>
          <div className="field"><label className="f">Discount %</label><input className="input" type="number" min="0" max="100" step="0.01" value={f.discount_percent} onChange={set('discount_percent')} /></div>
          <div className="field"><label className="f">Selling price</label><div className="input" style={{ background: '#f6f6f8' }}><b>{inr(price)}</b></div></div>
        </div>
        <div className="grid3">
          {!editing && <div className="field"><label className="f">Opening stock</label><input className="input" type="number" min="0" value={f.stock} onChange={set('stock')} /></div>}
          <div className="field"><label className="f">Low-stock alert at</label><input className="input" type="number" min="0" value={f.low_stock_level} onChange={set('low_stock_level')} /></div>
          <div className="field"><label className="f">Status</label><select className="input" value={f.is_active} onChange={set('is_active')}><option value="1">Active (visible)</option><option value="0">Hidden</option></select></div>
        </div>
        {editing && <p className="mute" style={{ marginTop: 0 }}>To change stock use the <b>Stock</b> page so every change is recorded.</p>}
        <div className="field"><label className="f">Description</label><textarea className="input" rows="2" value={f.description} onChange={set('description')} /></div>

        <label className="f">Images (max 8, JPG/PNG/WEBP, 5 MB each). Click an image to preview.</label>
        <input type="file" accept="image/*" multiple onChange={addFiles} />
        <div className="imgs-edit">
          {existing.map((img, i) => (
            <div className="ie" key={img.id}>
              <img className="thumb" src={img.path} alt="" onClick={() => preview(existing.map((x) => x.path), i)} />
              <button type="button" className="rm" onClick={() => removeExisting(img)} aria-label="Remove">×</button>
              {i === 0 ? <span className="mk main">Main</span> : <button type="button" className="mk" onClick={() => makeMain(img)}>Make main</button>}
            </div>
          ))}
          {files.map((file, i) => (
            <div className="ie" key={i}>
              <img className="thumb" src={URL.createObjectURL(file)} alt="" onClick={() => preview(URL.createObjectURL(file))} />
              <button type="button" className="rm" onClick={() => setFiles(files.filter((_, k) => k !== i))} aria-label="Remove">×</button>
              <span className="mk">New</span>
            </div>
          ))}
        </div>
      </form>
    </Modal>
  )
}

export default function AdminProducts() {
  const { can } = useAuth()
  const manage = can('products.manage')
  const { toast, confirm } = useUI()
  const [list, setList] = useState(null)
  const [cats, setCats] = useState([])
  const [brands, setBrands] = useState([])
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState(null) // null | {} (new) | product

  const load = () => api.get('/api/admin/products', { params: { search } }).then((r) => setList(r.data))
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [search])
  useEffect(() => {
    api.get('/api/categories').then((r) => setCats(r.data))
    api.get('/api/brands').then((r) => setBrands(r.data))
  }, [])

  const del = async (p) => {
    if (!await confirm(`Delete "${p.name}" permanently? Past orders keep their item details.`)) return
    try { await api.delete(`/api/admin/products/${p.id}`); toast('Product deleted'); load() } catch (e) { toast(errMsg(e), 'err') }
  }

  return (
    <>
      <div className="row between mb">
        <h1>Products {list && <span className="mute" style={{ fontSize: 15 }}>({list.length})</span>}</h1>
        <div className="row">
          <input className="input" style={{ width: 240 }} placeholder="Search name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {manage && <button className="btn primary" onClick={() => setEdit({})}>+ Add product</button>}
        </div>
      </div>
      {!list ? <Loading /> : (
        <div className="card flush tbl-wrap">
          <table className="tbl" style={{ minWidth: 900 }}>
            <thead><tr><th>Image</th><th>Code</th><th>Name</th><th>Category</th><th>Brand</th><th>Pack</th><th className="num">MRP</th><th className="num">Disc.</th><th className="num">Price</th><th className="num">Stock</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan="12" className="empty">No products yet. Click “Add product”.</td></tr>}
              {list.map((p) => (
                <tr key={p.id}>
                  <td><Thumb images={imgs(p)} w={44} /></td>
                  <td className="mute">{p.code}</td><td><b>{p.name}</b></td><td>{p.category}</td><td>{p.brand}</td><td>{p.pack}</td>
                  <td className="num">{inr(p.mrp)}</td><td className="num">{Math.round(p.discount_percent)}%</td><td className="num"><b>{inr(p.price)}</b></td>
                  <td className="num"><span className={`badge ${p.stock <= 0 ? 'red' : p.stock <= p.low_stock_level ? 'amber' : 'green'}`}>{p.stock}</span></td>
                  <td>{p.is_active ? <span className="badge green">Active</span> : <span className="badge grey">Hidden</span>}</td>
                  <td className="num">{manage && <><button className="btn sm" onClick={() => setEdit(p)}>Edit</button> <button className="btn sm danger" onClick={() => del(p)}>Delete</button></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <ProductForm key={edit.id || 'new'} product={edit.id ? edit : null} cats={cats} brands={brands}
          onClose={() => setEdit(null)} onSaved={(close) => { load(); if (close) setEdit(null) }} />
      )}
    </>
  )
}
