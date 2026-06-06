// Generate PWA PNG icons from the existing app icon (public/icons/icon.ico).
// Pure Node — no native deps. Decodes the 256x256 32bpp BGRA DIB stored in the
// .ico, area-downscales to each target size, and PNG-encodes the result.
// Run with: npm run gen-pwa-icons
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = join(root, 'public', 'icons')

// ── Decode the .ico (single 256x256 32bpp BGRA bottom-up DIB) ─────────────────
function decodeIco(buf) {
  const count = buf.readUInt16LE(4)
  if (count < 1) throw new Error('empty .ico')
  const dirOff = 6 // first directory entry
  const w = buf[dirOff] || 256
  const h = buf[dirOff + 1] || 256
  const dataOff = buf.readUInt32LE(dirOff + 12)
  if (buf[dataOff] === 0x89 && buf[dataOff + 1] === 0x50) {
    throw new Error('PNG-encoded .ico not supported by this script')
  }
  // BITMAPINFOHEADER
  const headerSize = buf.readUInt32LE(dataOff)
  const bitCount = buf.readUInt16LE(dataOff + 14)
  if (bitCount !== 32) throw new Error(`expected 32bpp, got ${bitCount}`)
  const pixOff = dataOff + headerSize
  // XOR bitmap: w*h BGRA, rows bottom-up
  const out = Buffer.alloc(w * h * 4) // top-down RGBA
  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y // flip vertically
    for (let x = 0; x < w; x++) {
      const s = pixOff + (srcY * w + x) * 4
      const d = (y * w + x) * 4
      out[d] = buf[s + 2] // R
      out[d + 1] = buf[s + 1] // G
      out[d + 2] = buf[s] // B
      out[d + 3] = buf[s + 3] // A
    }
  }
  return { w, h, data: out }
}

// ── Area-average downscale (RGBA, premultiplied alpha to avoid edge halos) ─────
function resize(src, size) {
  const { w: sw, h: sh, data: sd } = src
  const out = Buffer.alloc(size * size * 4)
  const sx = sw / size
  const sy = sh / size
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(y * sy)
    const y1 = Math.max(y0 + 1, Math.ceil((y + 1) * sy))
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * sx)
      const x1 = Math.max(x0 + 1, Math.ceil((x + 1) * sx))
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let yy = y0; yy < y1 && yy < sh; yy++) {
        for (let xx = x0; xx < x1 && xx < sw; xx++) {
          const s = (yy * sw + xx) * 4
          const al = sd[s + 3] / 255
          r += sd[s] * al
          g += sd[s + 1] * al
          b += sd[s + 2] * al
          a += sd[s + 3]
          n++
        }
      }
      const d = (y * size + x) * 4
      const av = a / n
      const alpha = av / 255 || 1
      out[d] = Math.round(r / n / alpha)
      out[d + 1] = Math.round(g / n / alpha)
      out[d + 2] = Math.round(b / n / alpha)
      out[d + 3] = Math.round(av)
    }
  }
  return { w: size, h: size, data: out }
}

// ── Composite a scaled icon onto a solid background (maskable safe zone) ───────
function maskable(src, size, bg, pad = 0.12) {
  const inner = Math.round(size * (1 - pad * 2))
  const scaled = resize(src, inner)
  const out = Buffer.alloc(size * size * 4)
  const [br, bgc, bb] = bg
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = br
    out[i * 4 + 1] = bgc
    out[i * 4 + 2] = bb
    out[i * 4 + 3] = 255
  }
  const off = Math.round(size * pad)
  for (let y = 0; y < inner; y++) {
    for (let x = 0; x < inner; x++) {
      const s = (y * inner + x) * 4
      const a = scaled.data[s + 3] / 255
      if (a === 0) continue
      const d = ((y + off) * size + (x + off)) * 4
      out[d] = Math.round(scaled.data[s] * a + out[d] * (1 - a))
      out[d + 1] = Math.round(scaled.data[s + 1] * a + out[d + 1] * (1 - a))
      out[d + 2] = Math.round(scaled.data[s + 2] * a + out[d + 2] * (1 - a))
      out[d + 3] = 255
    }
  }
  return { w: size, h: size, data: out }
}

// ── Minimal PNG encoder (RGBA, no interlace) ──────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePng({ w, h, data }) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // filter byte 0 per scanline
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Run ───────────────────────────────────────────────────────────────────────
const src = decodeIco(readFileSync(join(iconsDir, 'icon.ico')))
const BG = [12, 14, 26] // --bg #0c0e1a

const plain = [128, 192, 256, 384, 512]
for (const s of plain) {
  writeFileSync(join(iconsDir, `icon-${s}x${s}.png`), encodePng(resize(src, s)))
  console.log(`icon-${s}x${s}.png`)
}
writeFileSync(join(iconsDir, 'icon-maskable-192x192.png'), encodePng(maskable(src, 192, BG)))
writeFileSync(join(iconsDir, 'icon-maskable-512x512.png'), encodePng(maskable(src, 512, BG)))

// Apple touch icons + MS tile use a solid background (no transparency allowed by iOS).
writeFileSync(join(iconsDir, 'apple-touch-icon.png'), encodePng(maskable(src, 180, BG, 0.06)))
for (const s of [120, 152, 167, 180]) {
  writeFileSync(join(iconsDir, `apple-icon-${s}x${s}.png`), encodePng(maskable(src, s, BG, 0.06)))
}
writeFileSync(join(iconsDir, 'ms-icon-144x144.png'), encodePng(maskable(src, 144, BG, 0.06)))
writeFileSync(join(iconsDir, 'favicon-32x32.png'), encodePng(resize(src, 32)))
console.log('maskable + apple/ms + favicon done')
