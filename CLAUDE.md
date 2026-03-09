# outsystems-figma-cli

CLI that controls Figma Desktop directly for designing OutSystems apps. No API key needed.

---

## Quick Reference

| User says | Command |
|-----------|---------|
| "start a new project" | `os-figma init` |
| "connect to figma" | `os-figma connect` |
| "sync tokens from figma" | `os-figma tokens pull` |
| "push tokens to figma" | `os-figma tokens push` |
| "check token sync status" | `os-figma tokens status` |
| "add outsystems tokens" | `os-figma tokens preset` |
| "create mobile screen" | `os-figma render '<Frame name="OS/Screen/Mobile" w={390} h={844} ...'` |
| "create web screen" | `os-figma render '<Frame name="OS/Screen/Web" w={1440} h={900} ...'` |
| "show colors on canvas" | `os-figma var visualize` |
| "list variables" | `os-figma var list` |
| "find nodes named X" | `os-figma find "X"` |
| "what's on canvas" | `os-figma canvas info` |
| "export as PNG/SVG" | `os-figma export png` |
| "convert to component" | `os-figma node to-component "ID"` |
| "add slot to component" | `os-figma slot create "compID" "frameID" "SlotName"` |
| "list slots" | `os-figma slot list "compID"` |

**Full command reference:** See REFERENCE.md

---

## Project Setup

Each project has its own configuration. Always run os-figma commands from the project directory.

### New project
```bash
os-figma init                  # creates tokens.json and library-config.json
os-figma tokens pull           # syncs token values from Figma
```

### Project files
- `tokens.json` — project-specific token values, synced with Figma
- `library-config.json` — Figma library connections (Foundations + Components)

### Token workflow
```bash
os-figma tokens pull           # Figma → tokens.json (after manual Figma edits)
os-figma tokens push           # tokens.json → Figma (after local edits)
os-figma tokens status         # check for drift between tokens.json and Figma
os-figma tokens preset         # first-time setup only — creates token collections in Figma
```

---

## OutSystems Design Tokens

OutSystems uses CSS custom properties as design tokens. Always use these variable names
(not raw hex values) when creating variables or binding to nodes.

Token values are project-specific and stored in `tokens.json` in each project directory.
Run `os-figma tokens pull` to sync current values from Figma.
Run `os-figma tokens status` to check if tokens are in sync.

### Color

#### Brand Palette
```
--color-primary						Main brand color
--color-secondary					Secondary brand color
```
#### Neutral Palette
```
--color-neutral-0					White
--color-neutral-1
--color-neutral-2
--color-neutral-3
--color-neutral-4
--color-neutral-5
--color-neutral-6
--color-neutral-7
--color-neutral-8
--color-neutral-9
--color-neutral-10				Black
```
#### Semantic Palette
```
--color-info
--color-info-light
--color-success
--color-success-light
--color-warning
--color-warning-light
--color-error
--color-error-light
```

### Typography

#### Font Size
```
--font-size-display
--font-size-h1
--font-size-h2
--font-size-h3
--font-size-h4
--font-size-h5
--font-size-h6
--font-size-base
--font-size-s
--font-size-xs
```
#### Font Weight
```
--font-light
--font-regular
--font-semi-bold
--font-bold
```

### Border

#### Border Radius
```
--border-radius-none
--border-radius-soft
--border-radius-rounded
```
#### Border Sizes
```
--border-size-none
--border-size-s
--border-size-m
--border-size-l
```

### Spacing
```
--space-none
--space-xs
--space-s
--space-base
--space-m
--space-l
--space-xl
--space-xxl
```

### Fast Variable Binding (var: syntax)
Use `var:name` syntax to bind OutSystems tokens directly at creation time:

```bash
os-figma create rect "Card" --fill "var:--color-neutral-0" --stroke "var:--color-neutral-4"
os-figma create frame "Section" --fill "var:--color-primary"
os-figma create text "Label" -c "var:--color-neutral-10"
```

```jsx
<Frame bg="var:--color-neutral-0" stroke="var:--color-neutral-4" rounded={8} p={24}>
  <Text color="var:--color-neutral-10" size={16}>Card content</Text>
  <Frame bg="var:--color-primary" px={16} py={8} rounded={4}>
    <Text color="var:--color-neutral-0">Button</Text>
  </Frame>
</Frame>
```

---

## OutSystems Screen Sizes

Always use these frame sizes for OutSystems app designs:

```
Mobile:   390 × 844    (iPhone 14 base — used for ODC mobile apps)
Tablet:   768 × 1024   (iPad base)
Web:      1440 × 900   (Desktop web)
```

### Layer naming convention
Always name layers using this pattern: `OS/{Component}/{Variant}/{State}`

Examples:
```
OS/Screen/Mobile/Login
OS/Screen/Web/Dashboard
OS/Button/Primary/Default
OS/Button/Primary/Hover
OS/Card/Default
OS/Input/Text/Focused
OS/Navigation/TopBar/Mobile
OS/Navigation/Sidebar/Web
```

---

## OutSystems UI Patterns

When a user asks to create an OutSystems UI pattern, use these exact names.
Each pattern should be built as a component using OutSystems token variables.

- Accordion
- Alert
- Button
- Checkbox
- Chip
- Date Picker
- Dropdown
- Input
- Radio Button
- Search
- Tags

---

## Platform Targets

Always ask or check which platform the user is designing for:

```
--platform odc        OutSystems Developer Cloud (modern, recommended)
--platform o11        OutSystems 11 / Service Studio (classic)
```

---

## Connection Modes

### Yolo Mode (Recommended)
Patches Figma once, then connects directly. Fully automatic.
```bash
os-figma connect
```

### Safe Mode
Uses plugin, no Figma modification. Start plugin each session.
```bash
os-figma connect --safe
```
Then: Plugins → Development → FigCli

---

## Creating Components

When user asks to "create cards", "design buttons", or any OutSystems pattern:

1. **Each component = separate frame** (NOT inside parent gallery)
2. **Convert to component** after creation
3. **Use OutSystems token variables** for all colors, spacing, and radius — variable names come from `tokens.json`
4. **Follow OS layer naming** (`OS/{Component}/{Variant}/{State}`)

```bash
# Step 1: Create
os-figma render-batch '[...]'

# Step 2: Convert to component
os-figma node to-component "ID1" "ID2"

# Step 3: Bind OutSystems variables
os-figma bind fill "--color-primary" -n "ID1"
```

---

## JSX Syntax (render command)

```jsx
// Layout
flex="row"              // or "col"
gap={16}                // spacing between items
p={24}                  // padding all sides
px={16} py={8}          // padding x/y

// Alignment
justify="center"        // start, center, end, between
items="center"          // start, center, end

// Size
w={320} h={200}         // fixed size
w="fill" h="fill"       // fill parent

// Appearance
bg="#fff"               // fill color (use token vars instead when possible)
bg="var:--color-primary"
stroke="var:--color-neutral-5"
strokeWidth={1}
rounded={8}             // corner radius
opacity={0.8}

// Text
<Text size={16} weight="bold" color="var:--color-neutral-10" w="fill">Hello</Text>
```

---

## Common Pitfalls

**1. Text gets cut off:**
Always add `w="fill"` to both the parent frame AND every Text element.
```jsx
// GOOD
<Frame flex="col" gap={8} w="fill">
  <Text size={16} weight="bold" color="var:--color-neutral-10" w="fill">Title</Text>
  <Text size={14} color="var:--color-neutral-5" w="fill">Description</Text>
</Frame>
```

**2. Buttons need flex for centered text:**
```jsx
// GOOD
<Frame bg="var:--color-primary" px={16} py={10} rounded={4} flex="row" justify="center" items="center">
  <Text color="var:--color-neutral-0" weight="semi-bold">Button</Text>
</Frame>
```

**3. No emojis — use shapes as icon placeholders:**
```jsx
<Frame w={20} h={20} rounded={4} stroke="var:--color-neutral-10" strokeWidth={2} />
```

**4. Push items to edges (navbar/topbar pattern):**
```jsx
<Frame flex="row" items="center" w="fill" p={16}>
  <Frame>Logo</Frame>
  <Frame grow={1} />
  <Frame>Menu</Frame>
</Frame>
```

**5. Common wrong → right JSX props:**
```
layout="horizontal"  →  flex="row"
padding={24}         →  p={24}
fill="#fff"          →  bg="#fff"
cornerRadius={8}     →  rounded={8}
fontSize={16}        →  size={16}
fontWeight="bold"    →  weight="bold"
```

---

## Key Rules

1. **Always use OutSystems token variable names**, not raw hex values
2. **Always follow OS layer naming** — `OS/{Component}/{Variant}/{State}`
3. **Always confirm platform** (ODC or O11) — affects screen sizes, component structure, and future CSS export
4. **Always use `render` for frames** — has smart positioning
5. **Never use `eval` to create** — no positioning, overlaps at (0,0)
6. **For multiple frames:** Use `render-batch`
7. **Convert to components:** `node to-component` after creation

---

## Onboarding ("Initiate Project")

**Never show terminal commands to users.** Run silently, give friendly feedback.

1. Run `os-figma connect` (Yolo or Safe mode)
2. Run `os-figma init` to set up project files
3. Run `os-figma tokens pull` to sync tokens from Figma
4. Ask: ODC or O11? Mobile or Web?
5. When connected, say: "Connected! What OutSystems screen or component would you like to design?"

If permission error (macOS): System Settings → Privacy → Full Disk Access → Add Terminal

---

## Speed Daemon

`connect` auto-starts daemon for faster commands.

```bash
os-figma daemon status
os-figma daemon restart
```
