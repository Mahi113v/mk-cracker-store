import { useState } from 'react'
import { downloadFile, errMsg } from '../api'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { Modal, useUI } from './ui'

// Price list download: Excel / PDF.  Admin only: Tamil PDF + one discount % for the whole list.
export default function PriceListDialog({ onClose }) {
  const { isStaff, can } = useAuth()
  const { company, has } = useCompany()
  const { toast } = useUI()
  const [fmt, setFmt] = useState('xlsx')
  const [lang, setLang] = useState('en')
  const [disc, setDisc] = useState('')
  const [busy, setBusy] = useState(false)
  const canDisc = can('discount.change') && has('quick_discount')
  const showLang = isStaff && fmt === 'pdf'

  const go = async () => {
    setBusy(true)
    try {
      const params = { format: fmt }
      if (showLang) params.lang = lang
      if (canDisc && disc !== '') params.discount = Math.min(100, Math.max(0, Number(disc) || 0))
      await downloadFile('/api/pricelist', params, `${company.code}-price-list.${fmt}`)
      toast(`Price list (${fmt === 'xlsx' ? 'Excel' : 'PDF'}) downloaded`)
      onClose()
    } catch (e) { toast(errMsg(e), 'err') } finally { setBusy(false) }
  }

  return (
    <Modal title="Download price list" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={go} disabled={busy}>{busy ? 'Preparing…' : '⬇ Download'}</button></>}>
      <label className="f">Format</label>
      <div className="choice mb">
        <button type="button" className={`ch${fmt === 'xlsx' ? ' on' : ''}`} onClick={() => setFmt('xlsx')}><span>📗</span><b>Excel</b><small>.xlsx</small></button>
        <button type="button" className={`ch${fmt === 'pdf' ? ' on' : ''}`} onClick={() => setFmt('pdf')}><span>📕</span><b>PDF</b><small>fillable Qty boxes</small></button>
      </div>

      {showLang && (
        <>
          <label className="f">PDF language <span className="mute">(admin only)</span></label>
          <div className="choice mb">
            <button type="button" className={`ch${lang === 'en' ? ' on' : ''}`} onClick={() => setLang('en')}><span>🇬🇧</span><b>English</b></button>
            <button type="button" className={`ch${lang === 'ta' ? ' on' : ''}`} onClick={() => setLang('ta')}><span>த</span><b>தமிழ்</b><small>Tamil</small></button>
          </div>
        </>
      )}

      {canDisc && (
        <div className="field">
          <label className="f">Discount % for this price list <span className="mute">(admin only, optional)</span></label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input className="input" style={{ maxWidth: 140 }} type="number" min="0" max="100" step="0.5" placeholder="e.g. 70" value={disc} onChange={(e) => setDisc(e.target.value)} />
            {disc !== '' && <button type="button" className="btn sm" onClick={() => setDisc('')}>Clear</button>}
          </div>
          <small className="mute">Leave empty to use each product&apos;s own discount. A value here is applied to every product (price = MRP − discount).</small>
        </div>
      )}
    </Modal>
  )
}
