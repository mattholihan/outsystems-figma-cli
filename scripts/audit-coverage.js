#!/usr/bin/env node
/**
 * audit-coverage.js
 *
 * Audits src/ against FIGMA-API-COVERAGE.md and reports:
 *   - What Figma API calls are actually present in source
 *   - Which are marked [x] in the doc but not found (stale)
 *   - Which are found in source but not marked [x] (undocumented)
 *
 * Usage:
 *   node scripts/audit-coverage.js
 *   node scripts/audit-coverage.js --json
 *   node scripts/audit-coverage.js --fix
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_DIR = join(ROOT, 'src');
const COVERAGE_FILE = join(ROOT, 'FIGMA-API-COVERAGE.md');
const OUTPUT_FILE = join(__dirname, 'audit-output.json');

const args = process.argv.slice(2);
const FLAG_JSON = args.includes('--json');
const FLAG_FIX = args.includes('--fix');

// ---------------------------------------------------------------------------
// Step 1 — Scan source files for Figma API call tokens
// ---------------------------------------------------------------------------

/**
 * Recursively collect all .js files under a directory.
 */
function collectJsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectJsFiles(full));
    } else if (entry.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extract Figma API tokens from source text using a battery of regexes.
 * Returns a Set of normalised token strings.
 */
function extractApiTokens(source) {
  const tokens = new Set();

  const patterns = [
    // figma.something or figma.something.somethingElse (with optional call/access suffix)
    /figma(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+/g,

    // Node property / method accesses that are Figma-specific
    /\.(fills|strokes|strokeWeight|strokeAlign|effects|effectStyleId|cornerRadius)\b/g,
    /\.(visible|locked|rotation|width|height|constraints|opacity|blendMode)\b/g,
    /\.(layoutMode|paddingTop|paddingRight|paddingBottom|paddingLeft)\b/g,
    /\.(itemSpacing|primaryAxisAlignItems|counterAxisAlignItems)\b/g,
    /\.(layoutSizingHorizontal|layoutSizingVertical|layoutWrap|layoutAlign|layoutGrow)\b/g,
    /\.(primaryAxisSizingMode|counterAxisSizingMode|layoutPositioning)\b/g,
    /\.(characters|fontSize|fontName|lineHeight|letterSpacing)\b/g,
    /\.(textAlignHorizontal|textAlignVertical|textStyleId|textDecoration|textCase)\b/g,
    /\.(componentProperties|setProperties|detachInstance|resetOverrides|mainComponent|swapComponent)\b/g,
    /\.(setBoundVariable|boundVariables)\b/g,
    /\.(effectStyleId|textStyleId)\b/g,

    // Standalone async helpers (often imported or called without figma. prefix in code strings)
    /\b(importComponentByKeyAsync|importComponentSetByKeyAsync|importStyleByKeyAsync)\b/g,
    /\b(getAvailableLibraryVariableCollectionsAsync|getVariablesInLibraryCollectionAsync)\b/g,
    /\b(getLocalVariablesAsync|getLocalVariables|getLocalVariableCollectionsAsync|getLocalVariableCollections)\b/g,
    /\b(getVariableById|getVariableByIdAsync|getVariableCollectionById)\b/g,
    /\b(getLocalTextStyles|getLocalEffectStyles|getLocalPaintStyles|getLocalGridStyles)\b/g,
    /\b(createComponentFromNode|createVariantComponent)\b/g,
    /\b(scrollAndZoomIntoView)\b/g,
    /\b(setBoundVariableForPaint|importVariableByKeyAsync)\b/g,
    /\b(loadFontAsync)\b/g,
    /\b(commitUndo)\b/g,
  ];

  for (const re of patterns) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(source)) !== null) {
      tokens.add(m[0].replace(/^\./, '')); // strip leading dot for normalisation
    }
  }

  return tokens;
}

const sourceFiles = collectJsFiles(SRC_DIR);
const allSourceTokens = new Set();

for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8');
  for (const token of extractApiTokens(source)) {
    allSourceTokens.add(token);
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Parse FIGMA-API-COVERAGE.md
// ---------------------------------------------------------------------------

if (!existsSync(COVERAGE_FILE)) {
  console.error(`Error: ${COVERAGE_FILE} not found.`);
  process.exit(1);
}

const coverageText = readFileSync(COVERAGE_FILE, 'utf8');
const coverageLines = coverageText.split('\n');

/**
 * Parse a coverage table row. Returns { status, api, lineNumber } or null.
 *
 * Row format:  | [x] | `figma.createFrame()` | notes |
 */
function parseRow(line, lineNumber) {
  // Match a markdown table row with a status marker in the first cell
  const match = line.match(/^\|\s*\[([ x\-~])\]\s*\|\s*`?([^`|]+)`?\s*\|/);
  if (!match) return null;

  const status = match[1]; // ' ', 'x', '-', '~'
  // Strip parens, backticks, and trim
  const api = match[2]
    .replace(/[`()]/g, '')
    .replace(/\s*\/\/.*$/, '')
    .trim();

  return { status, api, lineNumber: lineNumber + 1 };
}

/** Normalise an API name for fuzzy matching against source tokens. */
function normalise(api) {
  // Remove parameter signatures, collapse whitespace
  return api.replace(/\(.*\)/, '').replace(/\s+/g, '').toLowerCase();
}

const docEntries = []; // { status, api, lineNumber }

for (let i = 0; i < coverageLines.length; i++) {
  const row = parseRow(coverageLines[i], i);
  if (row) docEntries.push(row);
}

// Build lookup sets keyed by normalised name
const coveredInDoc = new Map();   // normalised → { status, api, lineNumber }  for [x] and [-]
const notCoveredInDoc = new Map(); // normalised → entry  for [ ]

for (const entry of docEntries) {
  const key = normalise(entry.api);
  if (entry.status === 'x' || entry.status === '-') {
    coveredInDoc.set(key, entry);
  } else if (entry.status === ' ') {
    notCoveredInDoc.set(key, entry);
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Cross-reference
// ---------------------------------------------------------------------------

/**
 * Check whether a source token matches a doc key.
 * Tries exact normalised match, then substring containment in both directions.
 */
function tokenMatchesDoc(token, docMap) {
  const normToken = normalise(token);
  if (docMap.has(normToken)) return docMap.get(normToken);

  // Substring: token ends with doc key suffix (e.g. ".fills" matches "fills")
  for (const [key, entry] of docMap) {
    if (normToken.endsWith(key) || key.endsWith(normToken)) return entry;
    // Also try: doc entry is like "figma.createFrame" and token is "figma.createFrame"
    if (normToken.includes(key) || key.includes(normToken)) return entry;
  }
  return null;
}

const confirmed = [];     // in source AND marked [x]
const stale = [];         // marked [x] in doc but NOT found in source
const undocumented = [];  // found in source but NOT marked [x] in doc

// Confirmed + stale — iterate over coveredInDoc
for (const [key, entry] of coveredInDoc) {
  let foundInSource = false;
  for (const token of allSourceTokens) {
    const normToken = normalise(token);
    if (normToken === key || normToken.endsWith(key) || key.endsWith(normToken) ||
        normToken.includes(key) || key.includes(normToken)) {
      foundInSource = true;
      break;
    }
  }
  if (foundInSource) {
    confirmed.push(entry);
  } else {
    stale.push(entry);
  }
}

// Undocumented — source tokens not in coveredInDoc
const NOISE_PREFIXES = ['figma.com']; // known non-API strings
const NOISE_TOKENS = new Set([
  'width', 'height', 'visible', 'rotation', 'locked', 'opacity', 'blendMode',
  'constraints', 'name', // too generic without context
]);

for (const token of allSourceTokens) {
  // Skip obvious noise
  if (NOISE_PREFIXES.some(p => token.startsWith(p))) continue;
  if (NOISE_TOKENS.has(token)) continue;
  if (!token.includes('figma') && token.length < 6) continue;

  const matchedCovered = tokenMatchesDoc(token, coveredInDoc);
  if (matchedCovered) continue; // already confirmed

  // Check if it's in notCoveredInDoc (not [x] but at least documented as [ ])
  const matchedUncovered = tokenMatchesDoc(token, notCoveredInDoc);
  undocumented.push({ token, docEntry: matchedUncovered || null });
}

// Deduplicate undocumented by token
const seen = new Set();
const undocumentedUniq = undocumented.filter(u => {
  if (seen.has(u.token)) return false;
  seen.add(u.token);
  return true;
});

// ---------------------------------------------------------------------------
// Step 4 — Output
// ---------------------------------------------------------------------------

const totalDocEntries = docEntries.length;
const markedX = [...docEntries].filter(e => e.status === 'x' || e.status === '-').length;
const markedEmpty = [...docEntries].filter(e => e.status === ' ').length;

function printReport() {
  console.log('\n=== Figma API Coverage Audit ===\n');
  console.log(`Source files scanned : ${sourceFiles.length}`);
  console.log(`API calls found      : ${allSourceTokens.size}`);
  console.log(`Doc entries total    : ${totalDocEntries}`);
  console.log(`Marked [x]/[-] in doc: ${markedX}`);
  console.log(`Marked [ ] in doc    : ${markedEmpty}`);

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`✅  Confirmed covered (${confirmed.length})`);
  console.log('──────────────────────────────────────────────────────');
  for (const e of confirmed.sort((a, b) => a.api.localeCompare(b.api))) {
    console.log(`  ${e.api}`);
  }

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`⚠️   Marked [x] but not found in source — possibly stale (${stale.length})`);
  console.log('──────────────────────────────────────────────────────');
  if (stale.length === 0) {
    console.log('  (none)');
  } else {
    for (const e of stale.sort((a, b) => a.api.localeCompare(b.api))) {
      console.log(`  line ${String(e.lineNumber).padStart(4)} : ${e.api}`);
    }
  }

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`🔴  Found in source but not marked [x] in doc — undocumented (${undocumentedUniq.length})`);
  console.log('──────────────────────────────────────────────────────');
  if (undocumentedUniq.length === 0) {
    console.log('  (none)');
  } else {
    for (const u of undocumentedUniq.sort((a, b) => a.token.localeCompare(b.token))) {
      const hint = u.docEntry
        ? ` ← listed as [ ] at line ${u.docEntry.lineNumber} ("${u.docEntry.api}")`
        : ' ← not in doc at all';
      console.log(`  ${u.token}${hint}`);
    }
  }

  console.log('');
}

printReport();

// --json output
if (FLAG_JSON) {
  const output = {
    scannedFiles: sourceFiles.map(f => f.replace(ROOT + '/', '')),
    sourceTokenCount: allSourceTokens.size,
    docEntryCount: totalDocEntries,
    markedImplemented: markedX,
    markedNotImplemented: markedEmpty,
    confirmed: confirmed.map(e => ({ api: e.api, line: e.lineNumber })),
    stale: stale.map(e => ({ api: e.api, line: e.lineNumber })),
    undocumented: undocumentedUniq.map(u => ({
      token: u.token,
      docLine: u.docEntry?.lineNumber ?? null,
      docApi: u.docEntry?.api ?? null,
    })),
  };
  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`JSON written to ${OUTPUT_FILE}\n`);
}

// --fix: mark [ ] → [x] for undocumented tokens that appear in the doc as [ ]
if (FLAG_FIX) {
  const fixable = undocumentedUniq.filter(u => u.docEntry !== null);
  if (fixable.length === 0) {
    console.log('--fix: nothing to fix (no undocumented tokens matched a [ ] row).\n');
  } else {
    // Backup
    const backupPath = COVERAGE_FILE + '.bak';
    copyFileSync(COVERAGE_FILE, backupPath);
    console.log(`--fix: backup written to ${backupPath}`);

    let updated = coverageText;
    let changeCount = 0;

    for (const u of fixable) {
      const lineIdx = u.docEntry.lineNumber - 1;
      const oldLine = coverageLines[lineIdx];
      if (!oldLine) continue;

      // Only replace [ ] markers, never [~]
      const newLine = oldLine.replace(/\[ \]/, '[x]');
      if (newLine !== oldLine) {
        // Rebuild updated text line by line
        const lines = updated.split('\n');
        lines[lineIdx] = newLine;
        updated = lines.join('\n');
        changeCount++;
        console.log(`  [x] ${u.docEntry.api}  (line ${u.docEntry.lineNumber})`);
      }
    }

    writeFileSync(COVERAGE_FILE, updated);
    console.log(`\n--fix: ${changeCount} rows updated in FIGMA-API-COVERAGE.md\n`);
  }
}
