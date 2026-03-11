# outsystems-figma-cli

CLI that controls Figma Desktop directly for designing apps in Figma. No API key needed.

---

## Quick Reference

| User says | Command |
|-----------|---------|
| "start a new project" | `os-figma init` |
| "connect to figma" | `os-figma connect` |
| "sync tokens from figma" | `os-figma tokens pull` |
| "push tokens to figma" | `os-figma tokens push` |
| "check token sync status" | `os-figma tokens status` |
| "create token collections" | `os-figma tokens preset` |
| "create a screen" / "new screen" | Think → plan → execute (see Composing Screens) |
| "show colors on canvas" | `os-figma var visualize` |
| "list variables" | `os-figma var list` |
| "find nodes named X" | `os-figma find "X"` |
| "what's on canvas" | `os-figma canvas info` |
| "export as PNG/SVG" | `os-figma export png` |
| "convert to component" | `os-figma node to-component "ID"` |
| "add slot to component" | `os-figma slot create "compID" "frameID" "SlotName"` |
| "list slots" | `os-figma slot list "compID"` |
| "add content to slot" | `os-figma slot add "INST_ID" "SLOT_FRAME_ID" "CONTENT_ID"` |
| "reset slot" | `os-figma slot reset "INST_ID" "SLOT_FRAME_ID"` |
| "clear slot" | `os-figma slot clear "INST_ID" "SLOT_FRAME_ID"` |
| "describe a component" | `os-figma pattern describe Button` |
| "scan components from library" | `os-figma pattern scan` |
| "scan icons from library" | `os-figma pattern scan --icons` |
| "list available patterns" | `os-figma pattern list` |
| "add a button" / "add a card" | `os-figma pattern add Button` |

**Full command reference:** See REFERENCE.md

---

## Project Setup

Each project has its own configuration. Always run os-figma commands from the project directory.

### New project
```bash
os-figma init                  # interactive setup — connect, sync tokens, scan
                               # components and icons in one guided walkthrough
```

### Project files
- `tokens.json` — project-specific token values, synced with Figma
- `library-config.json` — Figma library connections, component keys, and icon keys

### Token workflow
```bash
os-figma tokens pull           # Foundations file → tokens.json
os-figma tokens push           # tokens.json → Foundations file
os-figma tokens status         # check for drift between tokens.json and Foundations file
os-figma tokens preset         # first-time setup only — creates token collections in Figma
```

> Token commands automatically target the file set in `library-config.json →
> libraries.foundations`. That file must be open in Figma Desktop. Use `--file`
> to override.

---

## Pattern Components

Components and icons are sourced from your Figma libraries and indexed locally in
`library-config.json`. Run the scan commands once per library, then re-run after
any library updates.

### First-time setup
```bash
# Open your component library file in Figma, then:
os-figma pattern scan

# Open your icon library file in Figma, then:
os-figma pattern scan --icons
```

### library-config.json structure
```json
{
  "libraries": {
    "components": "PDX Template - COMPONENTS",
    "icons": "PDX Template - FOUNDATIONS"
  },
  "components": {
    "Button": "abc123key",
    "Card": "def456key"
  },
  "icons": {
    "arrow-left": "xyz789key",
    "home": "def456key"
  }
}
```

### Commands
```bash
# List all scanned components (no Figma connection required)
os-figma pattern list

# Get full schema for a component (variants, states, props)
# Returns JSON by default — use --pretty for human-readable output
os-figma pattern describe Button
os-figma pattern describe Button --pretty
os-figma pattern describe "Date Picker" --json

# Add a component at viewport centre
os-figma pattern add Button

# Add with variant and state
os-figma pattern add Button --variant Primary --state Default

# Add at a specific position
os-figma pattern add Button --x 100 --y 200

# Add with component properties
os-figma pattern add Button --variant Primary --state Default \
  --prop "Text=Sign In" \
  --prop "Show icon (L)=true" \
  --prop "Icon (L)=arrow-left"
```

### --prop flag
`--prop` can be passed multiple times. Each value is a `"Key=Value"` string.
Property types are detected automatically:
- `"true"` or `"false"` → boolean
- Value matches an icon name in `library-config.json → icons` → instance swap
- Anything else → text

Property names are matched case-insensitively and do not require Figma's internal
`#id` suffix or `↳` prefix.

---

## Screen Commands

### `screen create`
Creates a blank screen frame with correct dimensions, background token binding,
and layer naming.
```bash
# Mobile screen (390×844)
os-figma screen create Login --size mobile

# Web screen (1440×900)
os-figma screen create Dashboard --size web

# Prompted if --size omitted
os-figma screen create "User Profile"
```

Layer naming: `Screen/{Size}/{Name}/Blank`
- `Screen/Mobile/Login/Blank`
- `Screen/Web/Dashboard/Blank`

Background is bound to `--color-neutral-0` from the Foundations library variable.

---

## Slots

Slots are Figma component properties (type: CHILDREN) that create flexible content
areas within components. Use slots for card bodies, modal content, list items, and
any area where child content varies between instances.

### Commands
```bash
# Convert a frame inside a component to a slot
os-figma slot create "COMP_ID" "FRAME_ID" "Content"
os-figma slot create "COMP_ID" "FRAME_ID" "Actions" --description "Action buttons area"

# List all slots on a component or instance
os-figma slot list "COMP_ID"

# Add content to a slot in an instance
os-figma slot add "INSTANCE_ID" "SLOT_FRAME_ID" "CONTENT_NODE_ID"

# Reset slot to default content from the main component
os-figma slot reset "INSTANCE_ID" "SLOT_FRAME_ID"

# Clear all content from a slot
os-figma slot clear "INSTANCE_ID" "SLOT_FRAME_ID"
```

### Slot naming convention
```
{Component}/Content     — main content slot
{Component}/Actions     — action buttons slot
{Component}/Header      — header content slot
{Component}/Footer      — footer content slot
```

### Workflow
1. Create a component with frames designated as content areas
2. Convert content frames to slots: `os-figma slot create ...`
3. Create instances of the component
4. Add different content to each instance's slot: `os-figma slot add ...`

---

## Design Tokens

CSS custom properties used as design tokens. Always use these variable names
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
Use `var:name` syntax to bind tokens directly at creation time:

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

## Screen Sizes

Standard frame sizes:

```
Mobile:   390 × 844    (iPhone 14 base)
Tablet:   768 × 1024   (iPad base)
Web:      1440 × 900   (Desktop web)
```

### Layer naming convention
Always name layers using this pattern: `{Component}/{Variant}/{State}`

Examples:
```
Screen/Mobile/Login
Screen/Web/Dashboard
Button/Primary/Default
Button/Primary/Hover
Card/Default
Input/Text/Focused
Navigation/TopBar/Mobile
Navigation/Sidebar/Web
```

---

## Composing Screens

When asked to create a screen, follow this exact workflow every time.
Deviating from it causes failures that are expensive to recover from.

---

### Think like a designer first

Before running any commands, spend time thinking about the screen as a senior
product designer would. Do not skip this step.

Ask yourself:
- What is the primary action on this screen? Everything should support it.
- What is the visual hierarchy? What does the user see first, second, third?
- What components from the library best serve each zone?
- What needs to be a real component vs a placeholder?
- What is the emotional tone — utility-focused, trust-building, data-dense?

Then write a brief design plan in your thinking. For example:

> "Login screen: trust-building, minimal. Brand zone at top third to establish
> context. Form zone centred with generous spacing so it feels approachable.
> Single primary CTA — no competition. Forgot password as low-prominence text
> link. SSO option below a clear divider so it's available but not competing."

Only after you have a clear design plan should you run `pattern list`,
`pattern describe`, and begin placing elements. The commands execute your
design — they are not a substitute for having one.

---

### Workflow

**Step 1 — Gather component schemas**

Before touching Figma, run:
```bash
os-figma pattern list
os-figma pattern describe <Component> --pretty   # for each component you plan to use
```

Use the schema to determine:
- Whether to pass `--variant` (only if the component has a Variants row)
- Whether to pass `--state` (only if the component has a States row)
- The exact `--prop` key names for labels, text, and booleans

**Step 2 — Create the screen frame**

```bash
os-figma screen create <Name> --size <mobile|web>
os-figma find "Screen/<Size>/<Name>"
# Note the returned node ID — you will use it as --parent for everything
```

**Step 3 — Render structural placeholders into the screen**

Use `os-figma render --parent <screenId>` to place structural elements
(nav bars, hero images, cards, dividers, stat counters, etc.) inside the
screen frame. Each `render` call places one element as a direct child.

```bash
os-figma render --parent "<screenId>" "<Frame name='Navigation/TopBar' w='fill' h={56} flex='row' items='center' px={16} bg='var:--color-neutral-1' stroke='var:--color-neutral-4' strokeWidth={1}><Text size={12} color='var:--color-neutral-6'>Navigation/TopBar</Text></Frame>"
```

**Step 4 — Place real components into the screen**

Use `os-figma pattern add --parent <screenId>` for every component available
in the library. Pass correct props from the schema.

```bash
os-figma pattern add Input \
  --state Default \
  --prop "Label=Email" \
  --prop "Placeholder text=Enter your email" \
  --parent "<screenId>"

os-figma pattern add Button \
  --variant Primary \
  --state Default \
  --prop "Text=Sign In" \
  --parent "<screenId>"
```

**Step 5 — Verify**

```bash
os-figma export node "<screenId>"
# Review the exported image to confirm layout
```

---

### --parent rules

- Always use `--parent <screenId>` for both `render` and `pattern add`
- `--parent` places the node as a direct child of the target frame
- If the screen frame has auto-layout, children are ordered by insertion sequence
- If you need a specific position within an absolute-layout frame, combine
  `--parent` with `--x` and `--y`
- Never place components at canvas root and try to move them later —
  there is no reparent command

---

### Sizing components after placement

`pattern add --parent` places components at their intrinsic width. After
placing any component that should fill the screen width, set fill sizing:

```bash
os-figma set sizing fill fixed -n "<componentId>"
```

Use `fill fixed` for most screen components (inputs, buttons, search, dropdowns) — fill width, fixed height. Only use `fill fill` for containers that should expand in both dimensions.

Screen frames from `screen create` are already set to vertical auto-layout with fixed dimensions — do not change their sizing mode.

---

### Component placement rules

- Always run `pattern describe` first — never guess prop names
- Only pass `--variant` if the schema shows a Variants row
- Only pass `--state` if the schema shows a States row
- Always pass `--prop` for meaningful text content (labels, button text,
  placeholder text, error messages)
- Use `Default` state unless a specific state is required

```bash
# Button — has Variants and States
os-figma pattern add Button --variant Primary --state Default \
  --prop "Text=Sign In" --parent "<screenId>"

# Input — States only, no Variants
os-figma pattern add Input --state Default \
  --prop "Label=Email" \
  --prop "Placeholder text=Enter your email" \
  --parent "<screenId>"

# Tag — Variants only, no States
os-figma pattern add Tag --variant Success \
  --prop "Text=Active" --parent "<screenId>"

# Search — check schema first, may have neither
os-figma pattern add Search --parent "<screenId>"
```

---

### Placeholder rules

Use `os-figma render --parent` for any element not in the component library.

Placeholders must:
- Use `bg='var:--color-neutral-1'` and `stroke='var:--color-neutral-4'`
  with `strokeWidth={1}`
- Include a `<Text>` label with `color='var:--color-neutral-6'` and `size={12}`
- Follow layer naming: `{Component}/{Variant}` e.g. `Card/Item`, `Media/Hero`

```bash
# Nav bar placeholder
os-figma render --parent "<screenId>" "<Frame name='Navigation/TopBar' w='fill' h={56} flex='row' items='center' px={16} gap={8} bg='var:--color-neutral-1' stroke='var:--color-neutral-4' strokeWidth={1}><Text size={12} color='var:--color-neutral-6'>Navigation/TopBar</Text></Frame>"

# Card placeholder
os-figma render --parent "<screenId>" "<Frame name='Card/Item' w='fill' h={72} flex='row' items='center' px={16} gap={12} bg='var:--color-neutral-1' stroke='var:--color-neutral-4' strokeWidth={1}><Text size={12} color='var:--color-neutral-6'>Card/Item</Text></Frame>"
```

### Placeholder sizing reference

| Element | Width | Height |
|---------|-------|--------|
| Navigation/TopBar | fill | 56 |
| Navigation/BottomBar | fill | 64 |
| Navigation/Sidebar | 240 | fill |
| Card/Item | fill | 72 |
| Card/Action | fill | 120 |
| Media/Hero | fill | 200 |
| Counter/Default | fill | 80 |
| Chart/Default | fill | 240 |
| Divider/Default | fill | 1 |
| Brand/Logo | 80 | 80 |
| Table/Default | fill | 240 |
| Pagination/Default | fill | 48 |

---

### Screen archetypes

Use these structural patterns as a guide for each screen type.
Always adapt to what components are actually available in the library.

**Login / Onboarding** (mobile)
Top spacer → logo → title text → Input (email) → Input (password) →
Button (primary) → text link (forgot password) → Divider → Button (secondary SSO)

**Login / Onboarding** (web)
Two columns: left = Brand/Illustration placeholder (~50% width),
right = centred form (logo, inputs, buttons, max-width ~400px)

**List** (mobile)
Navigation/TopBar → Search → repeated Card/Item → Navigation/BottomBar

**List** (web)
Navigation/TopBar → page header row (title + Button "Add" + Button "Filter" + Search) →
Table/Default → Pagination/Default

**Form** (mobile)
Navigation/TopBar → Input fields → Dropdown → Date Picker → Checkbox →
Button (primary, "Save")

**Form** (web)
Navigation/TopBar → two-column form (labels left, inputs right) →
footer row (Button "Save" + Button "Cancel", right-aligned)

**Detail** (mobile)
Navigation/TopBar → Media/Hero → title + Tag → body text →
Divider → repeated key/value rows → Button (primary action)

**Detail** (web)
Navigation/TopBar → two columns: left = content (hero, title, body, details),
right = Card/Action (buttons, Tag, metadata)

**Dashboard** (mobile)
Navigation/TopBar → row of Counter/Default × 2 → section heading →
repeated Card/Item → Navigation/BottomBar

**Dashboard** (web)
Navigation/TopBar → Navigation/Sidebar (left, 240px) → main content:
row of Counter/Default × 4 → two columns: Chart/Default (left ~60%) +
repeated Card/Item (right ~40%)

---

### Spacing variables

Never use hardcoded pixel values for gaps or padding.

| Token | Typical use |
|-------|-------------|
| `--space-xs` | icon gaps, tight labels |
| `--space-s` | between related elements |
| `--space-base` | default component gap |
| `--space-m` | between form fields |
| `--space-l` | between sections, screen padding (mobile) |
| `--space-xl` | large section gaps, screen padding (web) |
| `--space-xxl` | hero spacing, top padding on login |

---

### Critical rules

- **Always use `--parent`** — never place on canvas root
- **Never use `eval` to create elements** — no smart positioning
- **Never guess prop names** — always run `pattern describe` first
- **Never hardcode pixel gaps** — always use spacing variables
- **If daemon times out** — run `os-figma connect` once, then retry
- **If a command fails** — check `REFERENCE.md` for correct syntax before retrying

---

## UI Patterns

When a user asks to create a UI pattern, use these exact names.
Each pattern should be built as a component using token variables.

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

When user asks to "create cards", "design buttons", or any UI pattern:

1. **Each component = separate frame** (NOT inside parent gallery)
2. **Convert to component** after creation
3. **Use token variables** for all colors, spacing, and radius — variable names come from `tokens.json`
4. **Follow layer naming convention** (`{Component}/{Variant}/{State}`)

```bash
# Step 1: Create
os-figma render-batch '[...]'

# Step 2: Convert to component
os-figma node to-component "ID1" "ID2"

# Step 3: Bind variables
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

1. **Always use token variable names from tokens.json** — not raw hex values
2. **Always follow layer naming convention** — `{Component}/{Variant}/{State}`
3. **Always use `render` for frames** — has smart positioning
4. **Never use `eval` to create** — no positioning, overlaps at (0,0)
5. **For multiple frames:** Use `render-batch`
6. **Convert to components:** `node to-component` after creation

---

## Onboarding ("Initiate Project")

**Never show terminal commands to users.** Run silently, give friendly feedback.

1. Run `os-figma init` — guides through connection, token sync, and library scan
2. When complete, say: "Connected! What screen or component would you like to design?"

`os-figma init` generates a `CLAUDE.md` in the project directory that points
Claude Code to this file. Always launch Claude Code from the project directory,
not the CLI directory.

If permission error (macOS): System Settings → Privacy → Full Disk Access → Add Terminal

---

## Speed Daemon

`connect` auto-starts daemon for faster commands.

```bash
os-figma daemon status
os-figma daemon restart
```
