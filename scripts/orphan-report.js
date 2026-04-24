/**
 * Orphan Report — Notes to PDF
 *
 * Scans ~/Downloads/Notes to PDF/ and reports any PDF files on disk
 * that have no matching entry in the state file. These are "orphans" —
 * files the tool does not track and will never clean up automatically.
 *
 * Run: node ~/notes-to-pdf/scripts/orphan-report.js
 * Add --delete to remove orphans after reviewing them.
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'state', 'notes-state.json');
const OUTPUT_ROOT = path.join(process.env.HOME, 'Downloads', 'Notes to PDF');
const DELETE_MODE = process.argv.includes('--delete');

// Load state
let state = {};
try {
  state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
} catch {
  console.error('Could not read state file. Run a sync first.');
  process.exit(1);
}

// Build set of all tracked PDF paths (lowercase for case-insensitive comparison)
const trackedPaths = new Set(
  Object.values(state).map(e => e.pdfPath).filter(Boolean).map(p => p.toLowerCase())
);

// Walk the output directory and collect all PDF files
function walkPdfs(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkPdfs(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.pdf')) {
      results.push(fullPath);
    }
  }
  return results;
}

const allPdfs = walkPdfs(OUTPUT_ROOT);
const orphans = allPdfs.filter(p => !trackedPaths.has(p.toLowerCase()));

// ── Report ────────────────────────────────────────────────────────────────────
console.log('');
console.log('========================================');
console.log('  Notes to PDF — Orphan Report');
console.log('========================================');
console.log('');
console.log(`  Total PDFs on disk : ${allPdfs.length}`);
console.log(`  Tracked by tool    : ${allPdfs.length - orphans.length}`);
console.log(`  Orphans (unknown)  : ${orphans.length}`);
console.log('');

if (orphans.length === 0) {
  console.log('  No orphans found. Everything on disk is tracked.');
} else {
  if (DELETE_MODE) {
    console.log('  Mode: DELETE (--delete flag passed)');
  } else {
    console.log('  Mode: READ-ONLY (pass --delete to remove these files)');
  }
  console.log('');
  console.log('  Orphaned files:');
  console.log('  ───────────────────────────────────────');

  let deleted = 0;
  for (const orphanPath of orphans) {
    const relativePath = path.relative(OUTPUT_ROOT, orphanPath);
    const stat = fs.statSync(orphanPath);
    const sizeKb = (stat.size / 1024).toFixed(1);
    const modDate = stat.mtime.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });

    if (DELETE_MODE) {
      try {
        fs.unlinkSync(orphanPath);
        // Remove parent folder if now empty
        const parentDir = path.dirname(orphanPath);
        const remaining = fs.readdirSync(parentDir).filter(f => f.endsWith('.pdf'));
        if (remaining.length === 0) {
          try { fs.rmdirSync(parentDir); } catch {}
        }
        console.log(`  [DELETED] ${relativePath}`);
        deleted++;
      } catch (err) {
        console.log(`  [ERROR]   ${relativePath} — ${err.message}`);
      }
    } else {
      console.log(`  ${relativePath}`);
      console.log(`    Size: ${sizeKb} KB | Last modified: ${modDate}`);
    }
  }

  console.log('');
  if (DELETE_MODE) {
    console.log(`  Deleted ${deleted} of ${orphans.length} orphan(s).`);
  } else {
    console.log('  To remove all orphans, run:');
    console.log('    node ~/notes-to-pdf/scripts/orphan-report.js --delete');
  }
}

console.log('');
