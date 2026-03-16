# Claude Session Quick Reference

## Project Overview

`outsystems-figma-cli` is a CLI tool for designing apps in Figma. It connects to Figma Desktop via Chrome DevTools Protocol and executes JavaScript against the Figma Plugin API.

**npm package:** `outsystems-figma-cli`
**GitHub:** https://github.com/mattholihan/outsystems-figma-cli

## Key Commands for Claude

### Connect to Figma
```bash
# Connect to Figma Desktop
os-figma connect

# Initialise a new project (run from project directory)
os-figma init
```

### Token Sync Commands
```bash
# Pull token values from active Figma file into local tokens.json
os-figma tokens pull

# Push local tokens.json to the connected Figma file
os-figma tokens push

# Check local token state (no Figma connection needed)
os-figma tokens status

# Sync effect and text styles from the Foundations file
os-figma styles pull

# Check local styles state (no Figma connection needed)
os-figma styles status
```

> **Session start:** `tokens pull` and `styles pull` both require the Foundations
> library file to be the active tab in Figma Desktop. Run them together at session
> start while that file is open, then switch to your working design file.
>
> **During design:** `os-figma tokens status` and `os-figma styles status` work
> offline — they check local file state without connecting to Figma. Use
> `--sync` to compare against live Figma values (requires Foundations file open).

### Pattern Commands
```bash
# List available components (no Figma connection required)
os-figma pattern list

# Get full schema for a component before placing it — always run before pattern add
os-figma pattern describe Button --pretty

# Get full schema for a component (variants, states, props)
os-figma pattern describe Button
os-figma pattern describe Button --pretty

# Add a component to canvas
os-figma pattern add Button
os-figma pattern add Button --variant Primary --state Default
os-figma pattern add Button --variant Primary --prop "Text=Sign In" --prop "Show icon (L)=true" --prop "Icon (L)=arrow-left"
```

### Execute JavaScript in Figma
```bash
os-figma eval "YOUR_JAVASCRIPT_HERE"
```

### Query Nodes
```bash
os-figma raw query "//FRAME"
os-figma raw query "//GROUP[@name='content']"
os-figma raw query "//FRAME"
```

### Export
```bash
os-figma export node "NODE_ID" --feedback           # Export to screenshots/ and return path for review
os-figma raw export "NODE_ID" --scale 2 --suffix "_export"   # Raw export
```

### Inspect Nodes
```bash
# Full JSON — geometry, layout, fills, strokes, effects, children, warnings
os-figma node inspect "<id>"

# Human-readable summary with design system warnings
os-figma node inspect "<id>" --summary

# Recursive child tree
os-figma node inspect "<id>" --deep

# Inspect current Figma selection
os-figma node inspect

# Inspect by node ID (no selection required)
os-figma node inspect -n "<id>"
```

## Common OutSystems Operations

### Create a Screen
```bash
# Mobile (390×844) — layer named Screen/Mobile/{Name}/Blank
os-figma screen create Login --size mobile

# Web (1440×900) — layer named Screen/Web/{Name}/Blank
os-figma screen create Dashboard --size web
```

### Switch Variable Mode (Light/Dark)
```bash
os-figma eval "
const node = figma.getNodeById('NODE_ID');

function findModeCollection(n) {
  if (n.boundVariables) {
    for (const [prop, binding] of Object.entries(n.boundVariables)) {
      const b = Array.isArray(binding) ? binding[0] : binding;
      if (b && b.id) {
        try {
          const variable = figma.variables.getVariableById(b.id);
          if (variable) {
            const col = figma.variables.getVariableCollectionById(variable.variableCollectionId);
            if (col && col.modes.length > 1) {
              return { col, modes: col.modes };
            }
          }
        } catch(e) {}
      }
    }
  }
  if (n.children) {
    for (const c of n.children) {
      const found = findModeCollection(c);
      if (found) return found;
    }
  }
  return null;
}

const found = findModeCollection(node);
if (found) {
  const mode = found.modes.find(m => m.name.includes('Light'));  // or 'Dark'
  if (mode) node.setExplicitVariableModeForCollection(found.col, mode.modeId);
}
"
```

### Rename Nodes to OutSystems Convention
```bash
os-figma eval "
const page = figma.currentPage;
page.children.filter(n => n.name.startsWith('Frame')).forEach((f, i) => {
  f.name = 'Screen/Mobile/' + (i + 1);
});
"
```

### Scale and Center Content
```bash
os-figma eval "
const ids = ['1:92', '1:112'];  // replace with your node IDs
const frameW = 390, frameH = 844;  // adjust for mobile or web

ids.forEach(id => {
  const n = figma.getNodeById(id);
  if (n) {
    n.rescale(1.2);  // or 0.9 to scale down
    n.x = (frameW - n.width) / 2;
    n.y = (frameH - n.height) / 2;
  }
});
"
```

## FigJam Commands
```bash
# List pages
os-figma fj list

# Create sticky
os-figma fj sticky "Text" -x 100 -y 100

# Create shape
os-figma fj shape "Label" -x 200 -y 100

# Connect nodes
os-figma fj connect "2:30" "2:34"

# List elements
os-figma fj nodes

# Execute JS
os-figma fj eval "figma.currentPage.children.length"
```

## Session Hygiene

- Run `node scripts/audit-coverage.js` at the start and end of every development session
- Any new `runCode()` block must have a `@figma-api` comment immediately above it
- After building a screen, run the evaluate loop until clean:
  1. `os-figma export node "<id>" --feedback` — export and read the screenshot
  2. `os-figma node fix "<id>" --deep` — apply all auto-fixable warnings
  3. If `node fix` exits with code 1, apply remaining warnings manually with `os-figma bind`, then re-run `node fix`
  4. Re-export and re-evaluate. Repeat until `node fix` exits with code 0 and the screenshot matches the design plan
- After the evaluate loop exits clean, commit an undo boundary: `os-figma commit-undo`

## Important Notes

1. **Eval often returns no output** but code still executes. Verify with queries.

2. **Use rescale() not resize()** for scaling. resize() can break layers.

3. **Library variables** are accessed via `importVariableByKeyAsync(key)` using
   keys stored in `tokens.json`. Run `os-figma tokens pull` to populate keys.
   `getLocalVariablesAsync()` returns 0 results in the working design file —
   do not use it for variable binding. The `boundVariables` approach is only
   relevant for variable mode switching (Light/Dark), not general binding.

4. **Node IDs** are in format `PAGE:NODE` like `1:92`. Get them from query output.

5. **Token commands** (`pull`/`push`/`status`) and `init` must be run from the project directory, not the CLI root.

6. **Always follow layer naming convention** — `{Component}/{Variant}/{State}`.

7. **Always use token variables from tokens.json** — not raw hex values.

8. **Pattern scan is handled by init** — run `os-figma init` for new projects.
   To re-scan manually (e.g. after a library update): `os-figma pattern scan`
   and `os-figma pattern scan --icons`.

9. **`pattern describe` is a hard gate before `pattern add`** — for every component
   you plan to place, run `pattern describe <Component> --pretty` and record whether
   it has Variants, States, and the exact `--prop` key names as returned. Do not
   proceed to `pattern add` until you have describe output for every component.
   Guessing prop names causes silent failures that are expensive to recover from.

10. **Always fix after building** — run `os-figma node fix "<id>" --deep` after
   placing all components. It inspects every descendant, resolves unbound fills/
   strokes to token variables, matches effect and text styles, and applies all
   fixable warnings in one pass. Use `--dry-run` to preview. Fix any unresolved
   warnings manually with `os-figma bind`, then re-run to confirm all clear.

11. **Styles are separate from tokens** — run `os-figma styles pull` in
    addition to `os-figma tokens pull` when starting a session. Effect style
    keys (shadows, blurs) and text style keys (type ramp) live in `styles.json`,
    not `tokens.json`.

12. **Always commit an undo boundary after completing a screen** — after the evaluate
    loop exits clean, run `os-figma commit-undo`. This creates a single
    undo checkpoint so the user can undo screen creation as one step rather than
    stepping back through every individual command.

## File Structure

```
outsystems-figma-cli/        ← Global CLI (installed globally via npm)
├── src/
│   ├── index.js             # Main CLI, all commands
│   └── outsystems-tokens.js # OutSystems token definitions
├── CLAUDE.md                # AI agent knowledge base
└── docs/
    └── ...

project-directory/           ← Per-project config (one per client/design)
├── tokens.json              # Project-specific token values
└── library-config.json      # Figma library connections, component keys, and icon keys
```

## Current Session Context

> 💡 First time: `os-figma init` (guided setup — connect, tokens, scan all in one)
>
> Returning session:
> 1. `os-figma connect`
> 2. `os-figma doctor` *(optional — verify all preconditions in one pass)*
> 3. `cd` to your project directory
> 4. Open the Foundations library file in Figma Desktop
> 5. `os-figma tokens pull && os-figma styles pull`
> 6. Switch back to your working design file in Figma Desktop
> 6. Paste active node IDs below

Active file node IDs:
(paste your node IDs here)

Token collection in use:
(e.g. "Light")
