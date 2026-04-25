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

---

### Step 1 — Setup

**If NODE shows `missing`:**
Warmly let the user know that Node.js is required and stop:
> "It looks like Node.js isn't installed on this Mac yet — that's totally okay! You can download it from https://nodejs.org (the LTS version works great). Once it's installed, come back and run this skill again and we'll pick up right where we left off."

**If STATUS shows `not_installed`:**
Let the user know you're setting things up for the first time and run:
```
git clone https://github.com/vibenikesh/notestopdfskill.git ~/notes-to-pdf
```

**If DEPS shows `missing` (or after a fresh clone):**
Run:
```
cd ~/notes-to-pdf && npm install
```

---

### Step 2 — Understand what the user wants

Parse the user arguments (if any):
- `--email <address>` → email destination
- `--out <dir>` → export destination directory (expand `~` to home)
- `--pdf-dir <dir>` → where PDFs are generated (sets NOTES_PDF_DIR env var; expand `~` to home)
- `--folder <name> [<name2> ...]` → scope to one or more folders
- `--notes <title> [<title2> ...]` → scope to specific note titles
- `--all` → all notes
- `--zip` → force zip for a single file

Defaults when not specified:
- PDF generation dir: `~/Downloads/Notes to PDF`
- Export output dir: `~/Downloads/Notes to PDF`
- Scope: all notes

**If no arguments were given at all**, do NOT assume and do NOT just run everything silently. Instead, gently guide the user with warmth. Show them their options in a friendly, encouraging way. Example tone to use:

> "Hey there! Happy to help you export your Apple Notes. Just let me know what you'd like to do — there's no wrong answer here!
>
> Here are your options:
>
> **What to export:**
> - Export **all** your notes → just say "all" or re-run: `/notes-to-pdf --all`
> - Export a **specific folder** → tell me the folder name, e.g. `/notes-to-pdf --folder Work`
> - Export **specific notes** → give me the note titles, e.g. `/notes-to-pdf --notes "My Note"`
>
> **Where to send them:**
> - Save to your **Downloads folder** (default — nothing needed)
> - Save to a **custom folder** → add `--out ~/Desktop/MyNotes`
> - **Email** them → add `--email you@example.com`
>
> Take your time — whenever you're ready, just let me know what you'd like!"

Wait for the user's response before proceeding. Be patient. If their response is unclear, gently ask a follow-up — never make them feel like they've done something wrong.

If at any point the user seems confused or gives an incomplete answer, respond with kindness. For example:
> "No worries at all! Let me help clarify. Would you like to export all your notes, or just from a specific folder?"

Never use negative language, never make the user feel guilty, and never express frustration.

---

### Step 3 — Sync (generate/update PDFs)

Let the user know you're getting started:
> "Great choice! Syncing your notes now — this usually takes just a few seconds for changes, or a few minutes if it's your first time."

Build the sync command:
- If `--folder` was given, append `--folder "<name>"` to enable folder-level change detection
- If `--pdf-dir` was given, set the env var

Examples:
```
node ~/notes-to-pdf/src/index.js --folder "Work"
NOTES_PDF_DIR="<pdf-dir>" node ~/notes-to-pdf/src/index.js --folder "Work"
node ~/notes-to-pdf/src/index.js
```

**Important:** If the sync command exits with code 0 and its output contains "No changes in" — every note in the requested folder is already up to date. In that case:
1. Do NOT proceed to Step 4 (export).
2. Relay the no-change message warmly to the user, for example:
   > "Good news — nothing has changed in that folder since the last export! Your PDFs are already up to date. You can find them at: [path shown in the output]"
3. Stop here.

---

### Step 4 — Export

Build the export command from the parsed arguments:

**Scope** (pick the first that applies):
- `--folder` given → `--folder <name> [<name2> ...]`
- `--notes` given → `--notes <title> [<title2> ...]`
- `--all` or no scope → `--all`

**Destination** (pick the first that applies):
- `--email` given → `--email <address>`
- `--out` given → `--out <dir>`
- Neither → `--out ~/Downloads/Notes\ to\ PDF`

If `--pdf-dir` was given and no `--out` or `--email` was specified, use `--out <pdf-dir>`.

Append `--zip` if the user passed it.

Run:
```
node ~/notes-to-pdf/scripts/export.js <scope> <destination> [--zip]
```

If the export fails because a folder name wasn't found, respond kindly:
> "It looks like I couldn't find a folder with that name — no worries! Here are the folders I can see in your Notes: [list them]. Which one would you like to export?"

---

### Step 5 — Report back warmly

When everything is done, let the user know with a friendly summary:
> "All done! Here's what happened:
> - ✓ X note(s) exported
> - ✓ Saved to: [path] (or: Emailed to [address])
>
> Let me know if you'd like to export anything else — always happy to help!"

If any PDFs were skipped (missing on disk), mention it gently:
> "Just so you know, a couple of notes couldn't be found on disk and were skipped — this can happen if they were recently deleted. Everything else exported successfully!"
