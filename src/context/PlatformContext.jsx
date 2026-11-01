import { useEffect, useState } from 'react'
import api from '../api'

// Platform (super admin) branding: name, logo, icon, colour. Shared + cached.
let cache = null
const listeners = new Set()

export async function refreshBranding() {
  try {
    const { data } = await api.get('/api/platform/branding')
    cache = data
    listeners.forEach((l) => l(data))
  } catch { /* keep old */ }
}

export function usePlatformBranding() {
  const [b, setB] = useState(cache)
  useEffect(() => {
    listeners.add(setB)
    refreshBranding()
    return () => listeners.delete(setB)
  }, [])
  return b || { name: 'MK Platform', logo: null, icon: null, brand_color: '#e11d48', loading: true }
}
