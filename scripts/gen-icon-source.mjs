// Generate the master app icon (public/icons/icon.ico): the Fair Scale — a level
// balance beam, dark ink on a gold gradient. Pure Node, software-rasterized from
// the same geometry the sidebar SVG uses (viewBox 0 0 64 64), so the favicon and
// the in-app logo can never drift. gen-pwa-icons.mjs downscales this to the PNGs.
// Run with: npm run gen-icon-source  (then npm run gen-pwa-icons)
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const SIZE = 256

// ── Geometry (viewBox units), mapped to canvas: ×4 to fill 256, then scaled to
// 0.82 about the centre for margin. Same lines/pans/apex as MainLayout's logo. ──
const VB = 4                    // 64 → 256
const SCALE = 0.82
const C = SIZE / 2
const tx = (vx) => C + (vx * VB - C) * SCALE
const ty = (vy) => C + (vy * VB - C) * SCALE
const HALF = (4 * VB * SCALE) / 2   // stroke-width 4 → half-width in canvas px
const APEX_R = 2.8 * VB * SCALE

const lines = [
  [32, 13, 32, 47], [15, 18, 49, 18], [23, 50, 41, 50],
  [15, 18, 15, 24], [49, 18, 49, 24],
].map(([x1, y1, x2, y2]) => [tx(x1), ty(y1), tx(x2), ty(y2)])

// Two pan bowls, each a quadratic bezier flattened into short segments.
function flattenQuad (p0, p1, p2, n = 28) {
  const segs = []
  let prev = p0
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
    segs.push([prev[0], prev[1], x, y])
    prev = [x, y]
  }
  return segs
}
const pans = [
  ...flattenQuad([tx(7), ty(24)], [tx(15), ty(35)], [tx(23), ty(24)]),
  ...flattenQuad([tx(41), ty(24)], [tx(49), ty(35)], [tx(57), ty(24)]),
]
const strokes = [...lines, ...pans]
const apex = [tx(32), ty(10.5)]

function distToSeg (px, py, [ax, ay, bx, by]) {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy || 1
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t   // clamp → round caps
  const cx = ax + t * dx, cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

// ── Colours ───────────────────────────────────────────────────────────────────
const GOLD_TOP = [255, 212, 121]   // #ffd479
const GOLD_BOT = [240, 181, 63]    // #f0b53f
const INK = [32, 21, 3]            // #201503
const lerp = (a, b, t) => a + (b - a) * t

// ── Rasterise to top-down RGBA, opaque ────────────────────────────────────────
const rgba = Buffer.alloc(SIZE * SIZE * 4)
for (let y = 0; y < SIZE; y++) {
  const gt = y / (SIZE - 1)
  const bgR = lerp(GOLD_TOP[0], GOLD_BOT[0], gt)
  const bgG = lerp(GOLD_TOP[1], GOLD_BOT[1], gt)
  const bgB = lerp(GOLD_TOP[2], GOLD_BOT[2], gt)
  for (let x = 0; x < SIZE; x++) {
    let cov = 0
    for (const s of strokes) {
      cov = Math.max(cov, Math.min(1, HALF + 0.5 - distToSeg(x, y, s)))
      if (cov >= 1) break
    }
    cov = Math.max(cov, Math.min(1, APEX_R + 0.5 - Math.hypot(x - apex[0], y - apex[1])))
    const d = (y * SIZE + x) * 4
    rgba[d] = Math.round(lerp(bgR, INK[0], cov))
    rgba[d + 1] = Math.round(lerp(bgG, INK[1], cov))
    rgba[d + 2] = Math.round(lerp(bgB, INK[2], cov))
    rgba[d + 3] = 255
  }
}

// ── Encode as a single-image 32bpp .ico (BGRA, bottom-up XOR + zero AND mask) ──
function encodeIco (data, size) {
  const xorSize = size * size * 4
  const andStride = ((size + 31) >> 5) << 2   // 1bpp rows padded to 4 bytes
  const andSize = andStride * size
  const dib = Buffer.alloc(40 + xorSize + andSize)
  dib.writeUInt32LE(40, 0)          // biSize
  dib.writeInt32LE(size, 4)         // biWidth
  dib.writeInt32LE(size * 2, 8)     // biHeight (XOR + AND)
  dib.writeUInt16LE(1, 12)          // biPlanes
  dib.writeUInt16LE(32, 14)         // biBitCount
  for (let y = 0; y < size; y++) {  // XOR, bottom-up BGRA
    const srcY = size - 1 - y
    for (let x = 0; x < size; x++) {
      const s = (srcY * size + x) * 4
      const d = 40 + (y * size + x) * 4
      dib[d] = data[s + 2]; dib[d + 1] = data[s + 1]; dib[d + 2] = data[s]; dib[d + 3] = data[s + 3]
    }
  }
  // AND mask left all-zero → every pixel opaque.
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
  header.writeUInt8(size >= 256 ? 0 : size, 6)
  header.writeUInt8(size >= 256 ? 0 : size, 7)
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12)
  header.writeUInt32LE(dib.length, 14); header.writeUInt32LE(22, 18)
  return Buffer.concat([header, dib])
}

writeFileSync(join(iconsDir, 'icon.ico'), encodeIco(rgba, SIZE))
console.log(`icon.ico written (${SIZE}x${SIZE}, Fair Scale on gold)`)
