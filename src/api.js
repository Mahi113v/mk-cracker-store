import axios from 'axios'

// URL pattern:  /<companyCode>/...  = that company's store + admin     /platform/... = platform admin
export const scopeOf = () => window.location.pathname.split('/')[1] || ''
export const tokenKey = (scope) => `token_${scope}`

const api = axios.create({ baseURL: '' })

api.interceptors.request.use((cfg) => {
  const scope = scopeOf()
  if (scope) {
    const t = localStorage.getItem(tokenKey(scope))
    if (t) cfg.headers.Authorization = `Bearer ${t}`
    if (scope !== 'platform') cfg.headers['X-Company'] = scope // this header selects the company database
  }
  return cfg
})

export const errMsg = (e) => e?.response?.data?.error || e?.message || 'Something went wrong'

// Download a file (Excel / PDF) through the API (so the company header + login token are sent)
export async function downloadFile(url, params, filename) {
  try {
    const r = await api.get(url, { params, responseType: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(r.data)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 3000)
  } catch (e) {
    if (e.response?.data instanceof Blob) {
      try { e.response.data = JSON.parse(await e.response.data.text()) } catch { /* ignore */ }
    }
    throw e
  }
}

export default api
