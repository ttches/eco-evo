import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Static frame of the animated glorp favicon, matching public/favicon.svg.
// Grid mirrors the 16x16 SVG viewBox; each cell is one game pixel at the
// default camera magnification (GLORP_RADIUS 12 * startZoom 0.25 ~= 6px).
const GRID = 16
const SCALE = 2
const GLORP = '#3d8752'

const hexToRgb = (hex) => {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

const fillRect = (grid, x, y, width, height, [r, g, b]) => {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      const offset = (row * GRID + col) * 4
      grid[offset] = r
      grid[offset + 1] = g
      grid[offset + 2] = b
      grid[offset + 3] = 0xff
    }
  }
}

const buildGrid = () => {
  const grid = new Uint8Array(GRID * GRID * 4)
  const color = hexToRgb(GLORP)
  fillRect(grid, 6, 5, 4, 1, color)
  fillRect(grid, 5, 6, 6, 4, color)
  fillRect(grid, 6, 10, 4, 1, color)
  return grid
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (buffer) => {
  let c = 0xffffffff
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

const encodePng = (grid) => {
  const size = GRID * SCALE
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // color type: RGBA
  header[10] = 0 // compression
  header[11] = 0 // filter
  header[12] = 0 // interlace

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let row = 0; row < size; row += 1) {
    const sourceRow = Math.floor(row / SCALE)
    const target = row * (stride + 1)
    raw[target] = 0 // filter type: none
    for (let col = 0; col < size; col += 1) {
      const sourceCol = Math.floor(col / SCALE)
      const source = (sourceRow * GRID + sourceCol) * 4
      const offset = target + 1 + col * 4
      raw[offset] = grid[source]
      raw[offset + 1] = grid[source + 1]
      raw[offset + 2] = grid[source + 2]
      raw[offset + 3] = grid[source + 3]
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const output = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'public',
  'favicon.png',
)
writeFileSync(output, encodePng(buildGrid()))
console.log(`wrote ${output} (${GRID * SCALE}x${GRID * SCALE})`)
