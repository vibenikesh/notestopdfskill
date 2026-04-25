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
 *   node scripts/set-sync-interval.js "nightly"
 *
 * Supported formats:
 *   Xm / X minutes        → every X minutes (minimum 5)
 *   Xh / X hours          → every X hours
 *   nightly / every night → once a day at 2:00 AM
 *   daily                 → once a day at 2:00 AM
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
  console.error('Examples: "1h"  "every 8 hours"  "every night"  "30m"  "nightly"');
  process.exit(1);
}

let mode; // 'interval' | 'nightly'
let intervalSeconds;
let humanLabel;

// Nightly / daily
if (/nightly|every night|daily|once a day/.test(input)) {
  mode = 'nightly';
  humanLabel = 'every night at 2:00 AM';
}
// X hours  /  Xh
else if (/(\d+)\s*h(our)?s?/.test(input)) {
  const hours = parseInt(input.match(/(\d+)\s*h/)[1]);
  if (hours < 1 || hours > 24) {
    console.error('Hours must be between 1 and 24.');
    process.exit(1);
  }
  mode = 'interval';
  intervalSeconds = hours * 3600;
  humanLabel = hours === 1 ? 'every hour' : `every ${hours} hours`;
}
// X minutes  /  Xm
else if (/(\d+)\s*m(in(ute)?s?)?/.test(input)) {
  const mins = parseInt(input.match(/(\d+)\s*m/)[1]);
  if (mins < 5) {
    console.error('Minimum interval is 5 minutes.');
    process.exit(1);
  }
  mode = 'interval';
  intervalSeconds = mins * 60;
  humanLabel = `every ${mins} minute${mins !== 1 ? 's' : ''}`;
}
else {
  console.error(`Could not parse interval: "${input}"`);
  console.error('Try: "1h", "every 8 hours", "30m", "nightly"');
  process.exit(1);
}

// ── Build plist XML ───────────────────────────────────────────────────────────

function buildIntervalPlist(seconds) {
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

  <key>StartInterval</key>
  <integer>${seconds}</integer>

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

function buildNightlyPlist() {
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

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

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

// ── Write plist + reload launchd ──────────────────────────────────────────────

const newPlist = mode === 'nightly' ? buildNightlyPlist() : buildIntervalPlist(intervalSeconds);

// Unload existing agent if loaded
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
if (mode === 'nightly') {
  console.log('  Next run: tonight at 2:00 AM.');
} else {
  const nextMins = Math.round(intervalSeconds / 60);
  console.log(`  Next run: within the next ${nextMins < 60 ? nextMins + ' min' : Math.round(nextMins / 60) + 'h'}.`);
}
