# Commands Reference

> All commands use the `os-figma` alias. See README for alias setup instructions.

---

## Setup & Connection

```bash
# Connect to running Figma Desktop
os-figma connect

# Connect in safe mode (uses plugin, no Figma modification)
os-figma connect --safe
```

---

## Design Tokens

```bash
# OutSystems UI tokens (colors, spacing, radius, typography)
os-figma tokens preset outsystems

# Spacing scale (4px base)
os-figma tokens spacing

# Border radii
os-figma tokens radii
```

---

## Variables

```bash
# List all variables
os-figma var list

# Create a variable
os-figma var create "color/primary" -c "CollectionId" -t COLOR -v "#0057D9"

# Find variables by pattern
os-figma var find "color/*"

# Visualize all variables as swatches on canvas
os-figma var visualize

# Delete all variables
os-figma var delete-all

# Delete a specific collection
os-figma var delete-all -c "primitives"
```

---

## Collections

```bash
# List collections
os-figma col list

# Create collection
os-figma col create "OutSystems UI Tokens"
```

---

## Create Elements

```bash
# Create a mobile screen frame (OutSystems standard)
os-figma create frame "OS/Screen/Mobile" -w 390 -h 844

# Create a web screen frame (OutSystems standard)
os-figma create frame "OS/Screen/Web" -w 1440 -h 900

# Create a frame with OutSystems token fill
os-figma create frame "OS/Card/Default" -w 320 -h 200 --fill "var:--color-neutral-0" --radius 8

# Create an icon (Iconify, 150k+ icons)
os-figma create icon lucide:star -s 24 -c "#f59e0b"
os-figma create icon mdi:home -s 32 -c "#3b82f6"
```

---

## JSX Rendering

```bash
# Create an OutSystems Card component
os-figma render '<Frame name="OS/Card/Default" w={320} bg="var:--color-neutral-0" rounded={8} flex="col" overflow="hidden" stroke="var:--color-neutral-200" strokeWidth={1}>
  <Frame name="OS/Card/Image" w="fill" h={160} bg="var:--color-neutral-100" />
  <Frame name="OS/Card/Content" flex="col" gap={8} p={16} w="fill">
    <Text size={18} weight="bold" color="var:--color-neutral-900" w="fill">Card Title</Text>
    <Text size={14} color="var:--color-neutral-500" w="fill">Card description text.</Text>
  </Frame>
</Frame>'

# Create multiple components at once
os-figma render-batch '[...]'
```

---

## Export

```bash
# Screenshot current view
os-figma export screenshot -o screenshot.png

# Export variables as OutSystems CSS custom properties
os-figma export css

# Export as PNG
os-figma export png

# Export as SVG
os-figma export svg
```

---

## FigJam Commands

FigJam has its own command group with direct CDP connection:

```bash
# List open FigJam pages
os-figma figjam list
os-figma fj list  # alias

# Show page info
os-figma fj info

# List elements on page
os-figma fj nodes
os-figma fj nodes --limit 50

# Create sticky note
os-figma fj sticky "Hello World!" -x 100 -y 100
os-figma fj sticky "Yellow Note" -x 200 -y 100 --color "#FEF08A"

# Create shape with text
os-figma fj shape "Box Label" -x 100 -y 200 -w 200 -h 100
os-figma fj shape "Diamond" -x 300 -y 200 --type DIAMOND

# Create text
os-figma fj text "Plain text" -x 100 -y 400 --size 24

# Connect two nodes
os-figma fj connect "2:30" "2:34"

# Move a node
os-figma fj move "2:30" 500 500

# Update text content
os-figma fj update "2:30" "New text content"

# Delete a node
os-figma fj delete "2:30"

# Execute JavaScript in FigJam
os-figma fj eval "figma.currentPage.children.length"
```

### Shape Types
- `ROUNDED_RECTANGLE` (default)
- `RECTANGLE`
- `ELLIPSE`
- `DIAMOND`
- `TRIANGLE_UP`
- `TRIANGLE_DOWN`
- `PARALLELOGRAM_RIGHT`
- `PARALLELOGRAM_LEFT`

### Page Selection

All FigJam commands support `-p` or `--page` to target a specific page:
```bash
os-figma fj sticky "Note" -p "My Board" -x 100 -y 100
```

---

## Raw Commands

```bash
# Execute arbitrary JavaScript in Figma
os-figma eval "figma.currentPage.name"

# Run figma-use commands directly
os-figma raw query "//COMPONENT"
os-figma raw lint
os-figma raw select "1:234"
os-figma raw export "1:234" --scale 2
```

---

## Query Syntax

The query command uses XPath-like syntax:

```bash
# All frames
os-figma raw query "//FRAME"

# Frames with specific name
os-figma raw query "//FRAME[@name='OS/Card/Default']"

# All OutSystems components (name starts with OS/)
os-figma raw query "//*[@name^='OS/']"

# All components
os-figma raw query "//COMPONENT"

# Name contains
os-figma raw query "//*[contains(@name, 'Button')]"
```

---

## Selection

```bash
# Select by ID
os-figma raw select "1:234"

# Select multiple
os-figma raw select "1:234,1:235,1:236"

# Clear selection
os-figma eval "figma.currentPage.selection = []"
```

---

## Export Nodes

```bash
# Export at 2x scale
os-figma raw export "1:234" --scale 2

# Export with suffix
os-figma raw export "1:234" --scale 2 --suffix "_export"
```

---

## Daemon

```bash
# Check daemon status
os-figma daemon status

# Restart daemon
os-figma daemon restart
```