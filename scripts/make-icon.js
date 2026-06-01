/**
 * Generates resources/icon.png — a 128x128 gradient "K" icon — using only Node.js built-ins.
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const W = 128, H = 128;

// ── helpers ─────────────────────────────────────────────────────────────────
function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes  = Buffer.from(type, 'ascii');
  const crcInput   = Buffer.concat([typeBytes, data]);
  return Buffer.concat([u32be(data.length), typeBytes, data, u32be(crc32(crcInput))]);
}

// ── IHDR ────────────────────────────────────────────────────────────────────
const IHDR_DATA = Buffer.concat([u32be(W), u32be(H),
  Buffer.from([8, 2, 0, 0, 0])  // bit depth=8, colorType=2 (RGB), deflate, filter, noninterlaced
]);

// ── pixel data ───────────────────────────────────────────────────────────────
// Lerp helpers
const lerp = (a, b, t) => a + (b - a) * t;

// Background gradient: top-left #0d0d1a → bottom-right #1a1a2e
function bgColor(x, y) {
  const t = (x / W + y / H) / 2;
  return [
    Math.round(lerp(0x0d, 0x1a, t)),
    Math.round(lerp(0x0d, 0x1a, t)),
    Math.round(lerp(0x1a, 0x2e, t)),
  ];
}

// Accent gradient: #a78bfa → #6366f1
function accentColor(t) {
  return [
    Math.round(lerp(0xa7, 0x63, t)),
    Math.round(lerp(0x8b, 0x66, t)),
    Math.round(lerp(0xfa, 0xf1, t)),
  ];
}

// Draw rounded rect filled — returns true if pixel (x,y) is inside
function inRoundRect(px, py, rx, ry, rw, rh, r) {
  if (px < rx || px > rx + rw || py < ry || py > ry + rh) return false;
  // corner checks
  const corners = [[rx+r, ry+r], [rx+rw-r, ry+r], [rx+r, ry+rh-r], [rx+rw-r, ry+rh-r]];
  for (const [cx, cy] of corners) {
    if (px < cx - r || px > cx + r || py < cy - r || py > cy + r) continue;
    const dx = px - cx, dy = py - cy;
    if (dx*dx + dy*dy > r*r) return false;
  }
  return true;
}

// "K" shape: vertical bar + two diagonal arms
function inK(px, py) {
  // vertical bar
  if (inRoundRect(px, py, 28, 20, 16, 88, 6)) return true;
  // upper arm: from ~(44,20) angled to (92,42) — 8px wide
  const armW = 9;
  // upper arm: (44,56) → (92,22)
  {
    const x1 = 44, y1 = 58, x2 = 96, y2 = 20;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    const nx = -dy/len, ny = dx/len;
    const t = ((px-x1)*dx + (py-y1)*dy) / (len*len);
    if (t >= 0 && t <= 1) {
      const dist = Math.abs((px-x1)*nx + (py-y1)*ny);
      if (dist < armW) return true;
    }
  }
  // lower arm: (44,58) → (96,106)
  {
    const x1 = 44, y1 = 58, x2 = 96, y2 = 106;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    const nx = -dy/len, ny = dx/len;
    const t = ((px-x1)*dx + (py-y1)*dy) / (len*len);
    if (t >= 0 && t <= 1) {
      const dist = Math.abs((px-x1)*nx + (py-y1)*ny);
      if (dist < armW) return true;
    }
  }
  return false;
}

const rawRows = [];
for (let y = 0; y < H; y++) {
  const row = Buffer.alloc(1 + W * 3);
  row[0] = 0; // filter type None
  for (let x = 0; x < W; x++) {
    let r, g, b;
    // top accent bar
    if (y < 5) {
      const [ar, ag, ab] = accentColor(x / W);
      [r, g, b] = [ar, ag, ab];
    } else if (inK(x, y)) {
      // gradient K fill
      const [ar, ag, ab] = accentColor(y / H);
      // add slight glow mixing with bg
      const [br, bg_, bb] = bgColor(x, y);
      r = Math.min(255, ar + 20);
      g = Math.min(255, ag + 20);
      b = Math.min(255, ab + 20);
    } else {
      [r, g, b] = bgColor(x, y);
    }
    row[1 + x*3]   = r;
    row[1 + x*3+1] = g;
    row[1 + x*3+2] = b;
  }
  rawRows.push(row);
}

const raw    = Buffer.concat(rawRows);
const deflated = zlib.deflateSync(raw);
const IDAT   = chunk('IDAT', deflated);

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
  chunk('IHDR', IHDR_DATA),
  IDAT,
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, '../resources/icon.png');
fs.writeFileSync(outPath, png);
console.log('✓ icon.png written', png.length, 'bytes');
