#!/usr/bin/env node
/**
 * set-sync-interval.js — Notes to PDF
 *
 * Updates the launchd plist to change how often the background sync runs.
 *
 * Usage:
 *   node scripts/set-sync-interval.js "1h"
 *   node scripts/set-sync-interval.js "every 8 hours"
 *   node scripts/set-sync-interval.js "every night"
 *   node scripts/set-sync-interval.js "30m"
 *   node scripts/set-sync-interval.js "5am 9am 11am 9pm"
 *   node scripts/set-sync-interval.js "daily at 5am, 9am, 11am and 9pm"
 *
 * Supported formats:
 *   Xm / X minutes              → every X minutes (minimum 5)
 *   Xh / X hours                → every X hours
 *   nightly / every night       → once a day at 2:00 AM
 *   daily                       → once a day at 2:00 AM
 *   one or more clock times     → exact times each day (e.g. "5am 9am 11am 9pm")
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PLIST_PATH  = path.join(process.env.HOME, 'Library', 'LaunchAgents', 'com.user.notes-to-pdf.plist');
const LABEL       = 'com.user.notes-to-pdf';
const NODE_PATH   = '/usr/local/bin/node';
const INDEX_PATH  = path.join(process.env.HOME, 'notes-to-pdf', 'src', 'index.js');
const LOG_OUT     = path.join(process.env.HOME, 'notes-to-pdf', 'logs', 'launchd-out.log');
const LOG_ERR     = path.join(process.env.HOME, 'notes-to-pdf', 'logs', 'launchd-err.log');

// ── Parse input ───────────────────────────────────────────────────────────────

const input = process.argv.slice(2).join(' ').trim().toLowerCase();

if (!input) {
  console.error('Usage: node scripts/set-sync-interval.js "<interval>"');
  console.error('Examples: "1h"  "every 8 hours"  "every night"  "30m"  "5am 9am 11am 9pm"');
  process.exit(1);
}

// ── Helper: parse clock times like "5am", "9:30pm", "17:00" ──────────────────

function parseClockTimes(str) {
  // Match patterns: 5am, 9pm, 11am, 9:30pm, 17:00, 5 am
  const timeRe = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/g;
  const times = [];
  let m;
  while ((m = timeRe.exec(str)) !== null) {
    let hour = parseInt(m[1]);
    const minute = m[2] ? parseInt(m[2]) : 0;
    const meridiem = m[3];

    if (!meridiem && hour > 23) continue; // not a valid time
    if (meridiem === 'pm' && hour !== 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) continue;

    times.push({ hour, minute });
  }
  // Deduplicate
  const seen = new Set();
  return times.filter(t => {
    const key = `${t.hour}:${t.minute}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Determine mode ────────────────────────────────────────────────────────────

let mode; // 'interval' | 'times'
let intervalSeconds;
let scheduledTimes; // array of { hour, minute }
let humanLabel;

// Fixed-interval: X hours
if (/(\d+)\s*h(our)?s?/.test(input) && !/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/.test(input)) {
  const hours = parseInt(input.match(/(\d+)\s*h/)[1]);
  if (hours < 1 || hours > 24) { console.error('Hours must be between 1 and 24.'); process.exit(1); }
  mode = 'interval';
  intervalSeconds = hours * 3600;
  humanLabel = hours === 1 ? 'every hour' : `every ${hours} hours`;
}
// Fixed-interval: X minutes
else if (/(\d+)\s*m(in(ute)?s?)?/.test(input) && !/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/.test(input)) {
  const mins = parseInt(input.match(/(\d+)\s*m/)[1]);
  if (mins < 5) { console.error('Minimum interval is 5 minutes.'); process.exit(1); }
  mode = 'interval';
  intervalSeconds = mins * 60;
  humanLabel = `every ${mins} minute${mins !== 1 ? 's' : ''}`;
}
// Nightly keyword (no clock time present)
else if (/nightly|every night/.test(input) && !/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/.test(input)) {
  mode = 'times';
  scheduledTimes = [{ hour: 2, minute: 0 }];
  humanLabel = 'every night at 2:00 AM';
}
// Daily keyword with no clock times → 2am default
else if (/\bdaily\b/.test(input) && !/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/.test(input)) {
  mode = 'times';
  scheduledTimes = [{ hour: 2, minute: 0 }];
  humanLabel = 'once a day at 2:00 AM';
}
// Clock times (one or more)
else {
  const times = parseClockTimes(input);
  if (times.length === 0) {
    console.error(`Could not parse interval: "${input}"`);
    console.error('Try: "1h", "every 8 hours", "30m", "nightly", "5am 9am 11am 9pm"');
    process.exit(1);
  }
  times.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  mode = 'times';
  scheduledTimes = times;
  humanLabel = 'daily at ' + times.map(t => {
    const h = t.hour % 12 || 12;
    const m = t.minute ? `:${String(t.minute).padStart(2, '0')}` : '';
    return `${h}${m}${t.hour < 12 ? 'am' : 'pm'}`;
  }).join(', ');
}

// ── Build plist XML ───────────────────────────────────────────────────────────

function plistHeader() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${INDEX_PATH}</string>
  </array>
`;
}

function plistFooter() {
  return `
  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${LOG_OUT}</string>

  <key>StandardErrorPath</key>
  <string>${LOG_ERR}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${process.env.HOME}</string>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
`;
}

function buildIntervalPlist(seconds) {
  return plistHeader() +
    `  <key>StartInterval</key>\n  <integer>${seconds}</integer>\n` +
    plistFooter();
}

function buildTimesPlist(times) {
  // Single time: use a plain dict. Multiple times: use an array of dicts.
  let calendarBlock;
  if (times.length === 1) {
    calendarBlock =
      `  <key>StartCalendarInterval</key>\n` +
      `  <dict>\n` +
      `    <key>Hour</key>\n    <integer>${times[0].hour}</integer>\n` +
      `    <key>Minute</key>\n    <integer>${times[0].minute}</integer>\n` +
      `  </dict>\n`;
  } else {
    const entries = times.map(t =>
      `    <dict>\n` +
      `      <key>Hour</key>\n      <integer>${t.hour}</integer>\n` +
      `      <key>Minute</key>\n      <integer>${t.minute}</integer>\n` +
      `    </dict>`
    ).join('\n');
    calendarBlock =
      `  <key>StartCalendarInterval</key>\n` +
      `  <array>\n${entries}\n  </array>\n`;
  }
  return plistHeader() + calendarBlock + plistFooter();
}

// ── Write plist + reload launchd ──────────────────────────────────────────────

const newPlist = mode === 'interval'
  ? buildIntervalPlist(intervalSeconds)
  : buildTimesPlist(scheduledTimes);

try {
  execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, { stdio: 'ignore' });
} catch { /* not loaded — fine */ }

fs.writeFileSync(PLIST_PATH, newPlist);

try {
  execSync(`launchctl load "${PLIST_PATH}"`);
} catch (err) {
  console.error(`Failed to reload launchd agent: ${err.message}`);
  process.exit(1);
}

console.log(`✓ Background sync updated — now runs ${humanLabel}.`);
if (mode === 'times') {
  const nextTime = scheduledTimes.find(t => {
    const now = new Date();
    return t.hour > now.getHours() || (t.hour === now.getHours() && t.minute > now.getMinutes());
  }) || scheduledTimes[0];
  const h = nextTime.hour % 12 || 12;
  const m = nextTime.minute ? `:${String(nextTime.minute).padStart(2, '0')}` : '';
  const period = nextTime.hour < 12 ? 'AM' : 'PM';
  console.log(`  Next run: ${h}${m} ${period}${!scheduledTimes.find(t => t.hour > new Date().getHours()) ? ' tomorrow' : ' today'}.`);
} else {
  const nextMins = Math.round(intervalSeconds / 60);
  console.log(`  Next run: within the next ${nextMins < 60 ? nextMins + ' min' : Math.round(nextMins / 60) + 'h'}.`);
}
