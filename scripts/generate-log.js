/**
 * generate-log.js — Notes to PDF
 *
 * Generates ~/Downloads/Notes to PDF/Log.html
 * Called by status.sh on every manual run, and by launchd daily at midnight PT.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATE_FILE  = path.join(__dirname, '..', 'state', 'notes-state.json');
const LOG_FILE    = path.join(__dirname, '..', 'logs', 'notes-to-pdf.log');
const OUTPUT_ROOT = path.join(process.env.HOME, 'Downloads', 'Notes to PDF');
const HTML_OUT    = path.join(OUTPUT_ROOT, 'Log.html');

// ── Gather data ───────────────────────────────────────────────────────────────

// Service status
let serviceRunning = false;
try {
  const list = execSync('launchctl list 2>/dev/null').toString();
  serviceRunning = list.includes('com.user.notes-to-pdf');
} catch {}

// PDF + folder counts
let pdfCount = 0, folderCount = 0;
function walkCount(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'Log.html') continue; // don't count itself
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      folderCount++;
      walkCount(full);
    } else if (entry.isFile() && entry.name.endsWith('.pdf')) {
      pdfCount++;
    }
  }
}
walkCount(OUTPUT_ROOT);

// Tracked notes count
let trackedCount = 0;
try {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  trackedCount = Object.keys(state).length;
} catch {}

// Last sync summary — find the most recent "Sync complete" line
let lastSync = 'No sync recorded yet';
let lastSyncTime = '';
let lastSyncClass = '';
try {
  const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('Sync complete')) {
      lastSync = lines[i].replace(/^\[.*?\] \[INFO\] /, '');
      lastSyncTime = lines[i].match(/^\[(.*?)\]/)?.[1] || '';
      lastSyncClass = lines[i].includes('Errors: 0') ? 'ok' : 'error';
      break;
    }
  }
} catch {}

// All log lines for the activity table (most recent 100, newest first)
let logLines = [];
try {
  logLines = fs.readFileSync(LOG_FILE, 'utf8')
    .split('\n').filter(Boolean).slice(-100).reverse();
} catch {}

// Parse a log line into { time, level, message }
function parseLine(line) {
  const m = line.match(/^\[(.+?)\] \[(.+?)\] (.+)$/);
  if (!m) return { time: '', level: 'INFO', message: line };
  return { time: m[1], level: m[2], message: m[3] };
}

// Format ISO timestamp to readable PT-ish display
function fmtTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

// Color-code log messages
function msgClass(msg) {
  if (msg.startsWith('CREATED'))      return 'created';
  if (msg.startsWith('UPDATED'))      return 'updated';
  if (msg.startsWith('RENAMED'))      return 'renamed';
  if (msg.startsWith('DELETED'))      return 'deleted';
  if (msg.startsWith('Sync complete')) return 'sync';
  if (msg.startsWith('ERROR') || msg.startsWith('FATAL')) return 'error';
  return 'info';
}

const generatedAt = new Date().toLocaleString('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
}) + ' PT';

// ── Build HTML ────────────────────────────────────────────────────────────────

const logRows = logLines.map(line => {
  const { time, level, message } = parseLine(line);
  const cls = msgClass(message);
  return `<tr class="row-${cls}">
    <td class="col-time">${fmtTime(time)}</td>
    <td class="col-level">${level}</td>
    <td class="col-msg">${escHtml(message)}</td>
  </tr>`;
}).join('\n');

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Notes to PDF — Log</title>
<style>
  :root {
    --accent:  #4F46E5;
    --accent-l:#EEF2FF;
    --accent-t:#4338CA;
    --green:   #16a34a;
    --red:     #dc2626;
    --amber:   #d97706;
    --blue:    #2563eb;
    --gray:    #6b7280;
    --bg:      #f9fafb;
    --card:    #ffffff;
    --border:  #e5e7eb;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: var(--bg); color: #111; font-size: 14px; }

  /* Header */
  .header { background: var(--accent); color: #fff; padding: 20px 32px; display: flex; align-items: center; justify-content: space-between; }
  .header h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.2px; }
  .header .generated { font-size: 11px; color: rgba(255,255,255,0.65); }

  /* Cards row */
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 24px 32px 0; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; }
  .card .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--gray); margin-bottom: 6px; }
  .card .value { font-size: 26px; font-weight: 700; color: #111; line-height: 1; }
  .card .sub   { font-size: 11px; color: var(--gray); margin-top: 4px; }
  .card.service .value { font-size: 14px; font-weight: 600; }
  .card.service .value.running { color: var(--green); }
  .card.service .value.stopped { color: var(--red); }

  /* Last sync bar */
  .sync-bar { margin: 16px 32px 0; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 12px 20px; display: flex; align-items: center; gap: 10px; }
  .sync-bar .sync-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--gray); flex-shrink: 0; }
  .sync-bar .sync-text  { font-size: 13px; color: #333; }
  .sync-bar .sync-time  { margin-left: auto; font-size: 11px; color: var(--gray); white-space: nowrap; }
  .sync-bar.ok    { border-left: 4px solid var(--green); }
  .sync-bar.error { border-left: 4px solid var(--red); }

  /* Log table */
  .section { padding: 20px 32px 32px; }
  .section h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--gray); margin-bottom: 10px; }
  .log-table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; font-size: 12.5px; }
  .log-table th { background: var(--accent-l); color: var(--accent-t); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 14px; text-align: left; border-bottom: 1px solid var(--border); }
  .log-table td { padding: 7px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  .log-table tr:last-child td { border-bottom: none; }
  .col-time  { color: var(--gray); white-space: nowrap; width: 180px; }
  .col-level { white-space: nowrap; width: 60px; font-weight: 600; }
  .col-msg   { word-break: break-word; }

  /* Row colors */
  .row-created .col-msg  { color: var(--green); }
  .row-updated .col-msg  { color: var(--blue); }
  .row-renamed .col-msg  { color: #7c3aed; }
  .row-deleted .col-msg  { color: var(--red); }
  .row-sync    { background: var(--accent-l); }
  .row-sync .col-msg     { color: var(--accent-t); font-weight: 600; }
  .row-error .col-msg    { color: var(--red); font-weight: 600; }
  .row-error .col-level  { color: var(--red); }

  .empty { text-align: center; color: var(--gray); padding: 24px; font-style: italic; }
</style>
</head>
<body>

<div class="header">
  <h1>Notes to PDF — Activity Log</h1>
  <span class="generated">Generated: ${generatedAt}</span>
</div>

<div class="cards">
  <div class="card">
    <div class="label">PDFs on disk</div>
    <div class="value">${pdfCount}</div>
    <div class="sub">across ${folderCount} folders</div>
  </div>
  <div class="card">
    <div class="label">Tracked notes</div>
    <div class="value">${trackedCount}</div>
    <div class="sub">in state file</div>
  </div>
  <div class="card service">
    <div class="label">Sync service</div>
    <div class="value ${serviceRunning ? 'running' : 'stopped'}">${serviceRunning ? '● Running' : '○ Not loaded'}</div>
    <div class="sub">${serviceRunning ? 'Every 15 min, auto-starts on login' : 'Run: launchctl load ~/Library/LaunchAgents/com.user.notes-to-pdf.plist'}</div>
  </div>
  <div class="card">
    <div class="label">Output folder</div>
    <div class="value" style="font-size:12px;padding-top:4px;">~/Downloads/<br>Notes to PDF</div>
  </div>
</div>

<div class="sync-bar ${lastSyncClass}">
  <span class="sync-label">Last sync</span>
  <span class="sync-text">${escHtml(lastSync)}</span>
  <span class="sync-time">${fmtTime(lastSyncTime)}</span>
</div>

<div class="section">
  <h2>Recent activity (last 100 events, newest first)</h2>
  <table class="log-table">
    <thead>
      <tr>
        <th>Time (PT)</th>
        <th>Level</th>
        <th>Event</th>
      </tr>
    </thead>
    <tbody>
      ${logRows || `<tr><td colspan="3" class="empty">No log entries yet.</td></tr>`}
    </tbody>
  </table>
</div>

</body>
</html>`;

// ── Write file ────────────────────────────────────────────────────────────────
fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
fs.writeFileSync(HTML_OUT, html);
console.log(`Log.html updated: ${HTML_OUT}`);
