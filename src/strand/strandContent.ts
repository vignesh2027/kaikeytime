function fmtTime(s: number): string {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface StrandData {
  label: string;
  period: string;
  totalSeconds: number;
  totalLines: number;
  aiPct: number;
  topLangName: string;
  topLangPct: number;
  topLangs: [string, number][];
  streak: number;
  longestStreak: number;
  filesCount: number;
  activeDays: number;
}

type Theme = 'dark' | 'neon' | 'ocean' | 'forest';

const THEMES: Record<Theme, {
  bg1: string; bg2: string; bg3: string;
  accent1: string; accent2: string; accent3: string;
  text: string; muted: string; border: string;
  cardBg: string; glow: string;
}> = {
  dark: {
    bg1: '#0d0d1a', bg2: '#131325', bg3: '#1a1a2e',
    accent1: '#a78bfa', accent2: '#6366f1', accent3: '#38bdf8',
    text: '#f1f5f9', muted: '#94a3b8', border: '#2a2a45',
    cardBg: '#1a1a2e', glow: 'rgba(99,102,241,0.3)',
  },
  neon: {
    bg1: '#000000', bg2: '#050510', bg3: '#0a0a1a',
    accent1: '#00ffcc', accent2: '#00e5ff', accent3: '#7c3aed',
    text: '#ffffff', muted: '#a0ffd6', border: '#00ffcc33',
    cardBg: '#0a0a20', glow: 'rgba(0,255,204,0.4)',
  },
  ocean: {
    bg1: '#030b1a', bg2: '#061428', bg3: '#0a1f3c',
    accent1: '#38bdf8', accent2: '#0ea5e9', accent3: '#6ee7b7',
    text: '#e0f2fe', muted: '#7dd3fc', border: '#1e3a5f',
    cardBg: '#0d1f35', glow: 'rgba(56,189,248,0.3)',
  },
  forest: {
    bg1: '#030f07', bg2: '#061a0c', bg3: '#0a2412',
    accent1: '#4ade80', accent2: '#22c55e', accent3: '#a3e635',
    text: '#f0fdf4', muted: '#86efac', border: '#14532d',
    cardBg: '#0d2218', glow: 'rgba(74,222,128,0.3)',
  },
};

export function buildStrandHtml(data: StrandData, theme: Theme): string {
  const t = THEMES[theme];

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KaikeyTime Strand Card</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{
    background:#080810;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    display:flex;flex-direction:column;align-items:center;min-height:100vh;
    padding:24px 16px;gap:20px;
  }
  .controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center}
  .btn{
    background:#1a1a2e;border:1px solid #2a2a42;color:#e2e8f0;
    padding:8px 18px;border-radius:8px;cursor:pointer;font-size:13px;
    transition:all .15s;font-weight:500;
  }
  .btn:hover{border-color:#6366f1;background:#21213a}
  .btn.primary{background:linear-gradient(135deg,#6366f1,#a78bfa);border-color:transparent;color:#fff}
  .btn.primary:hover{opacity:.9}
  .theme-btn{padding:6px 14px;font-size:12px}
  .theme-btn.active{border-color:#a78bfa;color:#a78bfa}
  label{color:#94a3b8;font-size:12px;margin-right:4px}
  .preview-label{color:#475569;font-size:11px;text-align:center}
  .card-wrap{position:relative}
  canvas{display:block;border-radius:16px;box-shadow:0 0 60px rgba(99,102,241,0.2),0 20px 60px rgba(0,0,0,0.6)}
</style>
</head>
<body>

<div class="controls">
  <label>Theme:</label>
  ${(['dark','neon','ocean','forest'] as Theme[]).map(th => `
    <button class="btn theme-btn ${th === theme ? 'active' : ''}" onclick="changeTheme('${th}')">${th}</button>
  `).join('')}
</div>

<div class="card-wrap">
  <canvas id="card" width="1200" height="630"></canvas>
</div>

<div class="controls">
  <button class="btn primary" onclick="saveCard()">⬇ Save as PNG</button>
  <span class="preview-label">1200 × 630 · Share on LinkedIn, X, or anywhere</span>
</div>

<script>
const vscode = acquireVsCodeApi();
const data = ${JSON.stringify(data)};
const themes = ${JSON.stringify(THEMES)};
let currentTheme = ${JSON.stringify(theme)};

function changeTheme(t) {
  currentTheme = t;
  vscode.postMessage({ type: 'changeTheme', theme: t });
}

function fmtTime(s) {
  if (s < 60) return s + 's';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

function drawCard(theme) {
  const canvas = document.getElementById('card');
  const ctx = canvas.getContext('2d');
  const W = 1200, H = 630;
  const t = themes[theme];

  // --- Background ---
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, t.bg1);
  bg.addColorStop(0.5, t.bg2);
  bg.addColorStop(1, t.bg3);
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 0);
  ctx.fill();

  // Subtle grid overlay
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.globalAlpha = 1;

  // Radial glow top-left
  const glow = ctx.createRadialGradient(200, 150, 0, 200, 150, 400);
  glow.addColorStop(0, t.glow);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Radial glow bottom-right
  const glow2 = ctx.createRadialGradient(W - 200, H - 100, 0, W - 200, H - 100, 350);
  glow2.addColorStop(0, t.glow.replace('0.3', '0.15').replace('0.4', '0.2'));
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // --- Top accent bar ---
  const accentBar = ctx.createLinearGradient(0, 0, W, 0);
  accentBar.addColorStop(0, t.accent1);
  accentBar.addColorStop(1, t.accent2);
  ctx.fillStyle = accentBar;
  ctx.fillRect(0, 0, W, 4);

  // --- Logo / header ---
  ctx.fillStyle = t.text;
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('KaikeyTime', 56, 72);

  // Lock badge
  ctx.fillStyle = t.cardBg;
  roundRect(ctx, 56, 86, 140, 26, 13);
  ctx.fill();
  ctx.fillStyle = t.accent3;
  ctx.font = '12px sans-serif';
  ctx.fillText('🔒 Local · Private', 66, 103);

  // Period label top-right
  ctx.fillStyle = t.muted;
  ctx.font = '600 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(data.label, W - 56, 72);
  ctx.textAlign = 'left';

  // --- Main headline stat (focus time) ---
  const gradText = ctx.createLinearGradient(56, 0, 500, 0);
  gradText.addColorStop(0, t.accent1);
  gradText.addColorStop(1, t.accent2);
  ctx.fillStyle = gradText;
  ctx.font = 'bold 96px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.letterSpacing = '-4px';
  ctx.fillText(fmtTime(data.totalSeconds), 56, 230);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = t.muted;
  ctx.font = '500 22px sans-serif';
  ctx.fillText('focused', 56, 264);

  // --- Stat pills row ---
  const stats = [
    { val: data.totalLines.toLocaleString(), label: 'lines written' },
    { val: data.streak + '-day', label: 'streak 🔥' },
    { val: data.topLangPct + '%', label: data.topLangName },
    { val: data.aiPct + '%', label: 'AI-assisted ≈' },
    { val: data.filesCount.toString(), label: 'files touched' },
  ];

  const pillY = 310;
  let pillX = 56;
  const pillH = 64;
  const pillPadX = 22;
  const pillGap = 14;

  for (const stat of stats) {
    const w = Math.max(120, ctx.measureText(stat.val).width + ctx.measureText(stat.label).width + pillPadX * 2 + 20);
    ctx.fillStyle = t.cardBg;
    ctx.strokeStyle = t.border;
    ctx.lineWidth = 1;
    roundRect(ctx, pillX, pillY, w, pillH, 12);
    ctx.fill();
    ctx.stroke();

    // Value
    const valGrad = ctx.createLinearGradient(pillX, 0, pillX + w, 0);
    valGrad.addColorStop(0, t.accent1);
    valGrad.addColorStop(1, t.accent3);
    ctx.fillStyle = valGrad;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(stat.val, pillX + pillPadX, pillY + 28);

    // Label
    ctx.fillStyle = t.muted;
    ctx.font = '500 13px sans-serif';
    ctx.fillText(stat.label, pillX + pillPadX, pillY + 48);

    pillX += w + pillGap;
    if (pillX > W - 100) break; // Don't overflow
  }

  // --- Language bar ---
  const barY = 420;
  const barH = 8;
  const barW = W - 112;
  const totalLangSecs = data.topLangs.reduce((s, [, v]) => s + v, 0) || 1;
  const langColors = [t.accent1, t.accent2, t.accent3, '#f472b6', '#fb923c'];
  let barX = 56;

  // Background
  ctx.fillStyle = t.cardBg;
  roundRect(ctx, barX, barY, barW, barH, 4);
  ctx.fill();

  // Language segments
  for (let i = 0; i < data.topLangs.length; i++) {
    const [, secs] = data.topLangs[i];
    const segW = (secs / totalLangSecs) * barW;
    ctx.fillStyle = langColors[i % langColors.length];
    ctx.globalAlpha = 0.9;
    if (i === 0) roundRectLeft(ctx, barX, barY, segW, barH, 4);
    else if (i === data.topLangs.length - 1) roundRectRight(ctx, barX, barY, segW, barH, 4);
    else { ctx.fillRect(barX, barY, segW, barH); }
    ctx.fill();
    ctx.globalAlpha = 1;
    barX += segW;
  }

  // Language legend
  let legendX = 56;
  for (let i = 0; i < Math.min(5, data.topLangs.length); i++) {
    const [lang, secs] = data.topLangs[i];
    const pct = Math.round((secs / totalLangSecs) * 100);
    ctx.fillStyle = langColors[i % langColors.length];
    roundRect(ctx, legendX, barY + 18, 10, 10, 3);
    ctx.fill();
    ctx.fillStyle = t.text;
    ctx.font = '500 13px sans-serif';
    ctx.fillText(lang, legendX + 14, barY + 27);
    ctx.fillStyle = t.muted;
    ctx.font = '12px sans-serif';
    ctx.fillText(pct + '%', legendX + 14 + ctx.measureText(lang).width + 4, barY + 27);
    legendX += 14 + ctx.measureText(lang).width + ctx.measureText(pct + '%').width + 30;
  }

  // --- Bottom section: decorative dots + branding ---
  // Dots pattern (top-right corner decoration)
  ctx.globalAlpha = 0.15;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 8; col++) {
      ctx.fillStyle = t.accent1;
      ctx.beginPath();
      ctx.arc(W - 56 - col * 20, 120 + row * 20, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Right side vertical accent
  const vAccent = ctx.createLinearGradient(0, 120, 0, H - 60);
  vAccent.addColorStop(0, t.accent1 + '00');
  vAccent.addColorStop(0.5, t.accent1 + '40');
  vAccent.addColorStop(1, t.accent1 + '00');
  ctx.fillStyle = vAccent;
  ctx.fillRect(W - 3, 120, 3, H - 180);

  // --- Branding footer ---
  const footerY = H - 44;
  ctx.fillStyle = t.border;
  ctx.fillRect(56, footerY - 12, W - 112, 1);

  ctx.fillStyle = t.muted;
  ctx.font = '500 14px sans-serif';
  ctx.fillText('made with', 56, H - 20);
  ctx.fillStyle = t.accent1;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('KaikeyTime', 56 + ctx.measureText('made with ').width, H - 20);
  ctx.fillStyle = t.muted;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Privacy-first coding analytics · All data local', W - 56, H - 20);
  ctx.textAlign = 'left';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function roundRectLeft(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function roundRectRight(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function saveCard() {
  const canvas = document.getElementById('card');
  const data = canvas.toDataURL('image/png');
  vscode.postMessage({ type: 'savePng', data });
}

// Initial draw
drawCard(currentTheme);
</script>
</body>
</html>`;
}
