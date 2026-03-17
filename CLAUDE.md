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
| "list available patterns" | `os-figma pattern list` |
| "add a button" / "add a card" | `os-figma pattern add Button` |
| "screenshot the screen" / "check the output" | `os-figma export node "<id>" --feedback` |
| "inspect a node" | `os-figma node inspect "<id>"` |
| "inspect current selection" | `os-figma node inspect` |
| "run preflight checks" | `os-figma doctor` |
| "deep node tree" | `os-figma node inspect "<id>" --deep` |
| "fix design system warnings" | `os-figma node fix "<id>" --deep` — **prefer this in the evaluate loop** |
| "inspect without fixing (debug only)" | `os-figma node inspect "<id>" --summary` |
| "apply shadow to node" | `os-figma bind effect "Shadow/Card" -n "<id>"` |
| "apply text style to node" | `os-figma bind text-style "Heading/H1" -n "<id>"` |

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
Creates a blank screen frame with correct dimensions, background token binding,
and layer naming.
```bash
# Mobile screen (390×844)
os-figma screen create Login --size mobile

# Web screen (1440×900)
os-figma screen create Dashboard --size web

# Prompted if --size omitted
os-figma screen create "User Profile"

# With padding and gap (CSS shorthand — top right bottom left)
os-figma screen create Login --size mobile --padding 32,32,48,32 --gap 16

# Web screen with web-appropriate spacing
os-figma screen create Dashboard --size web --padding 48,80,64,80 --gap 24
```

When `--padding` values match the spacing token scale (0, 4, 8, 16, 24, 32,
40, 48), padding is automatically bound to the corresponding spacing variable.

Layer naming: `Screen/{Size}/{Name}/Blank`
- `Screen/Mobile/Login/Blank`
- `Screen/Web/Dashboard/Blank`

Background is bound to `--color-neutral-0` from the Foundations library variable.

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

**Step 2 — Create the screen frame**

```bash
os-figma screen create <Name> --size <mobile|web>
os-figma find "Screen/<Size>/<Name>"
# Note the returned node ID — you will use it as --parent for everything
```

**Step 2b — Set screen padding**

After creating the screen frame, apply padding using spacing variables.
Do this before placing any children:

```bash
# Preferred — padding and gap in one command at screen creation time
os-figma screen create Login --size mobile --padding 32,32,48,32 --gap 16

# Alternative — apply after creation if screen already exists
os-figma padding 32 32 48 32 -n "<screenId>"
os-figma gap 16 -n "<screenId>"
```

Never place content flush against the screen edges.

**Step 2c — Plan vertical distribution**

For screens where content should be vertically centred (login, empty states,
confirmation screens), wrap the content zone in grow spacers so it sits in
the middle of the screen rather than bunching at the top:

```bash
# Top spacer — pushes content down
os-figma render --parent "<screenId>" "<Frame name='Spacer/Top' w={326} grow={1} />"

# ... place content elements here ...

# Bottom spacer — pushes content up
os-figma render --parent "<screenId>" "<Frame name='Spacer/Bottom' w={326} grow={1} />"
```

For screens where content flows from the top (list, dashboard, form), skip this step — content should start immediately below any nav bar.

**Step 3 — Render structural placeholders into the screen**

Use `os-figma render --parent <screenId>` to place structural elements
(nav bars, hero images, cards, dividers, stat counters, etc.) inside the
screen frame. Each `render` call places one element as a direct child.

Always use `--parent` — see Render Best Practices rule 1.

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

**Exit condition:** `node fix --deep` exits with code 0 (no warnings) AND the screenshot matches the design plan. Both conditions must be true. Only then is the screen complete.

**Step 5b — Commit undo boundary**

After the evaluate loop exits clean, run:

```bash
os-figma commit-undo
```

This creates a discrete undo checkpoint so the user can undo screen creation as a single step rather than stepping back through every individual command.

---

### --parent rules

Always use `--parent <screenId>` for both `render` and `pattern add` — see Render Best Practices rule 1.

---

### Vertical spacing between elements

The screen frame's `itemSpacing` controls the gap between all direct children.
Set it once after creating the screen:

```bash
os-figma gap 16 -n "<screenId>"    # mobile default
os-figma gap 24 -n "<screenId>"    # web default
```

For sections that need more breathing room (e.g. between the logo area and
the form, or between the form and a secondary action), insert an explicit
spacer frame:

```bash
os-figma render --parent "<screenId>" "<Frame name='Spacer' w={326} h={24} />"
```

Use these spacing values as a guide:

| Gap context | Value |
|-------------|-------|
| Between form fields | `gap 16` on screen |
| Logo to title | spacer h={16} |
| Title to first field | spacer h={8} |
| Last field to primary button | spacer h={8} |
| Primary button to text link | spacer h={4} |
| Text link to divider | spacer h={16} |
| Divider to secondary button | spacer h={16} |
| Top of screen to logo (login) | spacer h={80} |

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

### Screen archetypes

Use these structural patterns as a guide for each screen type.
Always adapt to what components are actually available in the library.

**Login / Onboarding** (mobile)
Spacer (h=80) → Brand/Logo (w=80, h=80, centred) → Spacer (h=16) →
title text (h2, bold) + subtitle text (base, neutral-6) → Spacer (h=8) →
Input (email, fill width) → Input (password, fill width) →
Spacer (h=8) → Button (primary, fill width, "Sign In") →
Link/ForgotPassword (text only, primary colour, centred) →
Spacer (h=16) → Divider/Default (fill width, h=24, "or" label) →
Spacer (h=16) → Button (secondary, fill width, "Continue with SSO")

Centre the logo horizontally using `items='center'` on the screen frame
or wrap it in a fill-width container with `flex='row' justify='center'`.

**Login / Onboarding** (web)
Two columns: left = Brand/Illustration placeholder (~50% width),
right = centred form (logo, inputs, buttons, max-width ~400px)

**List** (mobile): TopBar → Search → repeated Card/Item → BottomBar

**List** (web): TopBar → header row (title + actions + Search) → Table → Pagination

**Form** (mobile): TopBar → Input fields → Dropdown → Date Picker → Checkbox → Button (Save)

**Form** (web): TopBar → two-column form (labels left, inputs right) → footer row (Save + Cancel, right-aligned)

**Detail** (mobile): TopBar → Media/Hero → title + Tag → body → Divider → key/value rows → Button

**Detail** (web): TopBar → two columns: content left, Card/Action right

**Dashboard** (mobile): TopBar → Counter × 2 → section heading → Card/Item list → BottomBar

**Dashboard** (web): TopBar → Sidebar (240px) → Counter × 4 → Chart (60%) + Card/Item list (40%)

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

### Spacer Frames

Spacer frames are auto-layout helpers — use them sparingly and only when
`gap` and `padding` cannot achieve the desired result.

**When to use a spacer:**
- `grow={1}` spacer to push content to the bottom of a screen (e.g. pin an
  SSO button to the bottom while the form sits at the top)
- Fixed-height spacer when one section needs significantly more space than
  the screen's `gap` value provides

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

### 8. Use `Component/Variant` naming on all frames

Every frame should have a `name` prop following the `Component/Variant`
convention. This makes the layer panel readable and node inspection reliable.

```jsx
// Correct
<Frame name="Content/Header" ...>
<Frame name="Divider/Default" ...>
<Frame name="Brand/Logo" ...>

// Wrong — generic name makes debugging harder
<Frame name="Frame" ...>
<Frame ...>
```

---

### 9. Spacer frames — use sparingly

Prefer `gap` and `padding` over spacer frames for uniform spacing. Only use
spacers when:
- A `grow={1}` spacer is needed to push content to the bottom of a screen
- One section needs significantly more space than the screen `gap` provides

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

**6. Spacer frames without `--parent` land at canvas root:** Always use `--parent` — see Render Best Practices rule 1.

**7. Prefer `gap` and `padding` over spacer frames:**
Do not use spacers for uniform spacing between elements — use `gap` on
the parent frame instead. Do not use spacers for top/bottom breathing
room — use `padding` on the parent frame instead.

---

## Key Rules

1. **Always use token variable names from tokens.json** — not raw hex values
2. **Always follow layer naming convention** — `{Component}/{Variant}/{State}`
3. **Always use `render` for frames** — has smart positioning
4. **Never use `eval` to create** — no positioning, overlaps at (0,0)
5. **For multiple frames:** Use `render-batch`
6. **Convert to components:** `node to-component` after creation
