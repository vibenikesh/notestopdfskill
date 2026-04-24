# Notes to PDF

A background service that automatically mirrors all your Apple Notes to PDF files on disk — one PDF per note, folder structure preserved.

Runs every 15 minutes via macOS launchd and auto-starts on login. Handles create, update, rename, folder move, delete, and orphan cleanup.

---

## Features

- Converts all Apple Notes to PDFs automatically
- Preserves Notes folder structure on disk
- Detects and syncs: new notes, edits, renames, folder moves, and deletes
- Extracts `#hashtag` tags from note body and renders them as chips in the PDF
- Embeds images (base64 data URIs) with 200MB buffer and 60s timeout protection
- Clickable hyperlinks preserved in PDF output
- Handles filename collisions with `_(2)` suffix
- State keyed by CoreData note ID — stable across renames
- Skips "Recently Deleted" folder always
- Safety gate: delete sync skipped entirely if Notes returns 0 notes (guards against read failure wiping everything)

---

## Claude Code Skill

You can use this tool as a `/notes-to-pdf` slash command inside Claude Code — no manual setup required.

### Install the skill

```bash
mkdir -p ~/.claude/skills/notes-to-pdf
curl -o ~/.claude/skills/notes-to-pdf/SKILL.md \
  https://raw.githubusercontent.com/vibenikesh/notestopdfskill/main/skill/SKILL.md
```

### Usage

```
/notes-to-pdf                                        # Sync + export all → ~/Downloads/Notes to PDF
/notes-to-pdf --folder Work                          # Export a specific folder
/notes-to-pdf --folder Work Personal                 # Export multiple folders
/notes-to-pdf --notes "Meeting Notes"                # Export a specific note
/notes-to-pdf --all --email you@example.com          # Email all notes
/notes-to-pdf --folder Work --out ~/Desktop/export   # Export folder to custom directory
/notes-to-pdf --pdf-dir ~/Documents/Notes            # Generate PDFs into a custom directory
/notes-to-pdf --folder Work --zip                    # Force zip for a single file
```

### What the skill does
1. **Auto-installs** the tool to `~/notes-to-pdf` on first run (clones repo + runs `npm install`)
2. **Syncs** all Apple Notes to PDFs (only changed notes are processed)
3. **Exports** the selected PDFs to your chosen directory or email

### Arguments

| Argument | Description |
|----------|-------------|
| `--all` | Export all notes (default when no scope given) |
| `--folder <name> [...]` | Export one or more folders by name |
| `--notes <title> [...]` | Export specific notes by title |
| `--out <dir>` | Export destination directory |
| `--email <address>` | Send exported file via macOS Mail |
| `--pdf-dir <dir>` | Directory where PDFs are generated and saved |
| `--zip` | Force zip even for a single file |

---

## Requirements

- macOS (Apple Notes + AppleScript)
- Node.js v18+
- npm

---

## Installation

```bash
git clone https://github.com/vibenikesh/notestopdfskill.git
cd notestopdfskill
npm install
```

### Set up launchd (auto-run every 15 minutes)

1. Copy the plist to LaunchAgents:

```bash
cp com.user.notes-to-pdf.plist ~/Library/LaunchAgents/
```

2. Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.user.notes-to-pdf.plist
```

PDFs will be written to `~/Downloads/Notes to PDF/`, mirroring your Notes folder structure.

---

## Usage

```bash
# Force a sync right now
node src/index.js

# Check service health + recent logs
bash scripts/status.sh

# Scan for orphaned PDFs (PDFs with no matching note)
node scripts/orphan-report.js

# Delete orphaned PDFs
node scripts/orphan-report.js --delete

# Watch the live log
tail -f ~/notes-to-pdf/logs/notes-to-pdf.log
```

---

## Exporting Notes

The export script reads already-generated PDFs from state and copies or zips them to a directory, or sends them via email. It does **not** re-generate any PDFs — run a sync first if needed.

### Export to a directory

```bash
# Export all notes → ~/Downloads/Notes Export/ (auto-zipped if 2+ files)
node scripts/export.js --all

# Export to a specific directory
node scripts/export.js --all --out ~/Desktop/my-notes

# Export a single folder
node scripts/export.js --folder Work

# Export multiple folders (zipped together)
node scripts/export.js --folder Work Personal

# Export specific notes by title
node scripts/export.js --notes "Meeting Notes" "Project Plan"

# Force a zip even for a single file
node scripts/export.js --folder Work --zip
```

### Export via email (macOS)

```bash
# Email all notes
node scripts/export.js --all --email you@example.com

# Email a specific folder
node scripts/export.js --folder Work --email colleague@example.com
```

Email is sent via the macOS `mail` command using your system Mail account. A single PDF is attached directly; multiple PDFs are zipped first. Subject is set automatically (e.g. `Notes Export – Folder: Work`).

### Scope flags

| Flag | Description |
|------|-------------|
| `--all` | Export every tracked note |
| `--folder <name> [<name2> ...]` | Export all notes in one or more folders |
| `--notes <title> [<title2> ...]` | Export specific notes by exact title (case-insensitive) |

### Destination flags

| Flag | Default | Description |
|------|---------|-------------|
| `--out <dir>` | `~/Downloads/Notes Export` | Write PDF or zip here |
| `--email <address>` | — | Send via macOS `mail` command |
| `--zip` | — | Force zip even for a single file |

**Notes:**
- PDFs missing on disk are skipped with a warning; export continues with the valid subset.
- Zip filename format: `notes-export-YYYY-MM-DD-HHmmss.zip` (timestamp prevents same-day overwrites)
- Zip entries are stored as `FolderName/filename.pdf` to avoid cross-folder name collisions.
- Output directory is created automatically if it does not exist.

---

## Project Structure

| File | Purpose |
|------|---------|
| `src/index.js` | Main orchestrator — handles new, rename, update, delete cases |
| `src/notes-reader.js` | AppleScript bridge — reads all note metadata and body |
| `src/pdf-generator.js` | PDF generation (collision-safe for new notes; exact path for updates/renames) |
| `src/template.js` | HTML template for PDF layout and styling |
| `src/state.js` | Change detection keyed by CoreData ID |
| `src/logger.js` | Timestamped log appender with 500-line cap |
| `scripts/status.sh` | Service health check + recent logs |
| `scripts/orphan-report.js` | Scan for and optionally delete orphaned PDFs |

---

## Log Format

Each sync run appends a summary line:

```
Sync complete in Xs — Created: N | Updated: N | Renamed: N | Deleted: N | Skipped: N | Errors: N
```

---

## Performance

- **First run**: ~8 minutes (all notes read and PDFs generated)
- **Subsequent runs**: 5–12 seconds (only changed notes processed)
- AppleScript reads metadata in batch — avoids per-note loops that took 6+ minutes
- Note body is only fetched for notes that have changed (lazy fetch)

---

## Tech Stack

- Node.js, npm
- [puppeteer](https://github.com/puppeteer/puppeteer) — headless Chrome for PDF generation
- [sanitize-html](https://github.com/apostrophecms/sanitize-html) — HTML sanitisation
- osascript via temp `.applescript` files (avoids shell escaping bugs)

---

## Known Quirks

- Two folders with the same name (e.g. "Learning") are both processed correctly
- If state keys don't start with `x-coredata://`, state is wiped and rebuilt — expect a one-time ~8 min run
- AppleScript `id of noteList` (variable) fails; must use `id of every note in aFolder` directly

---

## License

MIT
