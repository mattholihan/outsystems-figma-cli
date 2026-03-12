# Advanced Techniques

> 💡 Token values (colors, spacing, screen dimensions) are project-specific. Always check `tokens.json` in your project directory, or run `os-figma tokens pull` to sync before a session.

## Variable Mode Switching (Library Variables)

The biggest challenge: switching variable modes (Light/Dark) when variables come from an external library.

### The Problem

- `figma.variables.getLocalVariableCollections()` only returns local collections
- Library variables are not directly accessible
- You cannot import library collections programmatically

### The Solution

Access the collection through bound variables on nodes:

```javascript
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
  const lightMode = found.modes.find(m => m.name.includes('Light'));
  if (lightMode) {
    node.setExplicitVariableModeForCollection(found.col, lightMode.modeId);
  }
}
```

### Apply to Multiple Nodes

```javascript
const ids = ['NODE_ID_1', 'NODE_ID_2', 'NODE_ID_3'];
ids.forEach(id => {
  const n = figma.getNodeById(id);
  if (n) n.setExplicitVariableModeForCollection(found.col, lightMode.modeId);
});
```

> 💡 Get your node IDs by running `os-figma raw query "//FRAME"` and noting the IDs in the output.

---

## Scaling from Corners

### The Problem

Using `resize()` can break layers and distort content.

### The Solution

Use `rescale()` which scales proportionally, then reposition:

```javascript
// Scale from top-right corner
const node = figma.getNodeById('NODE_ID');
const oldRight = node.x + node.width;
const oldTop = node.y;

node.rescale(1.2);

// Maintain top-right position
node.x = oldRight - node.width;
node.y = oldTop;
```

### Scale and Center in a Screen Frame

```javascript
// Screen dimensions — confirm against your tokens.json if overridden
// Mobile (390×844)
const frameW = 390, frameH = 844;

node.rescale(0.9);
node.x = (frameW - node.width) / 2;
node.y = (frameH - node.height) / 2;

// Web (1440×900)
const frameW = 1440, frameH = 900;

node.rescale(1.0);
node.x = (frameW - node.width) / 2;
node.y = (frameH - node.height) / 2;
```

---

## Batch Operations

### Rename Multiple Nodes

```javascript
const page = figma.currentPage;
const frames = page.children.filter(n => n.name.startsWith('Frame'));

frames.forEach((frame, i) => {
  frame.name = `Screen/Mobile/${i + 1}`;
});
```

### Rename Children Inside Frames

```javascript
const screens = page.children.filter(n => n.name.startsWith('Screen/'));

screens.forEach(screen => {
  const group = screen.children.find(c => c.type === 'GROUP');
  if (group) group.name = 'Content';
});
```

### Different Scaling Based on Screen Type

```javascript
const screens = page.children.filter(n => n.name.startsWith('Screen/'));

screens.forEach(screen => {
  const content = screen.children.find(c => c.name === 'Content');
  if (!content) return;

  // Scale differently for mobile vs web
  const isMobile = screen.name.includes('Mobile');
  const frameW = isMobile ? 390 : 1440;
  const frameH = isMobile ? 844 : 900;

  content.rescale(isMobile ? 0.9 : 1.0);
  content.x = (frameW - content.width) / 2;
  content.y = (frameH - content.height) / 2;
});
```

---

## Export with Custom Naming

```javascript
// Export all screens with a suffix
const screens = page.children.filter(n => n.name.startsWith('Screen/'));

for (const screen of screens) {
  // Use os-figma export command with the screen's node ID
  // os-figma raw export "SCREEN_ID" --scale 2 --suffix "_export"
}
```

Via CLI:
```bash
os-figma raw export "NODE_ID" --scale 2 --suffix "_export"
```

---

## Working with Selections

### Select Nodes Programmatically

```javascript
const nodes = ['NODE_ID_1', 'NODE_ID_2', 'NODE_ID_3']
  .map(id => figma.getNodeById(id))
  .filter(Boolean);
figma.currentPage.selection = nodes;
```

### Clear Selection

```javascript
figma.currentPage.selection = [];
```

### Get Current Selection

```javascript
const selected = figma.currentPage.selection;
selected.map(n => n.name + ' (' + n.id + ')').join(', ');
```

---

## Debugging Tips

### Eval Returns No Output

Sometimes eval commands execute but return nothing. The code still runs. Verify by:

1. Query the nodes after: `os-figma raw query "//FRAME"`
2. Check that properties changed: look at sizes, positions, names

### Finding Node IDs

```bash
# Query returns IDs in format: [TYPE] "name" (ID) dimensions
os-figma raw query "//FRAME"
# Output: [FRAME] "Screen/Mobile/1" (1:90) 390×844
```

### Check Node Structure

```javascript
const node = figma.getNodeById('NODE_ID');
node.children.map(c => c.name + ' (' + c.type + ')').join(', ');
```

### Find All Named Layers on Canvas

```bash
os-figma raw query "//*[@name^='Screen/']"
```

---

## Node Inspection

Use `node inspect` to read back what the agent built. The `warnings` array flags
unbound fills/strokes and missing style bindings — use this output in the evaluate
phase of the agentic loop before calling `os-figma bind` to fix violations.

```bash
# Full JSON output (all properties, shallow children)
os-figma node inspect "123:456"

# Recursive child tree
os-figma node inspect "123:456" --deep

# Human-readable summary with warnings
os-figma node inspect "123:456" --summary

# Inspect current selection
os-figma node inspect
```

The `--summary` output highlights design system violations inline so you can
spot and fix them without parsing JSON. After fixing bindings with `os-figma bind`,
re-run `node inspect --summary` to confirm the warnings are cleared.

### Preferred: node fix

After building a screen or component, use `node fix` to resolve all warnings
in one pass:

```bash
# Preview the fix plan without applying
os-figma node fix "<screenId>" --deep --dry-run

# Apply all auto-fixable warnings across the full node tree
os-figma node fix "<screenId>" --deep
```

`node fix` inspects every descendant, matches unbound hex fills/strokes to token
variables from `tokens.json`, matches effect styles and text styles by node name
and font size from `styles.json`, and applies each fix sequentially. Exit code 0
means all warnings are cleared; exit code 1 means unresolved warnings remain.

For unresolved warnings, apply manually with `os-figma bind` then re-run:
```bash
os-figma bind fill "--color-neutral-0" -n "<nodeId>"   # unbound fill
os-figma bind stroke "--color-neutral-4" -n "<nodeId>" # unbound stroke
os-figma bind effect "Shadow/Card" -n "<nodeId>"       # missing effect style
os-figma bind text-style "Heading/H1" -n "<nodeId>"    # missing text style

# Confirm all cleared
os-figma node fix "<screenId>" --deep
```

---

## Applying Library Styles

Effect and text style keys are stored in `styles.json` after running
`os-figma styles pull`. To apply them to nodes in a working file, the CLI
imports the style by key using `figma.importStyleByKeyAsync()` then applies
the returned style ID using the async setters introduced in API v87.

### Important: async style setters

Never assign `node.textStyleId` or `node.effectStyleId` directly — these
are deprecated and will throw in dynamic-page mode. Always use:

```js
// Correct
const style = await figma.importStyleByKeyAsync(key);
await node.setTextStyleIdAsync(style.id);
await node.setEffectStyleIdAsync(style.id);

// Deprecated — do not use
node.textStyleId = style.id;
node.effectStyleId = style.id;
```

### Font loading for text styles

When applying a text style to a text node, the font must be loaded first:
```js
const style = await figma.importStyleByKeyAsync(key);
await figma.loadFontAsync({ family: style.fontName.family, style: style.fontName.style });
await node.setTextStyleIdAsync(style.id);
```
