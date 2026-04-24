const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SEP = '|||';
const SECT = '###SEP###';

function osascriptFile(scriptPath) {
  return new Promise((resolve, reject) => {
    execFile('osascript', [scriptPath], { maxBuffer: 200 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

function runScript(content) {
  const tmpFile = path.join(os.tmpdir(), `notes_${Date.now()}_${Math.random().toString(36).slice(2)}.applescript`);
  fs.writeFileSync(tmpFile, content);
  return osascriptFile(tmpFile).finally(() => {
    try { fs.unlinkSync(tmpFile); } catch {}
  });
}

async function getFolderNames() {
  const raw = await runScript(`
tell application "Notes"
  set AppleScript's text item delimiters to "|||"
  set r to (name of every folder) as string
  set AppleScript's text item delimiters to ""
  r
end tell`);
  return raw.split(SEP).map(f => f.trim()).filter(f => f && f !== 'Recently Deleted');
}

async function getNoteMetaInFolder(folderName) {
  const safe = folderName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const raw = await runScript(`
tell application "Notes"
  set aFolder to folder "${safe}"
  if (count of every note in aFolder) is 0 then
    ""
  else
    set AppleScript's text item delimiters to "|||"
    set idStr to (id of every note in aFolder) as string
    set nameStr to (name of every note in aFolder) as string
    set modStr to (modification date of every note in aFolder) as string
    set creStr to (creation date of every note in aFolder) as string
    set AppleScript's text item delimiters to ""
    idStr & "###SEP###" & nameStr & "###SEP###" & modStr & "###SEP###" & creStr
  end if
end tell`);

  if (!raw) return [];

  const parts = raw.split(SECT);
  if (parts.length < 4) return [];

  const ids = parts[0].split(SEP);
  const names = parts[1].split(SEP);
  const mods = parts[2].split(SEP);
  const cres = parts[3].split(SEP);

  return ids.map((id, i) => ({
    id: id.trim(),
    name: (names[i] || 'Untitled').trim(),
    modDate: (mods[i] || '').trim(),
    creDate: (cres[i] || '').trim(),
  })).filter(n => n.id);
}

async function getNoteBody(noteId) {
  const safe = noteId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return runScript(`tell application "Notes" to get body of note id "${safe}"`);
}

function extractTags(htmlBody) {
  const plainText = htmlBody.replace(/<[^>]+>/g, ' ');
  const tagMatches = plainText.match(/#[a-zA-Z0-9_\-]+/g) || [];
  return [...new Set(tagMatches)];
}

// URL pattern: matches http/https URLs in plain text.
// Stops at whitespace, HTML chars, and common sentence-ending punctuation.
// The replace callback strips any trailing . , ; : ! ? ) ] that got captured.
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;

// Wraps bare URLs in text nodes with <a href> tags.
// Splits the HTML into alternating [text, tag, text, tag...] segments so we
// never touch URLs that are already inside an existing <a> attribute or tag.
function linkifyBody(html) {
  // Track whether we are currently inside an <a>...</a> block
  // by splitting on HTML tags and processing only text segments.
  const result = [];
  // Match either an HTML tag OR a run of non-tag text
  const tokenPattern = /(<[^>]+>)|([^<]+)/g;
  let insideAnchor = 0; // depth counter for nested tags (rare but safe)
  let token;

  while ((token = tokenPattern.exec(html)) !== null) {
    const [, tag, text] = token;

    if (tag) {
      // Track <a> open/close so we don't double-linkify existing anchors
      if (/^<a[\s>]/i.test(tag)) insideAnchor++;
      else if (/^<\/a>/i.test(tag)) insideAnchor = Math.max(0, insideAnchor - 1);
      result.push(tag);
    } else if (text) {
      if (insideAnchor > 0) {
        // Inside an existing <a> — leave text unchanged
        result.push(text);
      } else {
        // Outside any anchor — wrap bare URLs
        result.push(
          text.replace(URL_PATTERN, url => {
            // Strip trailing punctuation that was likely not part of the URL
            const clean = url.replace(/[.,;:!?)\]]+$/, '');
            const trail = url.slice(clean.length);
            return `<a href="${clean}">${clean}</a>${trail}`;
          })
        );
      }
    }
  }

  return result.join('');
}

async function readAllNoteMeta() {
  const folderNames = await getFolderNames();
  const result = {};
  for (const folder of folderNames) {
    const notes = await getNoteMetaInFolder(folder);
    if (notes.length > 0) result[folder] = notes;
  }
  return result;
}

// Standalone test
if (require.main === module) {
  (async () => {
    console.log('Reading note metadata from all folders...');
    const start = Date.now();
    const folders = await readAllNoteMeta();
    let total = 0;
    for (const [folder, notes] of Object.entries(folders)) {
      console.log(`\nFolder: ${folder} (${notes.length} notes)`);
      for (const note of notes.slice(0, 2)) {
        console.log(`  - "${note.name}" | mod: ${note.modDate}`);
      }
      if (notes.length > 2) console.log(`  ... and ${notes.length - 2} more`);
      total += notes.length;
    }
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\nTotal: ${total} notes, ${Object.keys(folders).length} folders — ${elapsed}s`);

    // Test body fetch on first note found
    const firstFolder = Object.keys(folders)[0];
    if (firstFolder && folders[firstFolder][0]) {
      const note = folders[firstFolder][0];
      console.log(`\nFetching body of "${note.name}"...`);
      const body = await getNoteBody(note.id);
      const tags = extractTags(body);
      console.log(`Body: ${body.length} chars | Tags: ${tags.join(', ') || 'none'}`);
    }
  })().catch(console.error);
}

module.exports = { readAllNoteMeta, getNoteBody, extractTags, linkifyBody, getFolderNames };
