import { useEffect, useState } from 'react'
import api, { errMsg } from '../../api'
import { Loading, Modal, Thumb, useUI } from '../../components/ui'

function CatForm({ cat, onClose, onSaved }) {
  const { toast, preview, confirm } = useUI()
  const [name, setName] = useState(cat?.name || '')
  const [file, setFile] = useState(null)
  const [remove, setRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('name', name)
    if (file) fd.append('image', file)
    if (remove) fd.append('remove_image', '1')
    setBusy(true)
    try {
      if (cat) await api.put(`/api/admin/categories/${cat.id}`, fd); else await api.post('/api/admin/categories', fd)
      toast('Category saved'); onSaved()
    } catch (err) { toast(errMsg(err), 'err') } finally { setBusy(false) }
  }
  const url = file ? URL.createObjectURL(file) : !remove && cat?.image
  return (
    <Modal title={cat ? 'Edit category' : 'Add category'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="cform" disabled={busy}>Save</button></>}>
      <form id="cform" onSubmit={save}>
        <div className="field"><label className="f">Name *</label><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <label className="f">Image</label>
        <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files[0] || null); setRemove(false) }} />
        {url && (
          <div className="imgs-edit"><div className="ie">
            <img className="thumb" src={url} alt="" onClick={() => preview(url)} />
            <button type="button" className="rm" onClick={() => { setFile(null); setRemove(true) }}>×</button>
          </div></div>
        )}
      </form>
    </Modal>
  )
}

export default function Categories() {
  const { toast, confirm } = useUI()
  const [list, setList] = useState(null)
  const [edit, setEdit] = useState(null)
  const load = () => api.get('/api/categories').then((r) => setList(r.data))
  useEffect(() => { load() }, [])
  const del = async (c) => {
    if (!await confirm(`Delete category "${c.name}"? Its products will become uncategorised.`)) return
    try { await api.delete(`/api/admin/categories/${c.id}`); toast('Category deleted'); load() } catch (e) { toast(errMsg(e), 'err') }
  }
  return (
    <>
      <div className="row between mb"><h1>Categories</h1><button className="btn primary" onClick={() => setEdit({})}>+ Add category</button></div>
      {!list ? <Loading /> : (
        <div className="card flush tbl-wrap"><table className="tbl">
          <thead><tr><th>Image</th><th>Name</th><th className="num">Products</th><th /></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="4" className="empty">No categories yet</td></tr>}
            {list.map((c) => (
              <tr key={c.id}>
                <td><Thumb images={[c.image]} w={52} h={40} /></td><td><b>{c.name}</b></td><td className="num">{c.products_count}</td>
                <td className="num"><button className="btn sm" onClick={() => setEdit(c)}>Edit</button> <button className="btn sm danger" onClick={() => del(c)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {edit && <CatForm key={edit.id || 'new'} cat={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}
