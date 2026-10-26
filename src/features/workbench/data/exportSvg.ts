const PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'opacity', 'font-size', 'font-family', 'font-weight']

/** Copia del SVG con los estilos ya resueltos (sin var() ni clases) y fondo del tema. */
function standalone(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const live = [svg, ...svg.querySelectorAll('*')]
  const copy = [clone, ...clone.querySelectorAll('*')]
  live.forEach((el, i) => {
    const cs = getComputedStyle(el)
    const target = copy[i] as SVGElement
    target.setAttribute('style', PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'))
  })
  const [, , w, h] = (svg.getAttribute('viewBox') ?? '0 0 640 380').split(' ').map(Number)
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('width', '100%')
  bg.setAttribute('height', '100%')
  bg.setAttribute('style', `fill:${getComputedStyle(document.documentElement).getPropertyValue('--nx-bg').trim() || '#ffffff'}`)
  clone.insertBefore(bg, clone.firstChild)
  return new XMLSerializer().serializeToString(clone)
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportSvg(svg: SVGSVGElement, filename: string): void {
  download(new Blob([standalone(svg)], { type: 'image/svg+xml' }), `${filename}.svg`)
}

export function exportPng(svg: SVGSVGElement, filename: string, scale = 2): Promise<void> {
  const text = standalone(svg)
  const [, , w, h] = (svg.getAttribute('viewBox') ?? '0 0 640 380').split(' ').map(Number)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w! * scale
      canvas.height = h! * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('El navegador no permite dibujar en canvas.'))
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, w!, h!)
      canvas.toBlob((b) => (b ? (download(b, `${filename}.png`), resolve()) : reject(new Error('No se pudo generar el PNG.'))), 'image/png')
    }
    img.onerror = () => reject(new Error('No se pudo rasterizar el gráfico.'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`
  })
}
