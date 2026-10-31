import { useEffect, useState } from 'react'
import api, { errMsg } from '../../api'
import { Loading, useUI } from '../../components/ui'

export default function Brands() {
  const { toast, confirm } = useUI()
  const [list, setList] = useState(null)
  const [name, setName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const load = () => api.get('/api/brands').then((r) => setList(r.data))
  useEffect(() => { load() }, [])

  const add = async (e) => {
    e.preventDefault()
    try { await api.post('/api/admin/brands', { name }); setName(''); toast('Brand added'); load() } catch (err) { toast(errMsg(err), 'err') }
  }
  const save = async (id) => {
    try { await api.put(`/api/admin/brands/${id}`, { name: editName }); setEditId(null); toast('Brand updated'); load() } catch (err) { toast(errMsg(err), 'err') }
  }
  const del = async (b) => {
    if (!await confirm(`Delete brand "${b.name}"?`)) return
    try { await api.delete(`/api/admin/brands/${b.id}`); toast('Brand deleted'); load() } catch (err) { toast(errMsg(err), 'err') }
  }
  return (
    <>
      <h1 className="mb">Brands</h1>
      <form className="row mb" onSubmit={add}>
        <input className="input" style={{ maxWidth: 300 }} placeholder="New brand name" required value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary">+ Add brand</button>
      </form>
      {!list ? <Loading /> : (
        <div className="card flush tbl-wrap"><table className="tbl">
          <thead><tr><th>Brand</th><th /></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="2" className="empty">No brands yet</td></tr>}
            {list.map((b) => (
              <tr key={b.id}>
                <td>{editId === b.id ? <input className="input" style={{ maxWidth: 280 }} value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus /> : <b>{b.name}</b>}</td>
                <td className="num">
                  {editId === b.id ? <><button className="btn sm primary" onClick={() => save(b.id)}>Save</button> <button className="btn sm" onClick={() => setEditId(null)}>Cancel</button></>
                    : <><button className="btn sm" onClick={() => { setEditId(b.id); setEditName(b.name) }}>Edit</button> <button className="btn sm danger" onClick={() => del(b)}>Delete</button></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </>
  )
}
