import { useEffect, useState } from 'react'

// Company / platform mark: logo, else icon, else the first letter of the name.
export default function BrandMark({ name, logo, icon, size = 40, className = '' }) {
  const src = logo || icon
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [src])
  if (src && !bad) {
    return <span className={`logo img ${className}`} style={{ width: size, height: size }}><img src={src} alt="" onError={() => setBad(true)} /></span>
  }
  return <span className={`logo ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}>{(name || '?').trim().charAt(0).toUpperCase() || '?'}</span>
}
