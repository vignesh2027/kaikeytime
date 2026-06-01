import { DayStats } from '../tracker/types';
import { Insight } from '../insights/InsightsEngine';

function fmtTime(s: number): string {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildWeeklyBarChart(week: DayStats[]): string {
  const max = Math.max(...week.map(d => d.activeSeconds), 1);
  const barW = 40, gap = 12, chartH = 120;
  const totalW = week.length * (barW + gap) - gap;
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const bars = week.map((day, i) => {
    const h = Math.max(4, Math.round((day.activeSeconds / max) * chartH));
    const x = i * (barW + gap);
    const y = chartH - h;
    const isToday = i === week.length - 1;
    const color = isToday ? 'url(#barGrad)' : '#2a2a3e';
    const labelDay = new Date(day.date + 'T00:00:00').getDay();
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="6" fill="${color}" class="bar"/>
      <text x="${x + barW / 2}" y="${chartH + 18}" text-anchor="middle" class="bar-label">${labels[labelDay]}</text>
      <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" class="bar-val">${day.activeSeconds > 60 ? fmtTime(day.activeSeconds) : ''}</text>
    `;
  }).join('');

  return `<svg viewBox="0 0 ${totalW} ${chartH + 28}" class="chart-svg">
    <defs>
      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#a78bfa"/>
        <stop offset="100%" stop-color="#6366f1"/>
      </linearGradient>
    </defs>
    ${bars}
  </svg>`;
}

function buildDonutChart(today: DayStats): string {
  const langs = Object.entries(today.languages)
    .sort((a, b) => b[1].activeSeconds - a[1].activeSeconds)
    .slice(0, 6);

  if (langs.length === 0) {
    return `<div class="empty-chart">No language data yet today</div>`;
  }

  const palette = ['#a78bfa', '#6366f1', '#38bdf8', '#34d399', '#f472b6', '#fb923c'];
  const total = langs.reduce((s, [, v]) => s + v.activeSeconds, 0) || 1;
  const cx = 80, cy = 80, r = 65, stroke = 28;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const slices = langs.map(([lang, stats], i) => {
    const pct = stats.activeSeconds / total;
    const dash = pct * circumference;
    const slice = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${palette[i]}"
      stroke-width="${stroke}" stroke-dasharray="${dash} ${circumference - dash}"
      stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" opacity="0.9"/>`;
    offset += dash;
    return slice;
  }).join('');

  const legend = langs.map(([lang, stats], i) => {
    const pct = Math.round((stats.activeSeconds / total) * 100);
    return `<div class="legend-item">
      <span class="legend-dot" style="background:${palette[i]}"></span>
      <span class="legend-lang">${lang}</span>
      <span class="legend-pct">${pct}%</span>
    </div>`;
  }).join('');

  return `<div class="donut-wrap">
    <svg viewBox="0 0 160 160" class="donut-svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1e1e2e" stroke-width="${stroke}"/>
      ${slices}
      <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="donut-center-val">${fmtTime(total)}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="donut-center-label">active</text>
    </svg>
    <div class="legend">${legend}</div>
  </div>`;
}

function buildHeatmap(heatmap: number[][]): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const max = Math.max(...heatmap.flat(), 1);

  const cells = heatmap.map((dayRow, d) => {
    const rowCells = dayRow.map((val, h) => {
      const intensity = val / max;
      const alpha = intensity < 0.05 ? 0 : 0.15 + intensity * 0.85;
      const mins = Math.round(val / 60);
      const tip = val > 0 ? `${days[d]} ${h}:00 — ${fmtTime(val)}` : '';
      return `<div class="hm-cell" style="background:rgba(99,102,241,${alpha.toFixed(2)})" title="${tip}"></div>`;
    }).join('');
    return `<div class="hm-row"><span class="hm-day">${days[d]}</span>${rowCells}</div>`;
  }).join('');

  const hourLabels = Array.from({ length: 24 }, (_, h) => {
    const label = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
    return `<span class="hm-hour">${h % 3 === 0 ? label : ''}</span>`;
  }).join('');

  return `<div class="heatmap-wrap">
    <div class="hm-hours-row"><span class="hm-day-spacer"></span>${hourLabels}</div>
    ${cells}
  </div>`;
}

function buildAiRatio(today: DayStats): string {
  const pct = today.totalEditedLines > 20
    ? Math.min(100, Math.round((today.aiLines / today.totalEditedLines) * 100))
    : 0;
  const angle = (pct / 100) * 180;
  const r = 55, cx = 70, cy = 70;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcEnd = (deg: number) => ({
    x: cx + r * Math.cos(toRad(180 + deg)),
    y: cy + r * Math.sin(toRad(180 + deg)),
  });
  const end = arcEnd(angle);
  const largeArc = angle > 180 ? 1 : 0;
  const startX = cx - r, startY = cy;
  const path = `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  const bgPath = `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`;

  return `<div class="ai-gauge-wrap">
    <svg viewBox="0 0 140 80" class="gauge-svg">
      <path d="${bgPath}" fill="none" stroke="#1e1e2e" stroke-width="16" stroke-linecap="round"/>
      ${pct > 0 ? `<path d="${path}" fill="none" stroke="url(#gaugeGrad)" stroke-width="16" stroke-linecap="round"/>` : ''}
      <defs>
        <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#34d399"/>
          <stop offset="100%" stop-color="#a78bfa"/>
        </linearGradient>
      </defs>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="gauge-pct">${pct}%</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="gauge-label">AI-assisted</text>
    </svg>
    <p class="ai-note">~${pct}% of lines today may be AI-generated<br><small>(detected via large single-shot insertions)</small></p>
  </div>`;
}

export function buildDashboardHtml(
  today: DayStats,
  week: DayStats[],
  month: DayStats[],
  heatmap: number[][],
  streak: number,
  longestStreak: number,
  lifetimeSeconds: number,
  insights: Insight[]
): string {
  const aiPct = today.totalEditedLines > 20
    ? Math.round((today.aiLines / today.totalEditedLines) * 100) : 0;

  const topLangs = Object.entries(today.languages)
    .sort((a, b) => b[1].activeSeconds - a[1].activeSeconds)
    .slice(0, 3)
    .map(([l]) => l).join(', ') || '—';

  const topProjects = Object.entries(today.projects)
    .sort((a, b) => b[1].activeSeconds - a[1].activeSeconds)
    .slice(0, 3);

  const weekActive = week.reduce((s, d) => s + d.activeSeconds, 0);
  const weekLines = week.reduce((s, d) => s + d.linesAdded, 0);

  const insightHtml = insights.map(i => `
    <div class="insight-card insight-${i.type}">
      <span class="insight-icon">${i.icon}</span>
      <span>${i.text}</span>
    </div>`).join('');

  const projectRows = topProjects.map(([name, stats]) => {
    const pct = today.activeSeconds > 0 ? Math.round((stats.activeSeconds / today.activeSeconds) * 100) : 0;
    return `<div class="proj-row">
      <span class="proj-name">${name}</span>
      <div class="proj-bar-bg"><div class="proj-bar-fill" style="width:${pct}%"></div></div>
      <span class="proj-time">${fmtTime(stats.activeSeconds)}</span>
    </div>`;
  }).join('');

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KaikeyTime Dashboard</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0d0d1a;--surface:#131320;--surface2:#1a1a2e;--surface3:#21213a;
    --border:#2a2a42;--accent:#6366f1;--accent2:#a78bfa;--accent3:#38bdf8;
    --green:#34d399;--pink:#f472b6;--orange:#fb923c;
    --text:#e2e8f0;--muted:#94a3b8;--subtle:#475569;
    --r:12px;--r2:8px;
  }
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;min-height:100vh}
  .shell{max-width:1100px;margin:0 auto;padding:24px 20px}

  /* Header */
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid var(--border)}
  .logo{display:flex;align-items:center;gap:10px}
  .logo-mark{width:36px;height:36px;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;letter-spacing:-1px}
  .logo-text{font-size:20px;font-weight:700;letter-spacing:-0.3px}
  .logo-text span{color:var(--accent2)}
  .privacy-badge{background:rgba(52,211,153,.12);color:var(--green);border:1px solid rgba(52,211,153,.25);padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.4px}
  .refresh-btn{background:var(--surface2);border:1px solid var(--border);color:var(--muted);padding:6px 14px;border-radius:var(--r2);cursor:pointer;font-size:13px;transition:all .15s}
  .refresh-btn:hover{border-color:var(--accent);color:var(--text)}

  /* Stat cards row */
  .stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;position:relative;overflow:hidden;transition:border-color .15s}
  .stat-card:hover{border-color:var(--accent)}
  .stat-card::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),var(--accent2));opacity:0}
  .stat-card:hover::after{opacity:1}
  .stat-label{font-size:11px;color:var(--subtle);text-transform:uppercase;letter-spacing:.8px;font-weight:600;margin-bottom:8px}
  .stat-val{font-size:28px;font-weight:800;letter-spacing:-1px;line-height:1}
  .stat-sub{font-size:11px;color:var(--muted);margin-top:4px}
  .accent-purple .stat-val{background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .accent-green .stat-val{color:var(--green)}
  .accent-cyan .stat-val{color:var(--accent3)}
  .accent-pink .stat-val{color:var(--pink)}

  /* 2-col layout */
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-bottom:18px}
  @media(max-width:750px){.grid-2,.grid-3{grid-template-columns:1fr}}

  /* Section cards */
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:20px}
  .card-full{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:20px;margin-bottom:18px}
  .card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
  .card-title{font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
  .card-badge{font-size:11px;background:var(--surface2);border:1px solid var(--border);padding:2px 8px;border-radius:10px;color:var(--muted)}

  /* Charts */
  .chart-svg{width:100%;overflow:visible}
  .bar{transition:opacity .15s}
  .bar:hover{opacity:.8}
  .bar-label{fill:var(--subtle);font-size:11px}
  .bar-val{fill:var(--muted);font-size:10px}

  /* Donut */
  .donut-wrap{display:flex;align-items:center;gap:24px}
  .donut-svg{width:160px;flex-shrink:0}
  .donut-center-val{fill:var(--text);font-size:14px;font-weight:700}
  .donut-center-label{fill:var(--subtle);font-size:10px}
  .legend{flex:1}
  .legend-item{display:flex;align-items:center;gap:8px;margin-bottom:8px}
  .legend-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
  .legend-lang{flex:1;font-size:13px;color:var(--text);font-weight:500}
  .legend-pct{font-size:13px;color:var(--muted);font-weight:600}

  /* Heatmap */
  .heatmap-wrap{width:100%;overflow-x:auto}
  .hm-hours-row{display:flex;align-items:center;margin-bottom:4px}
  .hm-day-spacer{width:32px;flex-shrink:0}
  .hm-hour{flex:1;font-size:9px;color:var(--subtle);text-align:center}
  .hm-row{display:flex;align-items:center;gap:3px;margin-bottom:3px}
  .hm-day{width:32px;font-size:10px;color:var(--subtle);flex-shrink:0;text-align:right;padding-right:6px}
  .hm-cell{flex:1;height:14px;border-radius:3px;background:var(--surface3);cursor:default;transition:transform .1s}
  .hm-cell:hover{transform:scale(1.3)}
  .empty-chart{color:var(--subtle);font-size:13px;text-align:center;padding:40px 0}

  /* AI gauge */
  .ai-gauge-wrap{text-align:center}
  .gauge-svg{width:140px;margin:0 auto;display:block}
  .gauge-pct{fill:var(--text);font-size:16px;font-weight:800}
  .gauge-label{fill:var(--subtle);font-size:9px}
  .ai-note{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.5}
  .ai-note small{color:var(--subtle)}

  /* Projects */
  .proj-row{display:flex;align-items:center;gap:12px;margin-bottom:10px}
  .proj-name{font-size:13px;font-weight:500;width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}
  .proj-bar-bg{flex:1;height:6px;background:var(--surface3);border-radius:3px;overflow:hidden}
  .proj-bar-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:3px;transition:width .6s ease}
  .proj-time{font-size:12px;color:var(--muted);width:48px;text-align:right;flex-shrink:0}

  /* Insights */
  .insights-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:18px}
  .insight-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:14px 16px;display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:1.5}
  .insight-positive{border-left:3px solid var(--green)}
  .insight-neutral{border-left:3px solid var(--accent)}
  .insight-tip{border-left:3px solid var(--orange)}
  .insight-icon{font-size:16px;flex-shrink:0;margin-top:1px}

  /* Streak */
  .streak-display{display:flex;align-items:center;gap:16px}
  .streak-num{font-size:48px;font-weight:900;letter-spacing:-2px;background:linear-gradient(90deg,var(--orange),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .streak-info{flex:1}
  .streak-title{font-size:14px;font-weight:600;margin-bottom:4px}
  .streak-sub{font-size:12px;color:var(--muted)}
  .streak-dots{display:flex;gap:4px;margin-top:8px}
  .streak-dot{width:12px;height:12px;border-radius:50%;background:var(--surface3)}
  .streak-dot.active{background:linear-gradient(135deg,var(--orange),var(--pink))}

  /* Footer */
  .footer{margin-top:32px;padding-top:20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;color:var(--subtle);font-size:11px}
  .footer a{color:var(--accent);text-decoration:none}
  .privacy-footer{display:flex;align-items:center;gap:6px}
  .lock-icon{width:12px;height:12px;background:var(--green);border-radius:2px;display:inline-block}

  /* Animations */
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .animate{animation:fadeIn .3s ease forwards}
</style>
</head>
<body>
<div class="shell">

  <div class="header animate">
    <div class="logo">
      <div class="logo-mark">K</div>
      <div class="logo-text">Key<span>strand</span></div>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <span class="privacy-badge">🔒 100% Local</span>
      <button class="refresh-btn" onclick="vscode.postMessage({type:'requestRefresh'})">↻ Refresh</button>
    </div>
  </div>

  <!-- Today's headline stats -->
  <div class="stats-row animate">
    <div class="stat-card accent-purple">
      <div class="stat-label">Today's Focus</div>
      <div class="stat-val">${fmtTime(today.activeSeconds)}</div>
      <div class="stat-sub">active coding time</div>
    </div>
    <div class="stat-card accent-green">
      <div class="stat-label">Lines Added</div>
      <div class="stat-val">${today.linesAdded.toLocaleString()}</div>
      <div class="stat-sub">${today.filesEdited.length} files touched</div>
    </div>
    <div class="stat-card accent-cyan">
      <div class="stat-label">This Week</div>
      <div class="stat-val">${fmtTime(weekActive)}</div>
      <div class="stat-sub">${weekLines.toLocaleString()} lines</div>
    </div>
    <div class="stat-card accent-pink">
      <div class="stat-label">Top Languages</div>
      <div class="stat-val" style="font-size:18px;letter-spacing:0">${topLangs}</div>
      <div class="stat-sub">today</div>
    </div>
  </div>

  <!-- Insights -->
  ${insights.length > 0 ? `
  <div class="insights-grid animate">
    ${insightHtml}
  </div>` : ''}

  <!-- Weekly activity + Language donut -->
  <div class="grid-2 animate">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Weekly Activity</span>
        <span class="card-badge">last 7 days</span>
      </div>
      ${buildWeeklyBarChart(week)}
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Languages</span>
        <span class="card-badge">today</span>
      </div>
      ${buildDonutChart(today)}
    </div>
  </div>

  <!-- Streak + Projects + AI ratio -->
  <div class="grid-3 animate">
    <div class="card">
      <div class="card-header"><span class="card-title">Streak</span></div>
      <div class="streak-display">
        <div class="streak-num">${streak}</div>
        <div class="streak-info">
          <div class="streak-title">${streak === 1 ? 'day' : 'days'} in a row</div>
          <div class="streak-sub">Best: ${longestStreak} days</div>
          <div class="streak-dots">
            ${week.map((d, i) => `<div class="streak-dot ${d.activeSeconds > 60 ? 'active' : ''}"></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Projects</span><span class="card-badge">today</span></div>
      ${topProjects.length > 0 ? projectRows : `<div class="empty-chart" style="padding:20px 0">No project data yet</div>`}
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">AI Assist Ratio</span></div>
      ${buildAiRatio(today)}
    </div>
  </div>

  <!-- Heatmap -->
  <div class="card-full animate">
    <div class="card-header">
      <span class="card-title">Activity Heatmap</span>
      <span class="card-badge">all-time by hour</span>
    </div>
    ${buildHeatmap(heatmap)}
  </div>

  <div class="footer animate">
    <span class="privacy-footer">
      <span class="lock-icon"></span>
      All data stored locally at <code>~/.vscode/.../kaikeytime-data.json</code> — never sent anywhere.
    </span>
    <span>KaikeyTime v1.0.0 · <span style="color:var(--accent2)">lifetime: ${fmtTime(lifetimeSeconds)}</span></span>
  </div>

</div>
<script>
  const vscode = acquireVsCodeApi();
</script>
</body>
</html>`;
}
