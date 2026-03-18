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
| "sync styles from figma" | `os-figma styles pull` |
| "check styles sync status" | `os-figma styles status` |
| "create a screen" / "new screen" | Think → plan → execute (see Composing Screens) |
| "show colors on canvas" | `os-figma var visualize` |
| "list variables" | `os-figma var list` |
| "find nodes named X" | `os-figma find "X"` |
| "find most recently added node" | `os-figma find "X" --type INSTANCE --last` |
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
| "list available patterns" | `os-figma pattern list` — lists components and icons |
| "add a button" / "add a card" | `os-figma pattern add Button` |
| "add an icon" | `os-figma pattern add <iconName> --parent "<id>"` |
| "screenshot the screen" / "check the output" | `os-figma export node "<id>" --feedback` |
| "inspect a node" | `os-figma node inspect "<id>"` |
| "inspect current selection" | `os-figma node inspect` |
| "check colour contrast" | `os-figma accessibility check "<id>" --deep` |
| "run preflight checks" | `os-figma doctor` |
| "deep node tree" | `os-figma node inspect "<id>" --deep` |
| "fix design system warnings" | `os-figma node fix "<id>" --deep` — **prefer this in the evaluate loop** |
| "inspect without fixing (debug only)" | `os-figma node inspect "<id>" --summary` |
| "apply shadow to node" | `os-figma bind effect "Shadow/Card" -n "<id>"` |
| "apply text style to node" | `os-figma bind text-style "Heading/H1" -n "<id>"` |
| "rename a node" | `os-figma set name "<id>" "<name>"` |
| "take a screenshot of a screen" | `os-figma export node "<id>" --feedback` — saves PNG to screenshots/, prints path for immediate evaluation |

**Full command reference:** See REFERENCE.md

---

## Session Start

**New project:** Run `os-figma init` — handles connection, token sync, style
sync, and library scan in one guided flow. No other setup commands needed.

**Returning session (run every time before designing):**
```bash
os-figma connect
os-figma tokens pull    # open Foundations file in Figma first
os-figma styles pull    # Foundations file must still be active
```

Token and style values are project-specific and stored in `tokens.json` and `styles.json` in the project directory. Never assume these files are in sync from a previous session — always pull before designing.

> **Why the order matters:** `tokens pull` and `styles pull` both require
> the Foundations library file to be the active tab in Figma Desktop. Run
> them together at session start while that file is open. Once you switch
> to your working design file, do not attempt to pull again — use
> `os-figma tokens status` and `os-figma styles status` to check sync
> state without requiring the Foundations file to be active.

---

## Project Setup

Each project has its own configuration. Always run os-figma commands from the project directory.

### New project
```bash
os-figma init                  # interactive setup — connect, sync tokens and styles,
                               # scan components and icons in one guided walkthrough
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

# Add component with automatic fill-width sizing
os-figma pattern add Button --variant Primary --state Default \
  --prop "Text=Sign In" \
  --parent "<screenId>" \
  --sizing fill
```

`--sizing fill` sets `layoutSizingHorizontal = FILL` immediately after
placement. Use for all full-width components: Input, Button, Search,
Dropdown, Date Picker, Alert, Accordion.

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

> `screen create` is an optional utility. For full design control over
> padding, gap, and naming, render the screen frame directly using
> `os-figma render` — see Composing Screens → Step 2.

Creates a blank screen frame with correct dimensions, background token binding,
and layer naming.
```bash
# Mobile screen (390×844)
os-figma screen create Login --size mobile

# Web screen (1440×900)
os-figma screen create Dashboard --size web

# Prompted if --size omitted
os-figma screen create "User Profile"

# With padding and gap — choose values based on the design, not a default
os-figma screen create Login --size mobile --padding <t,r,b,l> --gap <n>
```

When `--padding` values match the spacing token scale (0, 4, 8, 16, 24, 32,
40, 48), padding is automatically bound to the corresponding spacing variable.

Layer naming: `Screen/{Size}/{Name}/Blank`
- `Screen/Mobile/Login/Blank`
- `Screen/Web/Dashboard/Blank`

Background is bound to `--color-neutral-0` from the Foundations library variable.

> `screen create` prints the node ID on success:
> ```
> ✔ Created Screen/Mobile/Login/Blank (390×844)
>   id: 216:5
> ```
> `os-figma render` also returns the node ID directly and gives full
> control over padding, gap, and naming — preferred for screen composition.

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

### Fast Variable Binding

Use `var:--token-name` syntax in JSX and `--token-name` with `bind` commands
to bind tokens at creation time. See Render Best Practices and JSX Syntax sections.

---

## Design Styles

Style keys and properties are synced from the Foundations library and stored
in `styles.json` in the project directory. Run `os-figma styles pull` once
per project, then re-run after any library updates.

### Effect styles
Named shadows and blurs. Keys stored in `styles.json → effects`.

Common names to expect:
- `Shadow/Card` — elevation 1, cards and panels
- `Shadow/Overlay` — elevation 3, modals and drawers
- `Shadow/Dropdown` — elevation 2, dropdowns and tooltips
- `Blur/Modal` — background blur for modal overlays

Apply with: `os-figma bind effect "Shadow/Card" -n "<nodeId>"`

### Text styles
Named type ramp entries. Keys stored in `styles.json → text`.

Apply with: `os-figma bind text-style "Heading/H1" -n "<nodeId>"`

### Applying styles

```bash
# Apply shadow/blur to any node
os-figma bind effect "Shadow/Card" -n "<nodeId>"

# Apply text style to a TEXT node
os-figma bind text-style "Heading/H1" -n "<nodeId>"
```

Style names must match `styles.json` exactly (case-insensitive match is attempted as a fallback). Run `os-figma styles pull` if a style is missing.

> Always run `os-figma styles pull` when starting a new project or after
> library updates. Token values are project-specific — never assume styles
> from one project match another.

---

## Screen Sizes

Standard frame sizes:

```
Mobile:   390 × 844    (iPhone 14 base)
Tablet:   768 × 1024   (iPad base)
Web:      1440 × 900   (Desktop web)
```

### Layer naming convention
Name layers the way a designer would — descriptive, natural, and specific
to the design intent.

- Screen frames: plain language — `"Login — Mobile"`, `"Dashboard"`
- Child frames: describe their role — `"Logo"`, `"Form"`, `"Actions"`
- Components added via `pattern add` keep their library name
- Avoid generic names: `"Frame"`, `"Group"`, `"Container"`

A name is good if someone unfamiliar with the session can understand
what the layer is from the Figma layer panel alone.

Examples:
```
Login — Mobile
Dashboard
Logo
Email field
Password field
Sign in button
Forgot password
Divider
Continue with Google
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
- Where does content sit vertically? Centred, top-weighted, or evenly distributed?
- Does every zone have breathing room from the screen edges?
- Are spacing gaps between elements consistent and intentional?

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

**Step 0 — Verify project state**

Before designing, confirm local config is ready. These commands are
read-only and do not require the Foundations file to be active:
```bash
os-figma tokens status    # confirms tokens.json exists and is not empty
os-figma styles status    # confirms styles.json exists and is not empty
os-figma pattern list     # confirms library-config.json has indexed components
```
If `tokens status` or `styles status` reports missing or empty files, stop and ask the user to run the session-start sync before proceeding. Do not attempt `tokens pull` or `styles pull` here — those require the Foundations library file to be active in Figma, which it is not during design.

**Step 1 — Gather component schemas (required output)**

For every component you plan to place, run `pattern describe` and record:
- Whether it has a Variants row (determines if `--variant` is valid)
- Whether it has a States row (determines if `--state` is valid)
- The exact `--prop` key names as returned (do not guess or abbreviate)

```bash
os-figma pattern list
os-figma pattern describe <Component> --pretty   # repeat for every component you plan to use
```
Do not proceed to Step 2 until you have `describe` output for every component you intend to place. Guessing prop names causes silent failures that are expensive to recover from.

Use the schema to determine:
- Whether to pass `--variant` (only if the component has a Variants row)
- Whether to pass `--state` (only if the component has a States row)
- The exact `--prop` key names for labels, text, and booleans

**Step 2 — Render the screen frame**

Render the screen frame directly. Choose dimensions based on platform.
Choose padding and gap based on what the design requires — not a default.

Standard dimensions:
- Mobile: `w={390} h={844}`
- Tablet: `w={768} h={1024}`
- Web: `w={1440} h={900}`

```bash
os-figma render '<Frame name="Login — Mobile" w={390} h={844} flex="col"
  bg="var:--color-neutral-0" p={...} gap={...}>'
# Note the returned node ID — used as --parent for all subsequent calls
```

> `render` prints the node ID and name on success:
> ```
> ✓ Rendered: 211:4
>   name: Login — Mobile
> ```
> Note this ID immediately — it is used as `--parent` for all subsequent
> calls. No follow-up `os-figma find` needed.

**Naming:** Choose a name that describes the screen naturally. Good: `"Login — Mobile"`, `"Dashboard"`, `"Onboarding / Step 1"`. Avoid: `"Screen/Mobile/Login/Blank"`, `"Frame 1"`.

**Padding and gap:** Decide based on the screen type and content density.

- How much breathing room does this screen need?
- Should content feel spacious or compact?
- Does top padding need to account for a status bar or safe area?

Never use a default value without questioning whether it fits the design.

**Step 3 — Render structural placeholders into the screen**

Use `os-figma render --parent <screenId>` to place structural elements
(nav bars, hero images, cards, dividers, stat counters, etc.) inside the
screen frame. Each `render` call places one element as a direct child.

Always use `--parent` — see Render Best Practices rule 1.

```bash
os-figma render --parent "<screenId>" "<Frame name='Navigation/TopBar' w='fill' h={56} flex='row' items='center' px={16} bg='var:--color-neutral-1' stroke='var:--color-neutral-4' strokeWidth={1}><Text size={12} color='var:--color-neutral-6'>Navigation/TopBar</Text></Frame>"
```

> `render` prints the node ID on success — note it immediately.

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

> `pattern add` prints the node ID on success:
> ```
> ✔ Added Input (State=Default) from PDX Template - COMPONENTS
>   id: 216:48
>   Props: Label=Email
> ```
> Note the ID if post-placement operations are needed (e.g. applying an
> effect style or overriding sizing). If a ⚠ appears next to a prop, the
> key is wrong — run `pattern describe <Component>` to check exact keys.

**Step 4b — Set fill-width sizing**

After placing any component that should span the full screen width,
apply fill sizing. Prefer `--sizing fill` at placement time:

```bash
# Preferred — apply sizing at placement time
os-figma pattern add Input --state Default \
  --prop "Label=Email" \
  --parent "<screenId>" \
  --sizing fill

# Alternative — apply after placement if --sizing was not used
os-figma set sizing fill fixed -n "<componentId>"
```

Apply this to every full-width component before moving on to the next one.
Do not batch this step — apply sizing immediately after each placement.

Full-width components: Input, Button, Search, Dropdown, Date Picker,
Alert, Accordion.

Components placed as decorative or inline elements (Tag, Avatar, Icon)
do not need fill sizing.

**Step 5 — Evaluate and fix (loop until clean)**

This step repeats until all warnings are cleared and the screenshot matches
the design plan. Do not exit this loop early.

**Loop:**

1. Export a screenshot and read the file immediately:
   ```bash
   os-figma export node "<screenId>" --feedback
   ```
   `--feedback` saves the export to `screenshots/` in the project directory
   and prints the absolute file path. Read the file at that path to evaluate
   the layout against your design plan. Trust your eye first — if something
   looks wrong, it probably is.
2. Evaluate the screenshot against your design plan:

   - Does the visual hierarchy match your plan?
   - Is content vertically distributed as intended, or bunched at top/bottom?
   - Do all full-width components span the screen correctly?
   - Is spacing between elements consistent and intentional?
   - Are placeholder frames visible (light grey with label)?
   - Is the brand/logo zone rendering correctly?

3. Run the auto-fixer across the full node tree:

   ```bash
   os-figma node fix "<screenId>" --deep
   ```

4. If `node fix` exits with code 1 (unresolved warnings remain), apply those bindings manually then re-run:

   ```bash
   os-figma bind fill "--color-neutral-0" -n "<nodeId>"
   os-figma bind stroke "--color-neutral-4" -n "<nodeId>"
   os-figma bind effect "Shadow/Card" -n "<nodeId>"
   os-figma bind text-style "Heading/H1" -n "<nodeId>"
   os-figma node fix "<screenId>" --deep   # re-run to confirm all clear
   ```

5. Return to step 1 and re-export.

After `node fix --deep` exits clean, optionally run a contrast check:
```bash
os-figma accessibility check "<screenId>" --deep
```
Exits code 0 if all text passes WCAG AA. Add `--level AAA` for stricter checking. Address any failures before declaring the screen complete.

**Exit condition:** `node fix --deep` exits with code 0 (no warnings) AND the screenshot matches the design plan. Both conditions must be true. Only then is the screen complete.

**Step 5b — Clean up canvas and commit**

Before committing, delete any loose frames left at page root that are not
screen containers. These are typically orphaned spacer frames or test frames
from the build process.
```bash
# Find frames at page root that are not screen containers
os-figma find "Spacer" --type FRAME
# Delete any returned IDs that sit at page root (parentId = page, not a screen)
os-figma delete "<id>"

# Also check for any other non-screen frames at page root
os-figma canvas info
```

Then create a single undo checkpoint:
```bash
os-figma eval "figma.commitUndo()"
```

---

### --parent rules

Always use `--parent <screenId>` for both `render` and `pattern add` — see Render Best Practices rule 1.

---

### Vertical spacing between elements

The screen frame's `itemSpacing` controls the gap between all direct children.
Set it once after creating the screen:

```bash
os-figma gap 16 -n "<screenId>"    # example — choose based on content density
```

For sections that need significantly more breathing room than the screen
gap provides, use a fixed-height spacer frame — choose the height based
on what the design needs, not a default value.

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

# Place a standalone icon from the icon library
os-figma pattern add keyboard_arrow_left --parent "<screenId>"

# Use --icons flag to disambiguate when name exists in both components and icons
os-figma pattern add close --icons --parent "<screenId>"
```

Icons are looked up from `library-config.json → icons`. If a name exists in
both components and icons, `--icons` is required to disambiguate. Run
`os-figma pattern list` to see all available components and icons.

Icons do not support `--variant`, `--state`, or `--prop`. Use `--sizing`
and `--parent` as with any other pattern.

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

# Brand/Logo placeholder — coloured rounded square with centred initial
os-figma render --parent "<screenId>" "<Frame name='Brand/Logo' w={64} h={64} rounded={16} bg='var:--color-primary' flex='row' justify='center' items='center'><Text size={24} weight='bold' color='var:--color-neutral-0'>A</Text></Frame>"
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

### Spacing variables

Choose spacing tokens based on the visual weight the gap needs to carry.
Tighter tokens (`--space-xs`, `--space-s`) for related elements within a
group. Wider tokens (`--space-l`, `--space-xl`) for breathing room between
sections or at screen edges.

Scale: `none → xs → s → base → m → l → xl → xxl`

Never use a hardcoded pixel value — always use a token from this scale.

---

### Spacer Frames

Spacer frames are auto-layout helpers — use them sparingly and only when
`gap` and `padding` cannot achieve the desired result.

**When to use a spacer:**
- Fixed-height spacer when one section needs significantly more space than
  the screen's `gap` value provides (e.g. `h={80}` top spacer on a login
  screen to push content down from the top edge)
- `grow={1}` spacer in a **row** layout to fill remaining horizontal space
  (e.g. divider lines flanking a label — see Divider template below)

**Do not use `grow={1}` in column layouts to centre content** — this does
not produce reliable symmetric distribution and leaves orphaned frames at
page root.

**When NOT to use a spacer:**
- Do not use spacers to add uniform spacing between elements — use `gap` on
  the parent frame instead
- Do not use spacers to add top/bottom breathing room — use `padding` on the
  parent frame instead

Always use `--parent` with spacers — see Render Best Practices rule 1.

---

### Critical rules

- **Always screenshot after building** — run `export node --feedback`, read
  the file, and evaluate before declaring a screen complete
- **Always fix after building** — run `os-figma node fix "<id>" --deep` after placing all components; all warnings must be cleared before declaring a screen done
- **Prefer `node fix` over `node inspect` in the evaluate loop** — `node fix` detects and applies fixes in one pass; `node inspect` is read-only and should only be used for targeted debugging
- **Always use `--parent`** — never place on canvas root
- **Never use `eval` to create elements** — no smart positioning
- **Never guess prop names** — always run `pattern describe` first
- **Never hardcode pixel gaps** — always use spacing variables
- **If a command fails** — check `REFERENCE.md` for correct syntax before retrying

**Known limitations:**
- `w='fill'` fails on root-level `render --parent` frames (resize NaN error)
  — use explicit pixel widths instead: `w={326}` mobile, `w={1280}` web
- `pattern add` always places at intrinsic width — use `--sizing fill` at
  placement time, or follow with `os-figma set sizing fill fixed -n "<id>"`
- `os-figma find` returns all matching nodes — use `--last` to get the most
  recently added match: `os-figma find "Button" --type INSTANCE --last`
- `setBoundVariable('cornerRadius', v)` is silently ignored by this Figma
  Desktop version. `boundVariables.cornerRadius` remains `null` after the
  call. Bind all four individual properties instead:
  `topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius`
- **Daemon caches `figma-client.js` at startup** — changes to `figma-client.js`
  have no effect until the daemon is restarted. Always run `os-figma connect`
  after editing that file.
- **`grow={1}` in column layouts** — does not produce reliable symmetric
  vertical centring. Use a fixed top spacer (e.g. `h={80}`) to push content
  down from the top edge on login and onboarding screens. `grow={1}` works
  correctly in row layouts only (e.g. divider lines).

---

## Composing Multiple Screens

When asked to create more than one screen — a flow, a feature set, or a
full app section — the approach changes. Multiple screens require upfront
planning that a single screen does not.

---

### Plan the set before building any screen

Before running any commands, define the full set:

- What are all the screens? Name them now.
- What is the relationship between them? (login → onboarding → home, etc.)
- What platform? Mobile and web screens in the same set should share spacing
  rhythm and component choices even if their layouts differ.
- What is the shared design language? Decide padding scale, gap scale, and
  component variants once — apply consistently across all screens.

Write this plan before touching the CLI. Example:

> "Authentication flow, mobile. Three screens: Login, Forgot Password,
> Reset Password. All share the same generous top padding to push content
> into the upper third, the same form spacing, and the same primary button
> treatment. Login is the most complex — build it first to establish the
> pattern, then reference it when building the other two."

---

### Build in dependency order

Build the most foundational screen first — typically the one other screens
reference for spacing, tone, or component choices. Complete it fully
(evaluate loop exits clean) before starting the next.

Do not interleave screens. Complete one, commit it, then start the next.

---

### Organise the canvas as you go

`render` uses smart positioning — each new screen frame is automatically
placed to the right of existing frames with a consistent gap. Build screens
in flow order (login first, then the next screen in the journey) and the
canvas will read left to right naturally.

Check the current canvas state before starting each new screen:

```bash
os-figma canvas info
```

This confirms how many frames exist and where the next one will land. No manual positioning is needed.

---

### Maintain consistency across screens

Before building each subsequent screen, inspect the previous one to confirm the decisions to carry forward:

```bash
# Remind yourself what the first screen established
os-figma node inspect -n "<previousScreenId>"
```

Check:

- What padding values were used on the screen frame?
- What gap between elements?
- Which component variants were used (e.g. Button/Primary vs Secondary)?
- What font sizes for headings and body text?

Apply the same values to the new screen. Do not re-decide spacing from scratch on each screen — that's how inconsistency creeps in.

---

### Shared elements across screens

If the same structural element appears on multiple screens (e.g. a top navigation bar, a bottom tab bar), render it identically each time — same name, same dimensions, same tokens. Do not vary structural frame heights or padding between screens unless there is a deliberate design reason.

---

### Canvas cleanup applies per-screen

Run the canvas cleanup step (Step 5b) after completing each screen, not just at the end. Loose frames from one screen's build process should be deleted before starting the next.

---

### Commit after each screen

Commit an undo boundary after each screen's evaluate loop exits clean — not once at the end of the full set. This keeps undo checkpoints granular and makes it possible to roll back a single screen without losing work on the others.

```bash
os-figma eval "figma.commitUndo()"
```

---

## JSX Syntax (render command)

```jsx
// Layout
flex="row"              // or "col"
gap={16}                // spacing between items
p={24}                  // padding all sides
px={16} py={8}          // horizontal / vertical
pt={56} pb={34}         // top / bottom individually
pl={24} pr={24}         // left / right individually
// Individual sides take precedence over px/py, which take precedence over p

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
<Text size={16} weight="bold" color="var:--color-neutral-10" w="fill" align="center">Hello</Text>
// align: left (default), center, right, justified
```

---

## Render Best Practices

Follow these rules on every `render` call. They prevent the most common
warnings, layout defects, and silent failures.

---

### 1. Always use `--parent` during screen composition

Every `render` call that places content inside a screen must include
`--parent <screenId>`. Without it, frames land at canvas root and have no
effect on the screen layout.

```bash
# Correct
os-figma render --parent "<screenId>" '<Frame name="Content/Header" ...>'

# Wrong — lands at canvas root
os-figma render '<Frame name="Content/Header" ...>'
```

This applies to every frame — structural wrappers, spacers, dividers, and
content frames alike.

---

### 2. `bg` on visible surfaces — omit on layout frames

Every frame that represents a visible surface (screen background, card,
section container) must have an explicit `bg` using a `var:` token.

Layout and structural frames (spacers, alignment wrappers, invisible
containers) should omit `bg` entirely — this renders them transparent.

Never use raw hex values for `bg`. Always use `var:` tokens so the fill is
bound to the design system.

```jsx
// Correct — visible surface with token
<Frame name="Card/Default" w={326} flex="col" bg="var:--color-neutral-0">

// Correct — layout frame, no bg needed
<Frame name="Spacer/Top" w="fill" grow={1}>

// Wrong — raw hex, will trigger node fix warning
<Frame name="Card/Default" w={326} flex="col" bg="#ffffff">
```

**Child frame defaults (frames nested inside a root render frame):**
- No `bg` prop → transparent (no fill). Never receives a default white fill.
- No `rounded` prop → `cornerRadius=0`. Never receives a default radius.
- No padding props → all four padding values explicitly set to `0`. Figma
  defaults never leak in.
- `bg="var:--token"` → fill bound to token at render time, no warning.
- `rounded={n}` → corner radius bound to border-radius token at render time
  if an exact match exists in `tokens.json`, raw value otherwise.
- `p={n}`, `px={n}`, `py={n}` → spacing token bound at render time if exact
  match exists in `tokens.json`.

---

### 3. Spacing values must match the token scale

The `p`, `px`, `py`, and `gap` props automatically bind spacing tokens when
the value exactly matches the spacing scale. Always use scale values so
bindings apply at render time.

**Spacing scale:** `0, 4, 8, 16, 24, 32, 40, 48`

```jsx
// Correct — binds --space-base automatically
<Frame name="Content" w={326} flex="col" p={16} gap={8}>

// Wrong — no token for 15, falls back to raw number with warning
<Frame name="Content" w={326} flex="col" p={15}>
```

---

### 4. Always set `w="fill"` on Text elements

Text elements without `w="fill"` clip their content at the intrinsic text
width. Always add `w="fill"` to allow text to wrap correctly within its
parent.

```jsx
// Correct
<Text size={16} color="var:--color-neutral-10" w="fill">Welcome back</Text>

// Wrong — text will clip
<Text size={16} color="var:--color-neutral-10">Welcome back</Text>
```

---

### 5. Root frame width must be explicit pixels

The root frame of a `render` call (the outermost `<Frame>`) must always have
an explicit pixel width. `w="fill"` fails on root-level frames.

```jsx
// Correct
<Frame name="Content/Header" w={326} flex="col">

// Wrong — fill fails at root level
<Frame name="Content/Header" w="fill" flex="col">
```

Standard widths: `326` for content inside a mobile screen with 32px padding,
`390` for a full-width mobile screen.

---

### 6. Always specify `flex` explicitly

Never rely on the default layout direction. Always specify `flex="col"` or
`flex="row"` on every frame that contains children.

```jsx
// Correct
<Frame name="Content/Header" w={326} flex="col" gap={8}>

// Wrong — default direction is unpredictable
<Frame name="Content/Header" w={326} gap={8}>
```

---

### 7. Use `var:` for all color props

All color props (`bg`, `color`, `stroke`) must use `var:` token syntax. Never
use raw hex values — they trigger `node fix` warnings and break design system
compliance.

```jsx
// Correct
<Frame bg="var:--color-neutral-0">
<Text color="var:--color-neutral-10">
<Frame stroke="var:--color-neutral-4">

// Wrong — raw hex
<Frame bg="#ffffff">
<Text color="#101213">
```

---

### 8. Name frames descriptively

Every frame should have a `name` prop that describes its design role.
A good name makes the layer panel readable without context.

```jsx
// Correct — role is clear
<Frame name="Logo" ...>
<Frame name="Form" ...>
<Frame name="Divider" ...>

// Wrong — generic, unhelpful
<Frame name="Frame" ...>
<Frame ...>
```

---

### 9. Spacer frames — use sparingly

Prefer `gap` and `padding` over spacer frames for uniform spacing. Only use
spacers when:
- A fixed-height spacer is needed because one section needs significantly more
  space than the screen `gap` provides
- A `grow={1}` spacer fills remaining horizontal space in a **row** layout
  (e.g. divider lines flanking a label)

Do not use `grow={1}` in column layouts for vertical centring.

Always include `--parent` on spacer render calls — see rule 1.

---

### 10. Quote style — be consistent

Single quotes (`'value'`) and double quotes (`"value"`) both work in JSX
props. Be consistent within a single render call. When the outer shell command
uses single quotes, use double quotes inside the JSX string to avoid conflicts.

```bash
# Outer single quotes — use double quotes inside JSX
os-figma render '<Frame name="Content/Header" flex="col">'

# Outer double quotes — use single quotes inside JSX
os-figma render "<Frame name='Content/Header' flex='col'>"
```

---

### Divider with label

Use `grow={1}` on line frames in a **row** layout — this fills remaining
horizontal space without hardcoded pixel widths:
```jsx
<Frame name='Divider/Default' w={326} flex='row' items='center' gap={8}>
  <Frame name='Divider/Line' h={1} grow={1} bg='var:--color-neutral-4' />
  <Text size={12} color='var:--color-neutral-6'>or</Text>
  <Frame name='Divider/Line' h={1} grow={1} bg='var:--color-neutral-4' />
</Frame>
```

`grow={1}` distributes space correctly in row layouts. Do not use it in
column layouts for vertical centring — see Known Limitations.

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

> Use `align="center"` directly on the `<Text>` element instead of wrapping
> in a flex frame.

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

**6. Spacer frames without `--parent` land at canvas root:** Always use `--parent` — see Render Best Practices rule 1.

**7. Prefer `gap` and `padding` over spacer frames:**
Do not use spacers for uniform spacing between elements — use `gap` on
the parent frame instead. Do not use spacers for top/bottom breathing
room — use `padding` on the parent frame instead.

---

## Key Rules

1. **Always use token variable names from tokens.json** — not raw hex values
2. **Name layers descriptively** — what a designer would write on a sticky
   note, not a path format
3. **Always use `render` for frames** — has smart positioning
4. **Never use `eval` to create** — no positioning, overlaps at (0,0)
5. **For multiple frames:** Use `render-batch`
6. **Convert to components:** `node to-component` after creation
