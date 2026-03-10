# Claude Session Quick Reference

## Project Overview

`outsystems-figma-cli` is a CLI tool for designing OutSystems apps in Figma. It connects to Figma Desktop via Chrome DevTools Protocol and executes JavaScript against the Figma Plugin API.

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

# Check diff between local tokens.json and Figma
os-figma tokens status
```

> Token values are project-specific — always run `os-figma tokens pull` after switching projects or starting a new session.

### Pattern Commands
```bash
# One-time: index components (open component library file in Figma first)
os-figma pattern scan

# One-time: index icons (open icon/foundations library file in Figma first)
os-figma pattern scan --icons

# List available components (no Figma connection required)
os-figma pattern list

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
os-figma raw query "//*[@name^='OS/']"
```

### Export
```bash
os-figma raw export "NODE_ID" --scale 2 --suffix "_export"
```

## Common OutSystems Operations

### Create an OutSystems Mobile Screen Frame
```bash
os-figma render '<Frame name="OS/Screen/Mobile" w={390} h={844} bg="var:--color-neutral-0" flex="col" />'
```

### Create an OutSystems Web Screen Frame
```bash
os-figma render '<Frame name="OS/Screen/Web" w={1440} h={900} bg="var:--color-neutral-0" flex="col" />'
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
  f.name = 'OS/Screen/Mobile/' + (i + 1);
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

## Important Notes

1. **Eval often returns no output** but code still executes. Verify with queries.

2. **Use rescale() not resize()** for scaling. resize() can break layers.

3. **Library variables** cannot be accessed via `getLocalVariableCollections()`. Must find through `boundVariables` on nodes.

4. **Node IDs** are in format `PAGE:NODE` like `1:92`. Get them from query output.

5. **Token commands** (`pull`/`push`/`status`) and `init` must be run from the project directory, not the CLI root.

6. **Always follow OutSystems layer naming** — `OS/{Component}/{Variant}/{State}`.

7. **Always use OutSystems token variables** — not raw hex values. See `CLAUDE.md` for full token list.

8. **Pattern scan is one-time setup** — run `os-figma pattern scan` and
   `os-figma pattern scan --icons` once per library. Re-run only if the library
   is updated. Component and icon keys are stored in `library-config.json`.

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

> 💡 At the start of each session:
> 1. `os-figma connect`
> 2. `cd` to your project directory
> 3. `os-figma tokens pull`
> 4. First time only: `os-figma pattern scan` and `os-figma pattern scan --icons`
> 5. Paste active node IDs below

Active file node IDs:
(paste your node IDs here)

OutSystems token collection in use:
(e.g. "OutSystems UI / Light")
