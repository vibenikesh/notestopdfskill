// Accent colors — indigo & slate theme
const ACCENT      = '#4F46E5'; // indigo — header bar + tag chips
const ACCENT_LIGHT = '#EEF2FF'; // very light indigo — tag chip background
const ACCENT_TEXT  = '#4338CA'; // slightly darker indigo — tag chip text

function buildHTML({ title, body, tags, creDate, modDate, folderName }) {
  const tagChips = tags.length
    ? tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')
    : '';

  const tagSection = tagChips
    ? `<div class="tags">${tagChips}</div>`
    : '';

  const footerDate = modDate
    ? `Last updated: ${modDate}`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 15px;
    line-height: 1.65;
    color: #1a1a1a;
    background: #ffffff;
    max-width: 740px;
    margin: 0 auto;
  }

  /* ── Header bar ─────────────────────────────────────── */
  .header-bar {
    background: ${ACCENT};
    padding: 14px 48px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .folder-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.9);
  }
  .header-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(255,255,255,0.4);
    flex-shrink: 0;
  }
  .header-subtitle {
    font-size: 11px;
    color: rgba(255,255,255,0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Content area ───────────────────────────────────── */
  .content {
    padding: 36px 48px 48px;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: #111;
    margin-bottom: 4px;
    line-height: 1.25;
    letter-spacing: -0.3px;
  }

  /* ── Tags ───────────────────────────────────────────── */
  .tags {
    margin-top: 12px;
    margin-bottom: 24px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tag {
    background: ${ACCENT_LIGHT};
    color: ${ACCENT_TEXT};
    font-size: 11.5px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 20px;
    letter-spacing: 0.01em;
  }

  .divider {
    border: none;
    border-top: 2px solid ${ACCENT};
    margin: 20px 0 24px;
    opacity: 0.15;
  }

  /* ── Body content ───────────────────────────────────── */
  .body {
    font-size: 14px;
    color: #222;
    word-wrap: break-word;
  }
  .body h1 { font-size: 18px; font-weight: 700; color: #111; margin: 18px 0 8px; }
  .body h2 { font-size: 16px; font-weight: 600; color: #222; margin: 14px 0 6px; }
  .body h3 { font-size: 14px; font-weight: 600; color: #333; margin: 12px 0 4px; }
  .body p, .body div { margin-bottom: 6px; }
  .body ul, .body ol { padding-left: 22px; margin-bottom: 10px; }
  .body li { margin-bottom: 3px; }
  .body a { color: ${ACCENT}; word-break: break-all; text-decoration: none; border-bottom: 1px solid ${ACCENT_LIGHT}; }
  .body img { max-width: 100%; height: auto; margin: 10px 0; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
  .body table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  .body th { background: ${ACCENT_LIGHT}; color: ${ACCENT_TEXT}; font-weight: 600; }
  .body td, .body th { border: 1px solid #e5e7eb; padding: 7px 12px; font-size: 13px; }
  .body b, .body strong { font-weight: 600; }
  .body blockquote {
    border-left: 3px solid ${ACCENT};
    margin: 10px 0;
    padding: 4px 14px;
    color: #555;
    background: ${ACCENT_LIGHT};
    border-radius: 0 4px 4px 0;
  }

  /* ── Footer ─────────────────────────────────────────── */
  .footer {
    margin-top: 40px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    font-size: 10.5px;
    color: #9ca3af;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .footer-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .footer-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #d1d5db;
    flex-shrink: 0;
  }
</style>
</head>
<body>

  <div class="header-bar">
    <span class="folder-label">${escapeHtml(folderName)}</span>
    <span class="header-dot"></span>
    <span class="header-subtitle">${escapeHtml(title)}</span>
  </div>

  <div class="content">
    <h1>${escapeHtml(title)}</h1>
    ${tagSection}
    <hr class="divider">
    <div class="body">${body}</div>
    <div class="footer">
      <div class="footer-left">
        <span>${escapeHtml(folderName)}</span>
        <span class="footer-dot"></span>
        <span>${escapeHtml(title)}</span>
      </div>
      <span>${escapeHtml(footerDate)}</span>
    </div>
  </div>

</body>
</html>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { buildHTML };
