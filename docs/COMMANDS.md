# Commands Reference

> All commands use the `os-figma` alias. See README for alias setup instructions.

---

## Setup & Connection

```bash
# Connect to running Figma Desktop
os-figma connect

# Initialise a new project in the current directory
# Prompts for project name, Foundations library, and Components library
# Then runs an interactive walkthrough:
#   1. Connects to Figma Desktop
#   2. Pulls tokens and styles from Foundations file
#   3. Scans icons from Foundations file
#   4. Scans components from Components file
os-figma init
```

> `init` handles the full project setup in one flow. You do not need to run
> `tokens pull`, `pattern scan`, or `pattern scan --icons` separately for
> a new project.
>
> Generates a CLAUDE.md in the project directory so Claude Code has full
> context when launched from that directory.

---

## Preflight Check

```bash
# Run all session precondition checks in one pass
os-figma doctor
```

Checks Figma Desktop, daemon, design file, `tokens.json`, `library-config.json`,
and library variable reachability. Exits with code 0 if all pass, code 1 if any
fail. Read-only — does not modify any files or Figma state.

---

## Design Tokens

```bash
# OutSystems UI tokens (colors, spacing, radius, typography)
os-figma tokens preset outsystems

# Spacing scale (4px base)
os-figma tokens spacing

# Border radii
os-figma tokens radii

# Pull token values from the Foundations file into local tokens.json
# Targets library-config.json → libraries.foundations automatically
# Foundations file must be open in Figma Desktop
os-figma tokens pull

# Override target file
os-figma tokens pull --file "PDX Template - FOUNDATIONS"

# Push local tokens.json values to the Foundations file in Figma
# Targets library-config.json → libraries.foundations automatically
# Foundations file must be open in Figma Desktop
os-figma tokens push

# Override target file
os-figma tokens push --file "PDX Template - FOUNDATIONS"

# Check local tokens.json state (no Figma connection needed)
# Reports token count, collection count, and whether variable keys are present
os-figma tokens status

# Compare tokens.json against live Figma variables (Foundations file must be open)
os-figma tokens status --sync

# Override target file for live comparison
os-figma tokens status --sync --file "PDX Template - FOUNDATIONS"
```

---

## Styles

```bash
# Pull text and effect styles from the Foundations file into styles.json
# Foundations file must be open in Figma Desktop
os-figma styles pull

# Override target file
os-figma styles pull --file "PDX Template - FOUNDATIONS"

# Check local styles.json state (no Figma connection needed)
os-figma styles status

# Compare styles.json against live Figma styles (Foundations file must be open)
os-figma styles status --sync
os-figma styles status --sync --file "PDX Template - FOUNDATIONS"
```

> `styles pull` must be run with the Foundations library file open in
> Figma Desktop. Re-run whenever styles are added or updated in the library.

---

## Pattern Components

```bash
# Scan the current Figma document for component keys and save to library-config.json
# Run once after opening a file that contains your library components
# Re-run if the library is updated
os-figma pattern scan

# Scan the current Figma document for icon keys and save to library-config.json
# Open your icon/foundations library file in Figma first
# Re-run if the icon library is updated
os-figma pattern scan --icons

# List all components saved in library-config.json (no Figma connection required)
os-figma pattern list

# Get the full schema for a component — variants, states, and all props
# Returns structured JSON by default
os-figma pattern describe Button

# Human-readable summary
os-figma pattern describe Button --pretty

# Component names with spaces require quotes
os-figma pattern describe "Date Picker"

# Add a component instance to the canvas (placed at viewport centre by default)
os-figma pattern add Button

# Add with a specific variant
os-figma pattern add Button --variant Primary

# Add with variant and state
os-figma pattern add Button --variant Primary --state Hover

# Add at a specific position
os-figma pattern add Card --x 100 --y 200

# Add with component properties (--prop can be passed multiple times)
os-figma pattern add Button --variant Primary --state Default \
  --prop "Text=Sign In"

# Boolean property
os-figma pattern add Button --variant Primary \
  --prop "Show icon (L)=true"

# Instance swap — value must match an icon name from pattern scan --icons
os-figma pattern add Button --variant Primary \
  --prop "Icon (L)=arrow-left"

# Full combination
os-figma pattern add Button --variant Primary --state Default \
  --prop "Text=Sign In" \
  --prop "Show icon (L)=true" \
  --prop "Icon (L)=arrow-left"

# Add component inside a specific parent frame
os-figma pattern add Input --state Default --prop "Label=Email" --parent "94:10"

# Add at specific position inside parent
os-figma pattern add Button --variant Primary --parent "94:10" --x 32 --y 400

# Add with automatic fill-width sizing (preferred for full-width components)
os-figma pattern add Input --state Default \
  --prop "Label=Email" \
  --parent "<screenId>" \
  --sizing fill

os-figma pattern add Button --variant Primary --state Default \
  --prop "Text=Sign In" \
  --parent "<screenId>" \
  --sizing fill
```

> **First-time setup:** Run `os-figma pattern scan` once with your component library
> file open in Figma, and `os-figma pattern scan --icons` with your icon library file
> open. Both save keys to `library-config.json`. Re-run after any library updates.

---

## Screens

```bash
# Create a blank mobile screen (390×844)
# Background bound to --color-neutral-0
# Layer named Screen/Mobile/{Name}/Blank
os-figma screen create Login --size mobile

# Create a blank web screen (1440×900)
os-figma screen create Dashboard --size web

# Omit --size to be prompted
os-figma screen create "User Profile"

# Create with padding and gap in one step
# Padding values matching the spacing scale are auto-bound to spacing tokens
os-figma screen create Login --size mobile --padding 32,32,48,32 --gap 16
os-figma screen create Dashboard --size web --padding 48,80,64,80 --gap 24
```

For composing full screens with components, use pattern list, pattern describe,
pattern add, and render together. See CLAUDE.md → Composing Screens.

---

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

## Modify Elements

```bash
# Set layout sizing on a node (must be child of an auto-layout frame)
os-figma set sizing fill fixed -n "105:41"   # fill width, fixed height
os-figma set sizing fill fill -n "105:41"    # fill both dimensions
os-figma set sizing fixed fixed -n "105:41"  # fixed both (default)

# Apply effect style (shadow, blur) from styles.json
os-figma bind effect "Shadow/Card"               # selected node
os-figma bind effect "Shadow/Card" -n "1:234"    # specific node

# Apply text style from styles.json (node must be type TEXT)
os-figma bind text-style "Heading/H1"            # selected node
os-figma bind text-style "Body/Base" -n "1:234"  # specific node
```

---

## Create Elements

```bash
# Create a mobile screen frame
os-figma create frame "Screen/Mobile" -w 390 -h 844

# Create a web screen frame
os-figma create frame "Screen/Web" -w 1440 -h 900

# Create a frame with token fill
os-figma create frame "Card/Default" -w 320 -h 200 --fill "var:--color-neutral-0" --radius 8

# Create an icon (Iconify, 150k+ icons)
os-figma create icon lucide:star -s 24 -c "#f59e0b"
os-figma create icon mdi:home -s 32 -c "#3b82f6"
```

---

## JSX Rendering

```bash
# Create a Card component
os-figma render '<Frame name="Card/Default" w={320} bg="var:--color-neutral-0" rounded={8} flex="col" overflow="hidden" stroke="var:--color-neutral-4" strokeWidth={1}>
  <Frame name="Card/Image" w="fill" h={160} bg="var:--color-neutral-1" />
  <Frame name="Card/Content" flex="col" gap={8} p={16} w="fill">
    <Text size={18} weight="bold" color="var:--color-neutral-10" w="fill">Card Title</Text>
    <Text size={14} color="var:--color-neutral-7" w="fill">Card description text.</Text>
  </Frame>
</Frame>'

# Render JSX as a child of an existing frame
os-figma render --parent "94:10" "<Frame name='Header/Nav' w='fill' h={56} bg='var:--color-neutral-1' />"

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

# Export node as PNG to screenshots/ folder, returns absolute path for Claude Code review
os-figma export node "1:234" --feedback
```

---

## Node Operations

```bash
# Show the node tree structure
os-figma node tree "123:456"
os-figma node tree "123:456" --depth 5

# Show variable bindings for a node
os-figma node bindings "123:456"

# Inspect a node — geometry, layout, fills, effects, children, and design system warnings
os-figma node inspect "123:456"            # JSON output
os-figma node inspect "123:456" --deep     # include full recursive child tree
os-figma node inspect "123:456" --summary  # human-readable condensed output
os-figma node inspect                      # inspect current Figma selection
os-figma node inspect -n "123:456"         # inspect by node ID without selecting

# Automatically fix design system warnings found by inspect
os-figma node fix "123:456"                # inspect and apply all auto-fixable warnings
os-figma node fix "123:456" --dry-run      # print fix plan without applying
os-figma node fix "123:456" --deep         # fix warnings on all descendant nodes
os-figma node fix                          # fix current Figma selection

# Convert frames to components
os-figma node to-component "123:456"

# Delete nodes by ID
os-figma node delete "123:456"
```

---

## Slots

Slots are component properties that create flexible content areas within components. Designers can add, remove, and rearrange content in instances without detaching.

```bash
# Convert a frame inside a component to a slot
os-figma slot create "COMP_ID" "FRAME_ID" "Content"
os-figma slot create "COMP_ID" "FRAME_ID" "Actions" --description "Action buttons area"

# List all slots on a component or instance
os-figma slot list "COMP_ID"

# Add content to a slot in an instance
os-figma slot add "INSTANCE_ID" "SLOT_FRAME_ID" "CONTENT_NODE_ID"

# Reset slot to its default content from the main component
os-figma slot reset "INSTANCE_ID" "SLOT_FRAME_ID"

# Clear all content from a slot (empty it)
os-figma slot clear "INSTANCE_ID" "SLOT_FRAME_ID"
```

### Slot Workflow
1. Create a component with frames designated as content areas
2. Convert content frames to slots: `os-figma slot create ...`
3. Create instances of the component
4. Add different content to each instance's slot: `os-figma slot add ...`

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
os-figma raw query "//FRAME[@name='Card/Default']"

# Layers starting with a prefix
os-figma raw query "//*[@name^='Card/']"

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

---

## Dev Tools

```bash
# Audit Figma API coverage — cross-references src/ against FIGMA-API-COVERAGE.md
node scripts/audit-coverage.js

# Output audit results as JSON
node scripts/audit-coverage.js --json

# Auto-update FIGMA-API-COVERAGE.md from findings (backs up before writing)
node scripts/audit-coverage.js --fix
```

Run the audit at the start and end of every development session. Any new `runCode()` call must have a `@figma-api` comment above it — see FIGMA-API-COVERAGE.md for the annotation convention.
