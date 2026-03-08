# outsystems-figma-cli

CLI that controls Figma Desktop directly for designing OutSystems apps. No API key needed.

---

## Quick Reference

| User says | Command |
|-----------|---------|
| "connect to figma" | `node src/index.js connect` |
| "create mobile screen" | `node src/index.js render '<Frame name="OS/Screen/Mobile" w={390} h={844} ...'` |
| "create web screen" | `node src/index.js render '<Frame name="OS/Screen/Web" w={1440} h={900} ...'` |
| "add OutSystems tokens" | `node src/index.js tokens preset` |
| "show colors on canvas" | `node src/index.js var visualize` |
| "list variables" | `node src/index.js var list` |
| "find nodes named X" | `node src/index.js find "X"` |
| "what's on canvas" | `node src/index.js canvas info` |
| "export as PNG/SVG" | `node src/index.js export png` |
| "convert to component" | `node src/index.js node to-component "ID"` |
| "add slot to component" | `node src/index.js slot create "compID" "frameID" "SlotName"` |
| "list slots" | `node src/index.js slot list "compID"` |

**Full command reference:** See REFERENCE.md

---

## OutSystems Design Tokens

OutSystems uses CSS custom properties as design tokens. Always use these variable names
(not raw hex values) when creating variables or binding to nodes.

### Color

#### Brand Palette
```
--color-primary						Main brand color (default: #1068EB)
--color-secondary					Secondary brand color (default: #303D60)
```
#### Neutral Palette
```
--color-neutral-0					White (#FFFFFF)
--color-neutral-1					(#F8F9FA)
--color-neutral-2					(#F1F3F5)
--color-neutral-3					(#E9ECEF)
--color-neutral-4					(#DEE2E6)
--color-neutral-5					(#CED4DA)
--color-neutral-6					(#ADB5BD)
--color-neutral-7					(#6A7178)
--color-neutral-8					(#4F575E)
--color-neutral-9					(#272B30)
--color-neutral-10				Black (#101213)
```
#### Semantic Palette
```
--color-info							(#017AAD)
--color-info-light				(#E5F5FC)
--color-success						(#29323B)
--color-success-light			(#EAF3EB)
--color-warning						(#E9A100)
--color-warning-light			(#FDF6E5)
--color-error							(#DC2020)
--color-error-light				(#FCEAEA)
```

### Typography

#### Font Size
```
--font-size-display		36px
--font-size-h1				32px
--font-size-h2				28px
--font-size-h3				26px
--font-size-h4				22px
--font-size-h5				20px
--font-size-h6				18px
--font-size-base			16px
--font-size-s					14px
--font-size-xs				12px
```
#### Font Weight
```
--font-light					300
--font-regular				400
--font-semi-bold			600
--font-bold						700
```

### Border

#### Border Radius
```
--border-radius-none			0px
--border-radius-soft			4px
--border-radius-rounded		100px
```
#### Border Sizes
```
--border-size-none		0px
--border-size-s				1px
--border-size-m				2px
--border-size-l				3px
```

### Spacing
```
--space-none		0px
--space-xs			4px
--space-s				8px
--space-base		16px
--space-m				24px
--space-l				32px
--space-xl			40px
--space-xxl			48px
```

### Fast Variable Binding (var: syntax)
Use `var:name` syntax to bind OutSystems tokens directly at creation time:

```bash
node src/index.js create rect "Card" --fill "var:--color-neutral-0" --stroke "var:--color-neutral-4"
node src/index.js create frame "Section" --fill "var:--color-primary"
node src/index.js create text "Label" -c "var:--color-neutral-10"
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

## OutSystems Fallback Colors (when no variables present)

Use these defaults if no variable collections exist in the file:

```javascript
const colors = {
  primary:				{ r: 0.06, g: 0.41, b: 0.92 },	// #1068EB
  secondary:			{ r: 0.19, g: 0.24, b: 0.38 },	// #303D60
  neutral0:				{ r: 1.00, g: 1.00, b: 1.00 },	// #FFFFFF
  neutral1:				{ r: 0.97, g: 0.98, b: 0.98 },	// #F8F9FA
  neutral5:				{ r: 0.81, g: 0.83, b: 0.85 },	// #CED4DA
  neutral10:			{ r: 0.06, g: 0.07, b: 0.07 },	// #101213
  info:						{ r: 0.00, g: 0.48, b: 0.68 },	// #017AAD
  success:				{ r: 0.16, g: 0.51, b: 0.23 },	// #29823B
  warning:				{ r: 0.91, g: 0.63, b: 0.00 },	// #E9A100
  error:					{ r: 0.86, g: 0.13, b: 0.13 },	// #DC2020
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

| | | | |
|---|---|---|---|
| Accordion | Carousel | Floating Actions | Radio Group |
| Alert | Checkbox | Floating Content | Range Slider |
| Badge | Chat Message | Form | Search |
| Blank Slate | Counter | Input | Section |
| Breadcrumbs | Date Picker | Input With Icon | Section Group |
| Button | Dropdown | Link | SectionIndex |
| Button Group | Dropdown Search | List | Sidebar |
| Card | Dropdown Tags | List Item Content | Switch |
| Card Background | Feedback Message | Notification | Table |
| Card Item | Flip Content | Pagination | Tabs |
| Card Sectioned | Floating Actions | Popover | Tag |
| Carousel | Floating Content | Popup | Text Area |
| | | Progress Bar | Tooltip |
| | | Progress Circle | Upload |
| | | | User Avatar |
| | | | Wizard |

### Example — OutSystems Card pattern
```bash
node src/index.js render '<Frame name="OS/Card/Default" w={320} bg="var:--color-neutral-0" rounded={8} flex="col" overflow="hidden" stroke="var:--color-neutral-5" strokeWidth={1}>
  <Frame name="OS/Card/Image" w="fill" h={160} bg="var:--color-neutral-1" />
  <Frame name="OS/Card/Content" flex="col" gap={8} p={16} w="fill">
    <Text name="OS/Card/Title" size={18} weight="bold" color="var:--color-neutral-10" w="fill">Card Title</Text>
    <Text name="OS/Card/Description" size={14} color="var:--color-neutral-5" w="fill">Card description text goes here.</Text>
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
| Detail | 390×844 | 1440×900 |
| Form | 390×844 | 1440×900 |
| Gallery | 390×844 | 1440×900 |
| List | 390×844 | 1440×900 |
| Onboarding | 390×844 | 1440×900 |

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
5. **Add slots** for flexible content areas (e.g., card body, modal content, list items)

```bash
# Step 1: Create
node src/index.js render-batch '[...]'

# Step 2: Convert to component
node src/index.js node to-component "ID1" "ID2"

# Step 3: Bind OutSystems variables
node src/index.js bind fill "--color-primary" -n "ID1"

# Step 4 (optional): Add slots for flexible content areas
node src/index.js slot create "COMP_ID" "FRAME_ID" "Content"
```

---

## Slots (Flexible Component Content)

Slots are component properties that create flexible areas within components. Designers can add, remove, and rearrange content in instances without detaching from the main component.

### When to Use Slots

- **Repeating elements** — Task lists, forms, playlists without fixed occurrences
- **Freeform layouts** — Modals, cards with varying content, flexible content areas
- **Any component where child content varies** between instances

### Slot Commands

```bash
# Convert a frame inside a component to a slot
os-figma slot create "COMP_ID" "FRAME_ID" "SlotName"

# List all slots on a component or instance
os-figma slot list "COMP_ID"

# Add content to a slot in an instance
os-figma slot add "INSTANCE_ID" "SLOT_FRAME_ID" "CONTENT_NODE_ID"

# Reset slot to default content
os-figma slot reset "INSTANCE_ID" "SLOT_FRAME_ID"

# Clear all content from a slot
os-figma slot clear "INSTANCE_ID" "SLOT_FRAME_ID"
```

### Slot Workflow Example

```bash
# 1. Create a card component with a content area
os-figma render '<Frame name="OS/Card/Slotted" w={320} bg="var:--color-neutral-0" rounded={8} flex="col" overflow="hidden" stroke="var:--color-neutral-5" strokeWidth={1}>
  <Frame name="OS/Card/Header" w="fill" p={16}>
    <Text size={18} weight="bold" color="var:--color-neutral-10" w="fill">Card Title</Text>
  </Frame>
  <Frame name="OS/Card/Content" flex="col" gap={8} p={16} w="fill" />
  <Frame name="OS/Card/Footer" flex="row" p={16} gap={8} w="fill" />
</Frame>'

# 2. Convert to component
os-figma node to-component "FRAME_ID"

# 3. Make the Content frame a slot
os-figma slot create "COMP_ID" "CONTENT_FRAME_ID" "Content"

# 4. Make the Footer frame a slot
os-figma slot create "COMP_ID" "FOOTER_FRAME_ID" "Actions"

# 5. Now instances can have different content in each slot
```

### Slot Naming Convention
Follow the OS layer naming pattern for slot frames:
```
OS/{Component}/Content     — main content slot
OS/{Component}/Actions     — action buttons slot
OS/{Component}/Header      — header content slot
OS/{Component}/Footer      — footer content slot
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