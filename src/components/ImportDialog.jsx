import { useState } from 'react'
import api, { errMsg } from '../api'
import FileDrop from './FileDrop'
import { Modal, useUI } from './ui'

// Upload the filled price list (Excel / CSV / PDF) -> returns { items, unknown }
export default function ImportDialog({ onClose, onResult }) {
  const { toast } = useUI()
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const go = async () => {
    if (!files[0]) return toast('Choose the file first', 'warn')
    const fd = new FormData()
    fd.append('file', files[0])
    setBusy(true)
    try { const { data } = await api.post('/api/import-qty', fd); onResult(data); onClose() } catch (e) { toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal title="Upload filled price list" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={go} disabled={busy || !files.length}>{busy ? 'Reading…' : 'Read quantities'}</button></>}>
      <p className="mute" style={{ marginTop: 0 }}>Download the price list, type the quantities in the yellow <b>Qty</b> column / boxes, then upload the same file here.</p>
      <FileDrop accept=".xlsx,.csv,.pdf" icon="📄" maxMb={8} value={files} onChange={setFiles} title="Drop the Excel / PDF here or click to browse" hint=".xlsx, .csv or .pdf · up to 8 MB" />
    </Modal>
  )
}
