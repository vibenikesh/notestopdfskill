---
name: notes-to-pdf
description: Convert Apple Notes to PDFs and export them to a directory or via email. Syncs all notes first, then exports. Supports exporting all notes, specific folders, or specific note titles. Usage examples — export all: /notes-to-pdf, export folder: /notes-to-pdf --folder Work, email a folder: /notes-to-pdf --folder Work --email you@example.com, custom dirs: /notes-to-pdf --pdf-dir ~/Documents/Notes --out ~/Desktop/export
argument-hint: [--all|--folder <name>|--notes <title>] [--out <dir>] [--email <addr>] [--pdf-dir <dir>] [--zip]
allowed-tools: Bash
---

Convert Apple Notes to PDFs and export them.

## Environment check

```!
TOOL_DIR="$HOME/notes-to-pdf"
if [ -d "$TOOL_DIR/.git" ]; then
  echo "STATUS: installed"
else
  echo "STATUS: not_installed"
fi
if [ -d "$TOOL_DIR/node_modules" ]; then
  echo "DEPS: ready"
else
  echo "DEPS: missing"
fi
node --version 2>/dev/null || echo "NODE: missing"
```

## User arguments
$ARGUMENTS

## Instructions

Work through these steps in order. Use the Bash tool for all commands.

### Step 1 — Setup

Parse the user arguments (if any):
- `--email <address>` → email destination
- `--out <dir>` → export destination directory (expand `~` to home)
- `--pdf-dir <dir>` → where PDFs are generated and saved (sets NOTES_PDF_DIR env var; expand `~` to home)
- `--folder <name> [<name2> ...]` → scope to one or more folders
- `--notes <title> [<title2> ...]` → scope to specific note titles
- `--all` → explicit all-notes scope (default when no scope given)
- `--zip` → force zip for a single file

Defaults when not specified:
- PDF generation dir: `~/Downloads/Notes to PDF`
- Export output dir: `~/Downloads/Notes to PDF`
- Scope: all notes

**If STATUS shows `not_installed`:**
Run:
```
git clone https://github.com/vibenikesh/notestopdfskill.git ~/notes-to-pdf
```

**If DEPS shows `missing` (or after a fresh clone):**
Run:
```
cd ~/notes-to-pdf && npm install
```

**If NODE shows `missing`:** Tell the user Node.js v18+ is required and stop.

### Step 2 — Sync (generate/update PDFs)

Run the sync to ensure all PDFs are up to date. If `--pdf-dir` was given, set the env var:

```
NOTES_PDF_DIR="<pdf-dir>" node ~/notes-to-pdf/src/index.js
```

If no `--pdf-dir`, run without the env var:

```
node ~/notes-to-pdf/src/index.js
```

### Step 3 — Export

Build the export command from the parsed arguments:

**Scope** (pick the first that applies):
- `--folder` given → `--folder <name> [<name2> ...]`
- `--notes` given → `--notes <title> [<title2> ...]`
- `--all` or no scope → `--all`

**Destination** (pick the first that applies):
- `--email` given → `--email <address>`
- `--out` given → `--out <dir>`
- Neither → `--out ~/Downloads/Notes\ to\ PDF`

**If `--pdf-dir` was given**, the state file and PDF paths are in a non-default location. In that case also pass `--out <pdf-dir>` as the export destination (unless the user already specified `--out` or `--email`).

Append `--zip` if the user passed it.

Run the assembled command:
```
node ~/notes-to-pdf/scripts/export.js <scope> <destination> [--zip]
```

### Step 4 — Report

Tell the user:
- How many PDFs were exported
- Where the output went (full path or email address)
- Any warnings about missing PDFs that were skipped
