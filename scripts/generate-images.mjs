// Generates the photos used by the store into public/images.
// They are generated instead of committed to keep the repository small.
// Run automatically by `pnpm install`, `pnpm dev` and `pnpm build`.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'images')

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, pixel) {
  const stride = width * 3 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y)
      const offset = y * stride + 1 + x * 3
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function noise(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)))
const mix = (a, b, t) => a + (b - a) * t

function hero() {
  const width = 1920
  const height = 1080
  const random = noise(7)
  return encodePng(width, height, (x, y) => {
    const t = y / height
    // Warm sky fading into a terracotta wall.
    let r = mix(247, 181, t)
    let g = mix(206, 83, t)
    let b = mix(160, 47, t)
    // "Sun"
    const dx = x - width * 0.72
    const dy = y - height * 0.3
    const sun = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 260)
    r = mix(r, 255, sun)
    g = mix(g, 238, sun)
    b = mix(b, 200, sun)
    // Shirts on a line
    const shirt = Math.floor(x / 240)
    const inShirt = y > 420 && y < 820 && x % 240 > 40 && x % 240 < 200
    if (inShirt) {
      const palette = [
        [236, 229, 214],
        [120, 150, 132],
        [214, 180, 140],
        [90, 110, 140],
      ][shirt % 4]
      ;[r, g, b] = palette
    }
    const grain = (random() - 0.5) * 14
    return [clamp(r + grain), clamp(g + grain), clamp(b + grain)]
  })
}

function product(index) {
  const size = 900
  const random = noise(index + 100)
  const hue = (index * 47) % 360
  const base = hslToRgb(hue, 0.35, 0.82)
  const ink = hslToRgb(hue, 0.4, 0.38)
  return encodePng(size, size, (x, y) => {
    const dx = x - size / 2
    const dy = y - size / 2
    const inShape = index % 3 === 0 ? Math.sqrt(dx * dx + dy * dy) < 280 : Math.abs(dx) < 240 && Math.abs(dy) < 300
    const [r, g, b] = inShape ? ink : base
    const grain = (random() - 0.5) * 12
    return [clamp(r + grain), clamp(g + grain), clamp(b + grain)]
  })
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

function write(path, build) {
  if (existsSync(path)) return
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, build())
  console.log(`generated ${path.replace(root + '/', '')}`)
}

write(join(outDir, 'hero.png'), hero)
for (let i = 1; i <= 12; i++) {
  write(join(outDir, 'products', `p-${i}.png`), () => product(i))
}
