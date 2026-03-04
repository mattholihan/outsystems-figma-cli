# Claude Session Quick Reference

## Project Overview

`outsystems-figma-cli` is a CLI tool for designing OutSystems apps in Figma. It connects to Figma Desktop via Chrome DevTools Protocol and executes JavaScript against the Figma Plugin API.

**Location:** `~/projects/outsystems-figma-cli`
**npm package:** `outsystems-figma-cli`
**GitHub:** https://github.com/mattholihan/outsystems-figma-cli

## Key Commands for Claude

### Connect to Figma
```bash
node src/index.js connect
```

### Execute JavaScript in Figma
```bash
node src/index.js eval "YOUR_JAVASCRIPT_HERE"
```

### Query Nodes
```bash
node src/index.js raw query "//FRAME"
node src/index.js raw query "//GROUP[@name='content']"
node src/index.js raw query "//*[@name^='OS/']"
```

### Export
```bash
node src/index.js raw export "NODE_ID" --scale 2 --suffix "_export"
```

## Common OutSystems Operations

### Create an OutSystems Mobile Screen Frame
```bash
node src/index.js render '<Frame name="OS/Screen/Mobile" w={390} h={844} bg="var:--color-neutral-0" flex="col" />'
```

### Create an OutSystems Web Screen Frame
```bash
node src/index.js render '<Frame name="OS/Screen/Web" w={1440} h={900} bg="var:--color-neutral-0" flex="col" />'
```

### Switch Variable Mode (Light/Dark)
```bash
node src/index.js eval "
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
node src/index.js eval "
const page = figma.currentPage;
page.children.filter(n => n.name.startsWith('Frame')).forEach((f, i) => {
  f.name = 'OS/Screen/Mobile/' + (i + 1);
});
"
```

### Scale and Center Content
```bash
node src/index.js eval "
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
node src/index.js fj list

# Create sticky
node src/index.js fj sticky "Text" -x 100 -y 100

# Create shape
node src/index.js fj shape "Label" -x 200 -y 100

# Connect nodes
node src/index.js fj connect "2:30" "2:34"

# List elements
node src/index.js fj nodes

# Execute JS
node src/index.js fj eval "figma.currentPage.children.length"
```

## Important Notes

1. **Eval often returns no output** but code still executes. Verify with queries.

2. **Use rescale() not resize()** for scaling. resize() can break layers.

3. **Library variables** cannot be accessed via `getLocalVariableCollections()`. Must find through `boundVariables` on nodes.

4. **Node IDs** are in format `PAGE:NODE` like `1:92`. Get them from query output.

5. **Working directory** must be `~/projects/outsystems-figma-cli` to run commands.

6. **Always follow OutSystems layer naming** — `OS/{Component}/{Variant}/{State}`.

7. **Always use OutSystems token variables** — not raw hex values. See `CLAUDE.md` for full token list.

## File Structure

```
outsystems-figma-cli/
├── src/
│   ├── index.js          # Main CLI, all commands
│   └── outsystems.js     # OutSystems constants and helpers
├── package.json          # npm config
├── CLAUDE.md             # AI agent knowledge base (OutSystems conventions)
├── OUTSYSTEMS.md         # OutSystems design system reference
├── README.md             # User docs
└── docs/
    ├── ARCHITECTURE.md   # How it works
    ├── COMMANDS.md       # All commands
    ├── TECHNIQUES.md     # Advanced patterns
    └── CLAUDE-SESSION.md # This file
```

## Current Session Context

> 💡 Update this section at the start of each working session with the relevant
> node IDs from your active Figma file. Run `node src/index.js canvas info` to
> get the current node IDs.

Active file node IDs:
```
(paste your node IDs here)
```

OutSystems token collection in use:
```
(note your variable collection name here, e.g. "OutSystems UI / Light")
```