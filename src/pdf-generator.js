const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { buildHTML } = require('./template');

const OUTPUT_ROOT = process.env.NOTES_PDF_DIR
  ? path.resolve(process.env.NOTES_PDF_DIR)
  : path.join(process.env.HOME, 'Downloads', 'Notes to PDF');

function sanitizeFilename(name) {
  return name
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200); // max 200 chars
}

function getOutputPath(folderName, noteName, usedPaths) {
  const folderDir = path.join(OUTPUT_ROOT, sanitizeFilename(folderName));
  const baseName = sanitizeFilename(noteName) || 'Untitled';
  let filePath = path.join(folderDir, `${baseName}.pdf`);

  // Handle collisions
  let counter = 2;
  while (usedPaths.has(filePath)) {
    filePath = path.join(folderDir, `${baseName}_(${counter}).pdf`);
    counter++;
  }
  usedPaths.add(filePath);
  return filePath;
}

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// Render a note to PDF at a computed (collision-safe) path.
// Use this for NEW notes only.
async function generatePdf(note, usedPaths) {
  const { name, body, tags, creDate, modDate, folderName } = note;
  const outputPath = getOutputPath(folderName, name, usedPaths);
  await generatePdfAtPath(note, outputPath);
  return outputPath;
}

// Render a note to PDF at an exact, pre-determined path.
// Use this for UPDATES and RENAMES where the path is already known.
async function generatePdfAtPath(note, outputPath) {
  const { name, body, tags, creDate, modDate, folderName } = note;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const html = buildHTML({ title: name, body, tags, creDate, modDate, folderName });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await page.pdf({
      path: outputPath,
      format: 'Letter',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
    });
  } finally {
    await page.close();
  }
}

// Standalone test
if (require.main === module) {
  (async () => {
    const testNote = {
      name: 'Test Note — Notes to PDF',
      body: '<div><b>Hello World</b></div><div>This is a test note with some content.</div><div>It has <a href="https://example.com">a link</a> and some text.</div>',
      tags: ['#test', '#demo'],
      creDate: 'Wednesday, April 23, 2026 at 10:00:00 AM',
      modDate: 'Wednesday, April 23, 2026 at 10:00:00 AM',
      folderName: 'Test Folder',
    };

    console.log('Generating test PDF...');
    const usedPaths = new Set();
    const outputPath = await generatePdf(testNote, usedPaths);
    console.log(`PDF created: ${outputPath}`);
    await closeBrowser();
  })().catch(async (err) => {
    console.error(err);
    await closeBrowser();
    process.exit(1);
  });
}

module.exports = { generatePdf, generatePdfAtPath, closeBrowser, OUTPUT_ROOT, getOutputPath, sanitizeFilename };
