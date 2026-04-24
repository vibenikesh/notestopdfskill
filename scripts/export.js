/**
 * export.js — Export already-generated PDFs from state to a directory or email.
 * Does NOT re-generate any PDFs; reads state/notes-state.json only.
 *
 * Usage:
 *   node scripts/export.js --all
 *   node scripts/export.js --folder Work
 *   node scripts/export.js --folder Work Personal
 *   node scripts/export.js --notes "Meeting Notes" "Project Plan"
 *   node scripts/export.js --all --out ~/Desktop/export
 *   node scripts/export.js --all --email you@example.com
 *   node scripts/export.js --folder Work --zip
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');
const archiver = require('archiver');

const { loadState } = require('../src/state');

const execFileAsync = promisify(execFile);

const DEFAULT_OUT_DIR = path.join(os.homedir(), 'Downloads', 'Notes Export');
const now = new Date();
const TODAY = now.toISOString().slice(0, 10); // YYYY-MM-DD
const TIMESTAMP = TODAY + '-' + now.toTimeString().slice(0, 8).replace(/:/g, ''); // YYYY-MM-DD-HHmmss

// ── Argument parsing ──────────────────────────────────────────────────────────

function usageError(msg) {
  if (msg) console.error(`[EXPORT] Error: ${msg}\n`);
  console.error(
    'Usage:\n' +
    '  node scripts/export.js --all [--out <dir>] [--email <addr>] [--zip]\n' +
    '  node scripts/export.js --folder <name> [<name2> ...] [--out <dir>] [--email <addr>] [--zip]\n' +
    '  node scripts/export.js --notes <title> [<title2> ...] [--out <dir>] [--email <addr>] [--zip]\n'
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    scope: null,
    folderNames: [],
    noteNames: [],
    outDir: null,
    email: null,
    forceZip: false,
  };

  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];
    if (tok === '--all') {
      args.scope = 'all';
      i++;
    } else if (tok === '--folder') {
      args.scope = 'folder';
      i++;
      while (i < argv.length && !argv[i].startsWith('--')) {
        args.folderNames.push(argv[i++]);
      }
    } else if (tok === '--notes') {
      args.scope = 'notes';
      i++;
      while (i < argv.length && !argv[i].startsWith('--')) {
        args.noteNames.push(argv[i++]);
      }
    } else if (tok === '--out') {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) usageError('--out requires a directory path');
      args.outDir = argv[++i];
      i++;
    } else if (tok === '--email') {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) usageError('--email requires an address');
      args.email = argv[++i];
      i++;
    } else if (tok === '--zip') {
      args.forceZip = true;
      i++;
    } else {
      usageError(`Unknown argument: ${tok}`);
    }
  }

  if (!args.scope) usageError('Specify a scope: --all, --folder <name>, or --notes <title>');
  if (args.scope === 'folder' && args.folderNames.length === 0) usageError('--folder requires at least one folder name');
  if (args.scope === 'notes' && args.noteNames.length === 0) usageError('--notes requires at least one note title');
  if (args.outDir && args.email) usageError('Specify only one destination: --out or --email');
  if (!args.outDir && !args.email) args.outDir = DEFAULT_OUT_DIR;

  // Expand ~ in outDir
  if (args.outDir && args.outDir.startsWith('~')) {
    args.outDir = path.join(os.homedir(), args.outDir.slice(2));
  }

  return args;
}

// ── Entry selection ───────────────────────────────────────────────────────────

function selectEntries(state, args) {
  const all = Object.values(state);
  if (args.scope === 'all') return all;

  if (args.scope === 'folder') {
    const targets = args.folderNames.map(n => n.trim().toLowerCase());
    return all.filter(e => targets.includes(e.folderName.trim().toLowerCase()));
  }

  if (args.scope === 'notes') {
    const targets = args.noteNames.map(n => n.trim().toLowerCase());
    return all.filter(e => targets.includes(e.noteName.trim().toLowerCase()));
  }

  return [];
}

// ── PDF existence check ───────────────────────────────────────────────────────

function resolveValidPdfs(entries) {
  const valid = [];
  for (const entry of entries) {
    if (fs.existsSync(entry.pdfPath)) {
      valid.push(entry);
    } else {
      console.warn(`[EXPORT] WARN: PDF not found on disk, skipping — ${entry.noteName}`);
    }
  }
  return valid;
}

// ── Filesystem helpers ────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(src, destDir) {
  const dest = path.join(destDir, path.basename(src));
  fs.copyFileSync(src, dest);
  return dest;
}

// ── Zip creation ──────────────────────────────────────────────────────────────

function createZip(entries, outDir) {
  return new Promise((resolve, reject) => {
    ensureDir(outDir);
    const zipPath = path.join(outDir, `notes-export-${TIMESTAMP}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('error', reject);
    archive.on('error', reject);
    output.on('close', () => resolve(zipPath));

    archive.pipe(output);

    for (const entry of entries) {
      const name = `${entry.folderName}/${path.basename(entry.pdfPath)}`;
      archive.file(entry.pdfPath, { name });
    }

    archive.finalize();
  });
}

// ── Email transport ───────────────────────────────────────────────────────────

/**
 * Send an email with a single file attachment.
 *
 * macOS implementation using AppleScript via Mail.app.
 * To add Windows/SMTP support: replace this function body with a nodemailer
 * call keeping the same signature (subject, attachmentPath, address).
 *
 * @param {string} subject        Email subject line
 * @param {string} attachmentPath Absolute path to the file to attach
 * @param {string} address        Recipient email address
 * @returns {Promise<void>}
 */
async function sendEmail(subject, attachmentPath, address) {
  const absPath = path.resolve(attachmentPath);
  // Escape values for AppleScript string literals
  const safeSubject = subject.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const safePath = absPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const safeAddress = address.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const script = `
tell application "Mail"
  set newMessage to make new outgoing message with properties {subject:"${safeSubject}", visible:false}
  tell newMessage
    make new to recipient with properties {address:"${safeAddress}"}
    make new attachment with properties {file name:POSIX file "${safePath}"}
  end tell
  send newMessage
end tell
  `.trim();

  await execFileAsync('osascript', ['-e', script]);
}

// ── Subject builder ───────────────────────────────────────────────────────────

function buildSubject(args) {
  if (args.scope === 'all') return 'Notes Export – All Notes';
  if (args.scope === 'folder') return `Notes Export – Folder: ${args.folderNames.join(', ')}`;
  if (args.scope === 'notes') return `Notes Export – Notes: ${args.noteNames.join(', ')}`;
  return 'Notes Export';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Load state
  const state = loadState();
  const stateEntries = Object.values(state);
  if (stateEntries.length === 0) {
    console.error('[EXPORT] No notes found in state. Run a sync first: node src/index.js');
    process.exit(1);
  }

  // Select entries matching scope
  const selected = selectEntries(state, args);
  if (selected.length === 0) {
    const knownFolders = [...new Set(stateEntries.map(e => e.folderName))].sort();
    console.error(`[EXPORT] No notes matched your scope.`);
    console.error(`[EXPORT] Known folders: ${knownFolders.join(', ')}`);
    process.exit(1);
  }

  // Verify PDFs exist on disk
  const valid = resolveValidPdfs(selected);
  if (valid.length === 0) {
    console.error('[EXPORT] No PDF files found on disk for the selected notes.');
    process.exit(1);
  }

  console.log(`[EXPORT] ${valid.length} PDF(s) selected.`);

  const useZip = args.forceZip || valid.length > 1;

  // ── Export to directory ───────────────────────────────────────────────────
  if (args.outDir) {
    ensureDir(args.outDir);

    if (useZip) {
      const zipPath = await createZip(valid, args.outDir);
      console.log(`[EXPORT] Done — ${valid.length} file(s) → ${zipPath}`);
    } else {
      const dest = copyFile(valid[0].pdfPath, args.outDir);
      console.log(`[EXPORT] Done — 1 file → ${dest}`);
    }
    return;
  }

  // ── Export via email ──────────────────────────────────────────────────────
  if (args.email) {
    let attachmentPath;

    if (useZip) {
      // Zip into a temp location then email
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-export-'));
      attachmentPath = await createZip(valid, tmpDir);
    } else {
      attachmentPath = path.resolve(valid[0].pdfPath);
    }

    const subject = buildSubject(args);
    console.log(`[EXPORT] Sending email to ${args.email}...`);
    await sendEmail(subject, attachmentPath, args.email);
    console.log(`[EXPORT] Done — ${valid.length} file(s) → ${args.email}`);
  }
}

main().catch(err => {
  console.error(`[EXPORT] Fatal: ${err.message}`);
  process.exit(1);
});
