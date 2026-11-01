// Theme + favicon helpers
export const setTheme = (c) => {
  const root = document.documentElement
  root.dataset.theme = c?.design || 'normal'
  if (c?.brand_color) root.style.setProperty('--red', c.brand_color); else root.style.removeProperty('--red')
}

let defaultIcon = null
export function setFavicon(href) {
  let link = document.querySelector('link[rel="icon"]')
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
  if (defaultIcon === null) defaultIcon = link.getAttribute('href') || ''
  link.removeAttribute('type')
  link.setAttribute('href', href || defaultIcon)
}
