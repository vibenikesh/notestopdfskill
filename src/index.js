const path = require('path');
const fs = require('fs');

const { readAllNoteMeta, getNoteBody, extractTags, linkifyBody } = require('./notes-reader');
const { generatePdf, generatePdfAtPath, closeBrowser, getOutputPath } = require('./pdf-generator');
const {
  loadState, saveState,
  getEntry, hasContentChanged, hasLocationChanged,
  updateEntry, deleteEntry,
} = require('./state');
const logger = require('./logger');

// Remove a folder from the output directory only if it contains no PDF files.
function cleanupEmptyFolder(folderPath) {
  try {
    if (!fs.existsSync(folderPath)) return;
    const contents = fs.readdirSync(folderPath);
    const hasPdfs = contents.some(f => f.endsWith('.pdf'));
    if (!hasPdfs) {
      fs.rmdirSync(folderPath);
      logger.info(`Removed empty folder: ${path.basename(folderPath)}`);
    }
  } catch {
    // Non-fatal
  }
}

// Parse optional --folder <name> CLI argument
const folderArgIdx = process.argv.indexOf('--folder');
const folderFilter = folderArgIdx !== -1 ? process.argv[folderArgIdx + 1] : null;

async function run() {
  const startTime = Date.now();
  logger.info('Notes to PDF — sync started');

  let created = 0, updated = 0, renamed = 0, skipped = 0, errors = 0;
  const state = loadState();

  // Pre-populate usedPaths with all currently known PDF paths so new-note
  // path generation never collides with an existing file.
  const usedPaths = new Set(
    Object.values(state).map(e => e.pdfPath).filter(Boolean)
  );

  let folders;
  try {
    folders = await readAllNoteMeta();
  } catch (err) {
    logger.error(`Failed to read notes: ${err.message}`);
    process.exit(1);
  }

  const folderNames = Object.keys(folders);
  const totalNotes = folderNames.reduce((sum, f) => sum + folders[f].length, 0);
  logger.info(`Found ${totalNotes} notes across ${folderNames.length} folders`);

  // ── Folder-scoped no-change check ─────────────────────────────────────────
  if (folderFilter) {
    const matchingFolder = folderNames.find(
      f => f.toLowerCase() === folderFilter.toLowerCase()
    );
    if (matchingFolder) {
      const notesInFolder = folders[matchingFolder];
      const anyChanged = notesInFolder.some(({ id, name, modDate }) => {
        const entry = getEntry(state, id);
        return hasContentChanged(entry, modDate) || hasLocationChanged(entry, matchingFolder, name);
      });
      if (!anyChanged) {
        const OUTPUT_ROOT = path.join(process.env.HOME, 'Downloads', 'Notes to PDF');
        const folderPdfPath = path.join(OUTPUT_ROOT, matchingFolder);
        const noteCount = notesInFolder.length;
        console.log('');
        console.log(`✓ No changes in "${matchingFolder}" — all ${noteCount} note${noteCount !== 1 ? 's' : ''} are up to date.`);
        console.log(`  Your PDFs are available at: ${folderPdfPath}`);
        console.log('');
        logger.info(`No-change check: folder "${matchingFolder}" — ${noteCount} notes unchanged, skipping sync.`);
        process.exit(0);
      }
    }
  }

  for (const folderName of folderNames) {
    for (const noteMeta of folders[folderName]) {
      const { id, name, modDate, creDate } = noteMeta;

      const entry = getEntry(state, id);
      const contentChanged = hasContentChanged(entry, modDate);
      const locationChanged = hasLocationChanged(entry, folderName, name);

      // ── Case 1: unchanged note ────────────────────────────────────────────
      if (!contentChanged && !locationChanged) {
        skipped++;
        continue;
      }

      // ── Case 2: new note (never seen before) ──────────────────────────────
      if (!entry) {
        let body;
        try { body = linkifyBody(await getNoteBody(id)); }
        catch (err) {
          logger.error(`Body fetch failed for new note "${name}" (${folderName}): ${err.message}`);
          errors++;
          continue;
        }
        try {
          const pdfPath = await generatePdf(
            { name, body, tags: extractTags(body), creDate, modDate, folderName },
            usedPaths
          );
          updateEntry(state, id, { modDate, pdfPath, folderName, noteName: name });
          created++;
          logger.info(`CREATED: ${folderName}/${name}`);
        } catch (err) {
          logger.error(`PDF creation failed for "${name}": ${err.message}`);
          errors++;
        }
        continue;
      }

      // ── Case 3: renamed / moved (with or without content change) ─────────
      if (locationChanged) {
        const oldPdfPath = entry.pdfPath;
        const newPdfPath = getOutputPath(folderName, name, usedPaths);
        fs.mkdirSync(path.dirname(newPdfPath), { recursive: true });

        if (contentChanged) {
          // Move location + regenerate content
          let body;
          try { body = linkifyBody(await getNoteBody(id)); }
          catch (err) {
            logger.error(`Body fetch failed for renamed note "${name}": ${err.message}`);
            errors++;
            continue;
          }
          try {
            // Write new PDF at new path
            await generatePdfAtPath(
              { name, body, tags: extractTags(body), creDate, modDate, folderName },
              newPdfPath
            );
            // Remove old PDF if it's at a different path
            if (oldPdfPath !== newPdfPath && fs.existsSync(oldPdfPath)) {
              fs.unlinkSync(oldPdfPath);
              cleanupEmptyFolder(path.dirname(oldPdfPath));
            }
            updateEntry(state, id, { modDate, pdfPath: newPdfPath, folderName, noteName: name });
            renamed++;
            logger.info(`RENAMED+UPDATED: ${entry.folderName}/${entry.noteName} → ${folderName}/${name}`);
          } catch (err) {
            logger.error(`PDF generation failed for renamed note "${name}": ${err.message}`);
            errors++;
          }
        } else {
          // Pure rename — move the file on disk, no regeneration needed
          if (fs.existsSync(oldPdfPath)) {
            fs.renameSync(oldPdfPath, newPdfPath);
            cleanupEmptyFolder(path.dirname(oldPdfPath));
          } else {
            // Old PDF was manually deleted — regenerate at new path
            let body;
            try { body = linkifyBody(await getNoteBody(id)); }
            catch (err) {
              logger.error(`Body fetch failed for renamed note "${name}": ${err.message}`);
              errors++;
              continue;
            }
            try {
              await generatePdfAtPath(
                { name, body, tags: extractTags(body), creDate, modDate, folderName },
                newPdfPath
              );
            } catch (err) {
              logger.error(`PDF re-creation failed for renamed note "${name}": ${err.message}`);
              errors++;
              continue;
            }
          }
          updateEntry(state, id, { modDate, pdfPath: newPdfPath, folderName, noteName: name });
          renamed++;
          logger.info(`RENAMED: ${entry.folderName}/${entry.noteName} → ${folderName}/${name}`);
        }
        continue;
      }

      // ── Case 4: same location, content changed ────────────────────────────
      if (contentChanged) {
        let body;
        try { body = linkifyBody(await getNoteBody(id)); }
        catch (err) {
          logger.error(`Body fetch failed for "${name}" (${folderName}): ${err.message}`);
          errors++;
          continue;
        }
        try {
          // Overwrite the PDF at its existing path (no path change)
          const existingPath = entry.pdfPath;
          await generatePdfAtPath(
            { name, body, tags: extractTags(body), creDate, modDate, folderName },
            existingPath
          );
          updateEntry(state, id, { modDate, pdfPath: existingPath, folderName, noteName: name });
          updated++;
          logger.info(`UPDATED: ${folderName}/${name}`);
        } catch (err) {
          logger.error(`PDF update failed for "${name}": ${err.message}`);
          errors++;
        }
      }
    }
  }

  // ── Delete sync ────────────────────────────────────────────────────────────
  // Build set of all live note IDs from this run.
  // Only proceed if we got a plausible number of notes back (safety gate:
  // skip delete if Notes returned 0 to avoid wiping everything on a read failure).
  let deleted = 0;
  if (totalNotes > 0) {
    const liveIds = new Set(
      folderNames.flatMap(f => folders[f].map(n => n.id))
    );

    for (const [noteId, entry] of Object.entries(state)) {
      if (liveIds.has(noteId)) continue; // still exists in Notes

      const { pdfPath, folderName, noteName } = entry;

      // Remove the PDF from disk if it exists
      if (pdfPath && fs.existsSync(pdfPath)) {
        try {
          fs.unlinkSync(pdfPath);
          cleanupEmptyFolder(path.dirname(pdfPath));
        } catch (err) {
          logger.error(`Could not delete PDF for "${noteName}": ${err.message}`);
          errors++;
          continue; // leave state entry intact so we retry next run
        }
      }

      deleteEntry(state, noteId);
      deleted++;
      logger.info(`DELETED: ${folderName}/${noteName}`);
    }
  }

  await closeBrowser();
  saveState(state);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(
    `Sync complete in ${elapsed}s — ` +
    `Created: ${created} | Updated: ${updated} | Renamed: ${renamed} | ` +
    `Deleted: ${deleted} | Skipped: ${skipped} | Errors: ${errors}`
  );
}

run().catch(async (err) => {
  logger.error(`FATAL: ${err.message}`);
  await closeBrowser();
  process.exit(1);
});
