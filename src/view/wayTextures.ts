import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three'
import type { WayType } from '../game/wayTypes'

const textures = new Map<WayType, CanvasTexture>()
/** Small, repeatable material details without additional meshes or overlays. */
export function wayTexture(kind?: WayType): CanvasTexture | null {
  if (!kind) return null
  const cached = textures.get(kind)
  if (cached) return cached
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f3f1eb'; ctx.fillRect(0, 0, 64, 64)
  // Deterministic fine grain, baked once per surface, never per-frame randomness.
  for (let n = 0; n < 380; n++) {
    const x = (n * 37 + Math.floor(n / 17) * 11) % 64, y = (n * 23 + Math.floor(n / 13) * 7) % 64
    ctx.fillStyle = n % 3 ? '#e8e6df' : '#faf8f1'
    ctx.fillRect(x, y, 1, 1)
  }
  if (kind === 'footBoard') {
    for (let y = 0; y < 64; y += 8) {
      ctx.fillStyle = y % 16 ? '#ded3bd' : '#eee1c7'; ctx.fillRect(0, y, 64, 7)
      ctx.fillStyle = '#9c907a'; ctx.fillRect(0, y + 7, 64, 1)
      ctx.fillStyle = '#c0ae90'; ctx.fillRect(8 + y % 13, y + 3, 31, 1)
      ctx.fillStyle = '#746d61'; for (const x of [5, 58]) ctx.fillRect(x, y + 3, 1, 1)
    }
  } else if (kind === 'footPaved') {
    ctx.fillStyle = '#a9a69d'; ctx.fillRect(0,0,64,64)
    for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
      ctx.fillStyle = ['#eeece4','#deddd5','#e6e2d6'][(row + col + 6) % 3]!
      ctx.fillRect(col * 16 + (row % 2) * 8 + 1, row * 8 + 1, 15, 7)
    }
  } else if (kind === 'roadPlates') {
    for (let y = 0; y < 64; y += 32) for (let x = 0; x < 64; x += 32) {
      ctx.fillStyle = '#979e9b'; ctx.fillRect(x,y,32,32)
      ctx.fillStyle = '#dadecf'; ctx.fillRect(x+1,y+1,30,30)
      ctx.fillStyle = '#a6b0a8'; for(let n=4;n<30;n+=6) ctx.fillRect(x+n,y+4,2,24)
      ctx.fillStyle = '#66716c'; for(const dx of [3,28]) for(const dy of [3,28]) ctx.fillRect(x+dx,y+dy,1,1)
    }
  } else if (kind === 'footGravel' || kind === 'roadGravel') {
    for (let n = 0; n < 160; n++) {
      ctx.fillStyle = ['#bab8ad','#fff8e5','#d6d3c7'][n%3]!
      ctx.fillRect((n*17+3)%64,(n*29+Math.floor(n/9))%64,2,2)
    }
  } else if (kind === 'roadDirt' || kind === 'footDirt') {
    ctx.fillStyle = '#d4cbbc'; ctx.fillRect(12,0,5,64); ctx.fillRect(47,0,5,64)
  } else if (kind === 'roadAsphalt') {
    ctx.fillStyle = '#dedfdd'; for(let n=0;n<150;n++) ctx.fillRect((n*31)%64,(n*19+Math.floor(n/11))%64,1,1)
  }
  const texture = new CanvasTexture(canvas)
  texture.magFilter = NearestFilter; texture.minFilter = NearestFilter
  texture.colorSpace = SRGBColorSpace; texture.generateMipmaps = false
  textures.set(kind, texture)
  return texture
}

let parkingSurface: CanvasTexture | null = null
/** Shared asphalt grain plus stall paint; tinted by the parking material, no extra line meshes. */
export function parkingTexture(): CanvasTexture {
  if (parkingSurface) return parkingSurface
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 32, 32)
  ctx.fillStyle = '#ececec'
  for (let n = 0; n < 28; n++) ctx.fillRect((n * 13 + 5) % 32, (n * 7 + 2) % 32, 1, 1)
  ctx.fillStyle = '#f7f7f2'
  ctx.fillRect(2, 2, 2, 28)
  ctx.fillRect(2, 2, 18, 2)
  ctx.fillRect(2, 15, 14, 2)
  ctx.fillRect(2, 28, 18, 2)
  const texture = new CanvasTexture(canvas)
  texture.magFilter = NearestFilter; texture.minFilter = NearestFilter
  texture.colorSpace = SRGBColorSpace; texture.generateMipmaps = false
  parkingSurface = texture
  return texture
}
