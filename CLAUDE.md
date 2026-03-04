# outsystems-figma-cli

CLI that controls Figma Desktop directly for designing OutSystems apps. No API key needed.

---

## Quick Reference

| User says | Command |
|-----------|---------|
| "connect to figma" | `node src/index.js connect` |
| "create mobile screen" | `node src/index.js render '<Frame name="OS/Screen/Mobile" w={390} h={844} ...'` |
| "create web screen" | `node src/index.js render '<Frame name="OS/Screen/Web" w={1440} h={900} ...'` |
| "add OutSystems tokens" | `node src/index.js tokens preset outsystems` |
| "show colors on canvas" | `node src/index.js var visualize` |
| "list variables" | `node src/index.js var list` |
| "find nodes named X" | `node src/index.js find "X"` |
| "what's on canvas" | `node src/index.js canvas info` |
| "export as PNG/SVG" | `node src/index.js export png` |
| "convert to component" | `node src/index.js node to-component "ID"` |

**Full command reference:** See REFERENCE.md

---

## OutSystems Design Tokens

OutSystems uses CSS custom properties as design tokens. Always use these variable names
(not raw hex values) when creating variables or binding to nodes.

### Colors
```
--color-primary           Main brand color (default: #0057D9)
--color-secondary         Secondary brand color (default: #00A3E0)
--color-neutral-0         White (#FFFFFF)
--color-neutral-100       Lightest gray
--color-neutral-200
--color-neutral-300
--color-neutral-400
--color-neutral-500       Mid gray
--color-neutral-600
--color-neutral-700
--color-neutral-800
--color-neutral-900       Darkest gray (#1A1A1A)
--color-feedback-success  (#28A745)
--color-feedback-warning  (#FFC107)
--color-feedback-error    (#DC3545)
--color-feedback-info     (#17A2B8)
```

### Typography
```
--font-size-base     16px
--font-size-h1       32px
--font-size-h2       24px
--font-size-h3       20px
--font-size-h4       18px
--font-size-h5       16px
--font-size-h6       14px
--font-weight-regular   400
--font-weight-medium    500
--font-weight-bold      700
--line-height-base      1.5
```

### Spacing
```
--space-xs    4px
--space-s     8px
--space-m     16px
--space-l     24px
--space-xl    32px
--space-2xl   48px
```

### Border Radius
```
--border-radius-s     4px
--border-radius-m     8px
--border-radius-l     16px
--border-radius-pill  999px
```

### Fast Variable Binding (var: syntax)
Use `var:name` syntax to bind OutSystems tokens directly at creation time:

```bash
node src/index.js create rect "Card" --fill "var:--color-neutral-0" --stroke "var:--color-neutral-200"
node src/index.js create frame "Section" --fill "var:--color-primary"
node src/index.js create text "Label" -c "var:--color-neutral-900"
```

```jsx
<Frame bg="var:--color-neutral-0" stroke="var:--color-neutral-200" rounded={8} p={24}>
  <Text color="var:--color-neutral-900" size={16}>Card content</Text>
  <Frame bg="var:--color-primary" px={16} py={8} rounded={4}>
    <Text color="var:--color-neutral-0">Button</Text>
  </Frame>
</Frame>
```

---

## OutSystems Fallback Colors (when no variables present)

Use these defaults if no variable collections exist in the file:

```javascript
const colors = {
  primary:        { r: 0.00, g: 0.34, b: 0.85 },  // #0057D9
  secondary:      { r: 0.00, g: 0.64, b: 0.88 },  // #00A3E0
  neutral0:       { r: 1.00, g: 1.00, b: 1.00 },  // #FFFFFF
  neutral100:     { r: 0.96, g: 0.96, b: 0.96 },  // #F5F5F5
  neutral500:     { r: 0.60, g: 0.60, b: 0.60 },  // #999999
  neutral900:     { r: 0.10, g: 0.10, b: 0.10 },  // #1A1A1A
  success:        { r: 0.16, g: 0.65, b: 0.27 },  // #28A745
  warning:        { r: 1.00, g: 0.76, b: 0.03 },  // #FFC107
  error:          { r: 0.86, g: 0.21, b: 0.27 },  // #DC3545
  info:           { r: 0.09, g: 0.64, b: 0.72 },  // #17A2B8
};
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

```
Accordion       Alert           AnimatedLabel   Balloon
Badge           BottomBar       Breadcrumbs     ButtonGroup
Card            Carousel        Columns         DatePicker
Dropdown        FileUpload      FloatingActions Gallery
IconBadge       InputWithIcon   Map             MasterDetail
Modal           Notification    ProgressBar     RangeSlider
Rating          Ribbon          Search          Section
SectionIndex    Sidebar         Skeleton        StackedCards
StatusBar       Tabs            Tag             TimePicker
Timeline        Toggle          ToolTip         Video
Wizard
```

### Example — OutSystems Card pattern
```bash
node src/index.js render '<Frame name="OS/Card/Default" w={320} bg="var:--color-neutral-0" rounded={8} flex="col" overflow="hidden" stroke="var:--color-neutral-200" strokeWidth={1}>
  <Frame name="OS/Card/Image" w="fill" h={160} bg="var:--color-neutral-100" />
  <Frame name="OS/Card/Content" flex="col" gap={8} p={16} w="fill">
    <Text name="OS/Card/Title" size={18} weight="bold" color="var:--color-neutral-900" w="fill">Card Title</Text>
    <Text name="OS/Card/Description" size={14} color="var:--color-neutral-500" w="fill">Card description text goes here.</Text>
  </Frame>
  <Frame name="OS/Card/Footer" flex="row" p={16} gap={8} w="fill">
    <Frame name="OS/Button/Primary" bg="var:--color-primary" px={16} py={8} rounded={4} flex="row" justify="center" items="center" grow={1}>
      <Text size={14} weight="medium" color="var:--color-neutral-0">Action</Text>
    </Frame>
  </Frame>
</Frame>'
```

---

## Platform Targets

Always ask or check which platform the user is designing for:

```
--platform odc        OutSystems Developer Cloud (modern, recommended)
--platform o11        OutSystems 11 / Service Studio (classic)
```

CSS export targets:
```bash
# ODC Theme CSS
node src/index.js tokens export --target odc-studio

# O11 Service Studio theme
node src/index.js tokens export --target service-studio
```

---

## Screen Templates

When a user asks to create an OutSystems screen, use these templates as a starting point.
Always ask for platform (ODC or O11) and device (mobile or web) first if not specified.

| Template | Mobile size | Web size |
|----------|-------------|----------|
| Dashboard | 390×844 | 1440×900 |
| List | 390×844 | 1440×900 |
| Detail | 390×844 | 1440×900 |
| Form | 390×844 | 1440×900 |
| Login | 390×844 | 1440×900 |
| Register | 390×844 | 1440×900 |
| Empty State | 390×844 | 1440×900 |
| Settings | 390×844 | 1440×900 |

---

## Connection Modes

### Yolo Mode (Recommended)
Patches Figma once, then connects directly. Fully automatic.
```bash
node src/index.js connect
```

### Safe Mode
Uses plugin, no Figma modification. Start plugin each session.
```bash
node src/index.js connect --safe
```
Then: Plugins → Development → FigCli

---

## Creating Components

When user asks to "create cards", "design buttons", or any OutSystems pattern:

1. **Each component = separate frame** (NOT inside parent gallery)
2. **Convert to component** after creation
3. **Use OutSystems token variables** for all colors, spacing, and radius
4. **Follow OS layer naming** (`OS/{Component}/{Variant}/{State}`)

```bash
# Step 1: Create
node src/index.js render-batch '[...]'

# Step 2: Convert to component
node src/index.js node to-component "ID1" "ID2"

# Step 3: Bind OutSystems variables
node src/index.js bind fill "--color-primary" -n "ID1"
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
stroke="var:--color-neutral-200"
strokeWidth={1}
rounded={8}             // corner radius
opacity={0.8}

// Text
<Text size={16} weight="bold" color="var:--color-neutral-900" w="fill">Hello</Text>
```

---

## Common Pitfalls

**1. Text gets cut off:**
Always add `w="fill"` to both the parent frame AND every Text element.
```jsx
// GOOD
<Frame flex="col" gap={8} w="fill">
  <Text size={16} weight="bold" color="var:--color-neutral-900" w="fill">Title</Text>
  <Text size={14} color="var:--color-neutral-500" w="fill">Description</Text>
</Frame>
```

**2. Buttons need flex for centered text:**
```jsx
// GOOD
<Frame bg="var:--color-primary" px={16} py={10} rounded={4} flex="row" justify="center" items="center">
  <Text color="var:--color-neutral-0" weight="medium">Button</Text>
</Frame>
```

**3. No emojis — use shapes as icon placeholders:**
```jsx
<Frame w={20} h={20} rounded={4} stroke="var:--color-neutral-900" strokeWidth={2} />
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
3. **Always confirm platform** (ODC or O11) before exporting CSS
4. **Always use `render` for frames** — has smart positioning
5. **Never use `eval` to create** — no positioning, overlaps at (0,0)
6. **For multiple frames:** Use `render-batch`
7. **Convert to components:** `node to-component` after creation

---

## Onboarding ("Initiate Project")

**Never show terminal commands to users.** Run silently, give friendly feedback.

1. Run `npm install` silently
2. Ask connection mode (Yolo or Safe)
3. Run `node src/index.js connect` (or `--safe`)
4. Ask: ODC or O11? Mobile or Web?
5. When connected, say: "Connected! What OutSystems screen or component would you like to design?"

If permission error (macOS): System Settings → Privacy → Full Disk Access → Add Terminal

---

## Speed Daemon

`connect` auto-starts daemon for faster commands.

```bash
node src/index.js daemon status
node src/index.js daemon restart
```