const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'state', 'notes-state.json');

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const data = JSON.parse(raw);

    // Migration check: old state was keyed by "FolderName::NoteName".
    // New state is keyed by CoreData note ID ("x-coredata://...").
    // If any key doesn't look like a CoreData ID, wipe the state so the
    // first run rebuilds it cleanly using IDs.
    const keys = Object.keys(data);
    if (keys.length > 0 && !keys[0].startsWith('x-coredata://')) {
      console.warn('[STATE] Detected old state format — resetting for ID-based tracking.');
      return {};
    }
    return data;
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Each entry: { modDate, pdfPath, folderName, noteName }
function getEntry(state, noteId) {
  return state[noteId] || null;
}

function hasContentChanged(entry, modDate) {
  if (!entry) return true;
  return entry.modDate !== modDate;
}

function hasLocationChanged(entry, folderName, noteName) {
  if (!entry) return false;
  return entry.folderName !== folderName || entry.noteName !== noteName;
}

function updateEntry(state, noteId, { modDate, pdfPath, folderName, noteName }) {
  state[noteId] = { modDate, pdfPath, folderName, noteName };
}

function deleteEntry(state, noteId) {
  delete state[noteId];
}

module.exports = {
  loadState, saveState,
  getEntry, hasContentChanged, hasLocationChanged,
  updateEntry, deleteEntry,
};
