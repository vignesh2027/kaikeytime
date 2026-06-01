/**
 * Generates resources/icon.png — 128x128 KaikeyTime logo with "KT" monogram
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const W = 128, H = 128;

function u32be(n) {
  const b = Buffer.alloc(4); b.writeUInt32BE(n, 0); return b;
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
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const ci = Buffer.concat([t, data]);
  return Buffer.concat([u32be(data.length), t, data, u32be(crc32(ci))]);
}

const lerp = (a, b, t) => a + (b - a) * t;

// Background: deep dark gradient #0a0a14 → #1a1030
function bgColor(x, y) {
  const t = (x / W + y / H) / 2;
  return [Math.round(lerp(10, 20, t)), Math.round(lerp(10, 16, t)), Math.round(lerp(20, 48, t))];
}

// Accent gradient #38bdf8 (cyan) → #a78bfa (purple)
function accentColor(t) {
  return [
    Math.round(lerp(0x38, 0xa7, t)),
    Math.round(lerp(0xbd, 0x8b, t)),
    Math.round(lerp(0xf8, 0xfa, t)),
  ];
}

// Rounded rect background card (slightly lighter)
function inCard(px, py) {
  return inRR(px, py, 14, 14, 100, 100, 18);
}

function inRR(px, py, rx, ry, rw, rh, r) {
  if (px < rx || px > rx + rw || py < ry || py > ry + rh) return false;
  const corners = [[rx+r,ry+r],[rx+rw-r,ry+r],[rx+r,ry+rh-r],[rx+rw-r,ry+rh-r]];
  for (const [cx,cy] of corners) {
    if (px >= cx-r && px <= cx+r && py >= cy-r && py <= cy+r) {
      const dx = px-cx, dy = py-cy;
      if (dx*dx+dy*dy > r*r) return false;
    }
  }
  return true;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2-x1, dy = y2-y1, len2 = dx*dx+dy*dy;
  if (len2 === 0) return Math.hypot(px-x1, py-y1);
  const t = Math.max(0, Math.min(1, ((px-x1)*dx+(py-y1)*dy)/len2));
  return Math.hypot(px-(x1+t*dx), py-(y1+t*dy));
}

// "KT" monogram drawn with thick strokes
function inLetter(px, py) {
  const hw = 6; // half stroke width

  // K: vertical bar x=28..40, y=24..104
  if (px>=28 && px<=40 && py>=24 && py<=104) return { t: py/H };

  // K upper arm: (40,64) → (76,24)
  if (distToSegment(px, py, 40, 64, 76, 24) < hw && py<=64) return { t: py/H };

  // K lower arm: (40,64) → (76,104)
  if (distToSegment(px, py, 40, 64, 76, 104) < hw && py>=64) return { t: py/H };

  // T: horizontal bar x=52..104, y=24..36
  if (px>=52 && px<=104 && py>=24 && py<=36) return { t: 0.1 };

  // T: vertical bar x=73..85, y=24..104
  if (px>=73 && px<=85 && py>=24 && py<=104) return { t: 0.5 };

  return null;
}

const rawRows = [];
for (let y = 0; y < H; y++) {
  const row = Buffer.alloc(1 + W * 3);
  row[0] = 0;
  for (let x = 0; x < W; x++) {
    let r, g, b;
    const letter = inLetter(x, y);
    if (y < 4) {
      // top accent stripe
      const [ar,ag,ab] = accentColor(x/W); [r,g,b] = [ar,ag,ab];
    } else if (letter) {
      const [ar,ag,ab] = accentColor(letter.t);
      r = Math.min(255, ar+15); g = Math.min(255, ag+15); b = Math.min(255, ab+15);
    } else if (inCard(x, y)) {
      // card background: slightly lighter than bg
      const [br,bg_,bb] = bgColor(x, y);
      r = Math.min(255, br+8); g = Math.min(255, bg_+8); b = Math.min(255, bb+12);
    } else {
      [r,g,b] = bgColor(x, y);
    }
    row[1+x*3]=r; row[1+x*3+1]=g; row[1+x*3+2]=b;
  }
  rawRows.push(row);
}

const raw = Buffer.concat(rawRows);
const deflated = zlib.deflateSync(raw);
const png = Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR', Buffer.concat([u32be(W),u32be(H),Buffer.from([8,2,0,0,0])])),
  chunk('IDAT', deflated),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '../resources/icon.png');
fs.writeFileSync(out, png);
console.log('✓ KaikeyTime icon.png written', png.length, 'bytes');
