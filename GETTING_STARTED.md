# Getting Started with Notes to PDF — Claude Code Skill

Welcome! This guide walks you through everything you need to get started with the `/notes-to-pdf` skill. Whether you want to save a single note, back up an entire folder, or email your notes to someone — this guide has a real example for every use case.

---

## What does this skill do?

It reads your Apple Notes, converts them to nicely formatted PDF files, and either saves them to a folder on your Mac or emails them to you. You just type a command — it handles everything else.

---

## Step 1 — Install the skill (one time only)

Open your terminal and run:

```bash
mkdir -p ~/.claude/skills/notes-to-pdf
curl -o ~/.claude/skills/notes-to-pdf/SKILL.md https://raw.githubusercontent.com/vibenikesh/notestopdfskill/main/skill/SKILL.md
```

That's it. You never need to do this again.

> The skill will automatically download and set up the rest of the tool the first time you use it.

---

## Step 2 — Quit and restart Claude Code

Quit Claude Code completely and reopen it. This is required to pick up the newly installed skill.

## Step 3 — Try it

In Claude Code, just type `/notes-to-pdf` and hit Enter. Not sure what to type? Just run it with no arguments and it will guide you step by step.

---

## All Use Cases with Examples

### Just run it — no options needed

Let the skill decide everything. It will convert all your notes and save them to your Downloads folder.

```
/notes-to-pdf
```

**What happens:**
- All Apple Notes are converted to PDFs
- Files are saved to `~/Downloads/Notes to PDF/` (one subfolder per Notes folder)
- If you've run it before, only changed notes are updated (fast!)

---

### Export a single folder

You have a Notes folder called "Work" and want just those notes as PDFs.

```
/notes-to-pdf --folder Work
```

**What happens:**
- Only notes inside your "Work" folder are exported
- A zip file is created if there are 2 or more notes
- **If you run this again and nothing has changed**, the skill skips the sync entirely and tells you exactly where your existing PDFs already are — no waiting, no re-processing

---

### Export multiple folders at once

You want notes from both "Work" and "Personal" folders together.

```
/notes-to-pdf --folder Work Personal
```

**What happens:**
- Notes from both folders are collected and zipped together
- The zip preserves the folder structure inside (Work/note.pdf, Personal/note.pdf)

---

### Export specific notes by title

You only want two specific notes — "Project Plan" and "Meeting Notes".

```
/notes-to-pdf --notes "Project Plan" "Meeting Notes"
```

**What happens:**
- Only those two notes are exported
- Titles are matched case-insensitively

---

### Export all notes to a specific folder on your Mac

You want everything saved to your Desktop instead of Downloads.

```
/notes-to-pdf --all --out ~/Desktop/MyNotes
```

**What happens:**
- All notes are exported
- The folder `~/Desktop/MyNotes/` is created automatically if it doesn't exist
- A zip file is placed there

---

### Export a folder to a specific location

Save your "Recipes" folder to an external drive or a custom path.

```
/notes-to-pdf --folder Recipes --out /Volumes/MyDrive/NoteBackup
```

---

### Email all your notes

Send all your notes as a zip attachment to your email.

```
/notes-to-pdf --all --email you@example.com
```

**What happens:**
- All notes are zipped
- Mail.app sends the zip to your email address
- Check your Sent folder to confirm

---

### Email a specific folder

Send just your "Travel" notes to a friend or colleague.

```
/notes-to-pdf --folder Travel --email friend@example.com
```

---

### Email specific notes

Send just two notes by title to an email address.

```
/notes-to-pdf --notes "Budget 2026" "Q1 Review" --email boss@example.com
```

---

### Save PDFs to a custom folder (not Downloads)

You want the PDF files themselves stored in `~/Documents/Notes` instead of Downloads.

```
/notes-to-pdf --pdf-dir ~/Documents/Notes
```

**What happens:**
- PDFs are generated and saved to `~/Documents/Notes/`
- Exported zip also goes there by default

---

### Custom PDF folder + custom export folder

Generate PDFs into one place and export the zip somewhere else.

```
/notes-to-pdf --pdf-dir ~/Documents/Notes --out ~/Desktop/Export
```

---

### Force a zip even for a single file

By default, a single PDF is copied as-is. Use `--zip` if you always want a zip file.

```
/notes-to-pdf --folder Work --zip
```

---

### Export a folder and email it — all in one command

```
/notes-to-pdf --folder Work --email you@example.com --zip
```

---

### Change how often your notes sync in the background

By default, your notes are synced to PDFs automatically every hour. You can change this at any time — just say it naturally or use the flag.

```
/notes-to-pdf --sync-interval "every night"
/notes-to-pdf --sync-interval "8h"
/notes-to-pdf --sync-interval "30m"
/notes-to-pdf --sync-interval "1h"
```

You can also specify **multiple exact times** each day:

```
/notes-to-pdf --sync-interval "daily at 5am, 9am, 11am and 9pm"
/notes-to-pdf --sync-interval "5am 9am 11am 9pm"
/notes-to-pdf --sync-interval "9:30am 3pm"
```

Or just say it naturally in plain English:
```
/notes-to-pdf sync every night
/notes-to-pdf run background sync every 8 hours
/notes-to-pdf sync daily at 5am, 9am, 11am and 9pm
```

**What happens:**
- The background service schedule is updated immediately
- "nightly" runs once a day at 2:00 AM
- Multiple times run independently — each fires at its scheduled hour
- Your change is permanent until you change it again
- You can combine this with an export in the same command: `/notes-to-pdf --folder Work --sync-interval "every night"`

---

## Quick Reference

| What you want | Command |
|---|---|
| Export everything, default location | `/notes-to-pdf` |
| Export one folder | `/notes-to-pdf --folder FolderName` |
| Export multiple folders | `/notes-to-pdf --folder Work Personal` |
| Export specific notes | `/notes-to-pdf --notes "Note One" "Note Two"` |
| Export all to custom dir | `/notes-to-pdf --all --out ~/Desktop/Backup` |
| Email everything | `/notes-to-pdf --all --email you@example.com` |
| Email a folder | `/notes-to-pdf --folder Work --email you@example.com` |
| Custom PDF save location | `/notes-to-pdf --pdf-dir ~/Documents/Notes` |
| Force zip for single file | `/notes-to-pdf --folder Work --zip` |
| Change sync to nightly | `/notes-to-pdf --sync-interval "every night"` |
| Change sync to every 8 hours | `/notes-to-pdf --sync-interval "8h"` |
| Sync at specific times daily | `/notes-to-pdf --sync-interval "5am 9am 11am 9pm"` |

---

## Arguments at a glance

| Argument | What it does |
|---|---|
| `--all` | Export every note (default when nothing is specified) |
| `--folder <name>` | Export a specific Notes folder (can list multiple) |
| `--notes <title>` | Export notes by title (can list multiple, use quotes) |
| `--out <dir>` | Where to save the exported PDF or zip |
| `--email <address>` | Email the export via macOS Mail |
| `--pdf-dir <dir>` | Where to generate and store the PDF files |
| `--zip` | Force a zip file even when exporting a single note |
| `--sync-interval <value>` | Change how often the background sync runs (`"1h"`, `"8h"`, `"nightly"`, `"30m"`) |

---

## Frequently Asked Questions

**Do I need to install anything manually?**
No. The skill installs everything automatically on first run (Node.js must already be on your Mac).

**Will it overwrite my existing PDFs?**
Only if a note has changed since the last run. Unchanged notes are skipped.

**Can I schedule syncs at specific times of day?**
Yes — you can list as many times as you like: `/notes-to-pdf --sync-interval "5am 9am 11am 9pm"` or say it naturally: "sync daily at 5am, 9am, 11am and 9pm". Times with minutes work too: `"9:30am 3pm"`.

**What if I run the same folder export twice and nothing changed?**
The skill detects this automatically. Instead of re-syncing, it shows you a message like "No changes in 'Work' — all notes are up to date" and tells you exactly where your PDFs already are. No waiting.

**What if a note title has spaces?**
Wrap it in quotes: `--notes "My Note Title"`.

**What if a folder name has spaces?**
Wrap it in quotes: `--folder "My Projects"`.

**Can I use it more than once a day?**
Yes — each exported zip includes a timestamp in the filename (e.g. `notes-export-2026-04-24-143022.zip`) so nothing gets overwritten.

**What email app does it use?**
macOS Mail.app. Make sure you have an account set up in Mail before using `--email`.

**Not sure what folders you have in Notes?**
Just run `/notes-to-pdf` with no arguments — the skill will guide you.

---

## Need help?

Just run the skill without any arguments:

```
/notes-to-pdf
```

It will ask you friendly questions to figure out what you'd like to do — no experience needed.

