# outsystems-figma-cli

CLI that controls Figma Desktop directly for designing apps in Figma. No API key needed.

**Documentation:**
- `docs/COMMANDS.md` — full command reference, setup workflows, all flags
- `docs/REFERENCE.md` — token names, screen specs, placeholder sizes, JSX attributes, styles
- `docs/TECHNIQUES.md` — advanced patterns (mode switching, scaling, batch ops)
- `docs/CLAUDE-SESSION.md` — session quick reference, common operations

**Quick command lookup:** see `docs/CLAUDE-SESSION.md`
**Full token list:** see `docs/REFERENCE.md` → Design Token Names
**JSX syntax reference:** see `docs/REFERENCE.md` → Render JSX Syntax
**Placeholder sizing table:** see `docs/REFERENCE.md` → Placeholder Sizing Reference
**Screen sizes and layer naming:** see `docs/REFERENCE.md` → Screen Sizes
**Design styles (shadows, text):** see `docs/REFERENCE.md` → Design Styles
**Pattern commands and --prop flag:** see `docs/COMMANDS.md` → Pattern Components
**Screen create command:** see `docs/COMMANDS.md` → Screens
**Project setup and token workflow:** see `docs/COMMANDS.md` → Setup & Connection / Design Tokens

---

## Composing Screens

When asked to create a screen, follow this exact workflow every time.
Deviating from it causes failures that are expensive to recover from.

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

```bash
os-figma tokens status    # confirms tokens.json exists and is not empty
os-figma styles status    # confirms styles.json exists and is not empty
os-figma pattern list     # confirms library-config.json has indexed components
```
If tokens or styles report missing/empty files, stop and ask the user to run session-start sync. Do not attempt `tokens pull` or `styles pull` during design — those require the Foundations file to be open in Figma Desktop.

**Step 1 — Gather component schemas (required)**

For every component you plan to place, run `pattern describe` and record:
- Whether it has Variants/States rows (determines if `--variant`/`--state` are valid)
- The exact `--prop` key names as returned (do not guess or abbreviate)

```bash
os-figma pattern describe <Component> --pretty   # repeat for every component
```
Do not proceed to Step 2 until you have `describe` output for every component. Guessing prop names causes silent failures.

**Step 2 — Render the screen frame**

Choose dimensions based on platform. Choose padding and gap based on the design — not a default.
- Mobile: `w={390} h={844}` | Tablet: `w={768} h={1024}` | Web: `w={1440} h={900}`

```bash
os-figma render '<Frame name="Login — Mobile" w={390} h={844} flex="col"
  bg="var:--color-neutral-0" p={...} gap={...}>'
# Note the returned node ID — used as --parent for all subsequent calls
```

`render` prints the node ID on success. Note it immediately — no follow-up `find` needed.

**Naming:** Good: `"Login — Mobile"`, `"Dashboard"`. Avoid: `"Screen/Mobile/Login/Blank"`, `"Frame 1"`.

**Step 3 — Render structural placeholders**

Use `os-figma render --parent <screenId>` for structural elements not in the component library. Always use `--parent`.

Placeholders must use `bg='var:--color-neutral-1'`, `stroke='var:--color-neutral-4'`, `strokeWidth={1}`, a `<Text>` label with `color='var:--color-neutral-6'` and `size={12}`, and `{Component}/{Variant}` naming.

**Placeholder sizing:** see `docs/REFERENCE.md` → Placeholder Sizing Reference

**Step 4 — Place real components**

Use `os-figma pattern add --parent <screenId>` for every library component. Pass correct props from schema.

```bash
os-figma pattern add Input --state Default \
  --prop "Label=Email" --parent "<screenId>" --sizing fill
```

If a warning appears next to a prop, the key is wrong — run `pattern describe` to check.

**Step 4b — Set fill-width sizing**

Prefer `--sizing fill` at placement time. Apply to every full-width component immediately after placement. Full-width components: Input, Button, Search, Dropdown, Date Picker, Alert, Accordion.

**Step 5 — Evaluate and fix (loop until clean)**

This step repeats until all warnings are cleared and the screenshot matches the design plan. Do not exit early.

1. `os-figma export node "<screenId>" --feedback` — read the screenshot file immediately
2. Evaluate: visual hierarchy, vertical distribution, full-width spans, spacing consistency, placeholder visibility. Also check: do all sibling components that should span full width have consistent `layoutSizingHorizontal = FILL`? If any are FIXED when they should be FILL, correct them with `os-figma set sizing fill fixed -n "<id>"` before re-exporting.
3. `os-figma node fix "<screenId>" --deep` — auto-fix all warnings
4. If exit code 1 (unresolved warnings), apply manually then re-run:
   ```bash
   # Bind individual properties — use side-specific commands for padding
   os-figma bind fill "--color-neutral-0" -n "<nodeId>"
   os-figma bind stroke "--color-neutral-4" -n "<nodeId>"
   os-figma bind effect "Shadow/--shadow-m" -n "<nodeId>"
   os-figma bind text-style "Headings/heading1" -n "<nodeId>"
   os-figma bind padding-top "--space-xxl" -n "<nodeId>"
   os-figma node fix "<screenId>" --deep
   ```
5. Return to step 1. After clean exit, optionally: `os-figma accessibility check "<screenId>" --deep`

**Exit condition:** `node fix --deep` exits code 0 AND screenshot matches design plan.

**Step 5b — Clean up canvas and commit**

```bash
os-figma find "Spacer" --type FRAME       # delete orphaned frames at page root
os-figma canvas info                       # verify canvas state
os-figma eval "figma.commitUndo()"         # single undo checkpoint
```

---

### Component placement rules

- **Every interactive element must be a real library component** — buttons, inputs, links, toggles, dropdowns. A rendered placeholder frame is only acceptable for non-interactive structural elements (nav bars, hero images, dividers, decorative zones). If an interactive element is not in the component library, note it explicitly in the design plan and raise it with the user — do not silently substitute a placeholder.
- Always run `pattern describe` first — never guess prop names
- Only pass `--variant` if schema shows Variants row; only `--state` if States row
- Always pass `--prop` for meaningful text content
- Use `Default` state unless a specific state is required
- Icons: `pattern add <iconName> --parent "<id>"` — no `--variant`/`--state`/`--prop`
- Use `--icons` flag when a name exists in both components and icons

### Icon slots — always use real library icons

Text glyphs (`‹`, `×`, `←`, `✕`) are never acceptable. Icon placement is two-step:
1. Render containing frame with placeholder frame in the icon slot (no text)
2. `pattern add <iconName> --parent "<iconFrameId>"`
3. After placing the icon, evaluate whether its fill colour fits the design context. If not, bind the appropriate token:
   ```bash
   os-figma bind fill "--color-primary" -n "<iconId>"
   ```
   This is a design judgment call — consider the icon's role, the surrounding palette, and the screen's emotional tone. It will not always be `--color-primary`. A back navigation arrow in a primary-coloured header might use `--color-neutral-0`; a decorative icon in a neutral zone might use `--color-neutral-7`. Choose the token that fits.

### Spacing variables

Choose spacing tokens by visual weight: tighter (`--space-xs`, `--space-s`) for related elements, wider (`--space-l`, `--space-xl`) for section breathing room.

Scale: `none → xs → s → base → m → l → xl → xxl` (px: `0, 4, 8, 16, 24, 32, 40, 48`)

Never use hardcoded pixel values — always use a token from this scale.

### Spacer Frames

Use sparingly — only when `gap` and `padding` cannot achieve the result.
- Fixed-height spacer: when one section needs more space than screen `gap`
- `grow={1}` spacer: only in **row** layouts for horizontal space distribution (e.g. divider lines), OR as a **single bottom spacer** in a column layout to prevent top-heavy content. Do not use two `grow={1}` spacers in a column to attempt symmetric vertical centring — this is unreliable.

### Vertical spacing

Set `gap` once on the screen frame: `os-figma gap 16 -n "<screenId>"`. For extra breathing room between sections, use a fixed-height spacer.

---

### Critical rules

- **Always screenshot after building** — `export node --feedback`, read file, evaluate
- **Always fix after building** — `node fix "<id>" --deep`, all warnings must clear
- **Prefer `node fix` over `node inspect`** in the evaluate loop
- **Always use `--parent`** — never place on canvas root
- **Never use `eval` to create elements** — no smart positioning
- **Never guess prop names** — always `pattern describe` first
- **Never hardcode pixel gaps** — always use spacing variables
- **If a command fails** — check `docs/REFERENCE.md` for correct syntax

**Known limitations:**
- `w='fill'` fails on root-level `render --parent` frames — use explicit pixel widths: `w={326}` mobile, `w={1280}` web
- `pattern add` places at intrinsic width — use `--sizing fill` at placement time
- `os-figma find` returns all matches — use `--last` for most recent
- `setBoundVariable('cornerRadius', v)` silently ignored — bind `topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius` individually
- **Daemon caches `figma-client.js`** — restart with `os-figma connect` after edits
- **Off-scale spacing values block clean exit** — use `--skip <property>` to exclude intentional values from the fix pass: `os-figma node fix "<id>" --deep --skip paddingTop`
- **`bind padding` writes all four sides** — use `bind padding-top`, `bind padding-right`, `bind padding-bottom`, `bind padding-left` to target individual sides without overwriting the others
- **`grow={1}` symmetric centring in column layouts** — two `grow={1}` spacers in a column do not reliably centre content. Use a single `grow={1}` at the bottom of the column to push content upward, or use a fixed-height top spacer to push content down from the top edge.

---

## Composing Multiple Screens

Multiple screens require upfront planning that a single screen does not.

### Plan the set before building

- What are all the screens? Name them now.
- What is the relationship between them?
- What platform? Share spacing rhythm and component choices.
- Decide padding scale, gap scale, and component variants once — apply consistently.

### Build in dependency order

Build the most foundational screen first. Complete it fully (evaluate loop exits clean) before starting the next. Do not interleave screens.

### Maintain consistency

Before building each subsequent screen, inspect the previous one:
```bash
os-figma node inspect -n "<previousScreenId>"
```
Check padding, gap, component variants, font sizes. Apply the same values.

### Canvas organisation

`render` auto-positions new frames to the right. Run `os-figma canvas info` before each new screen.

### Per-screen cleanup and commit

Run Step 5b after each screen, not just at the end. Commit undo boundary after each: `os-figma eval "figma.commitUndo()"`

---

## Render Best Practices

1. **Always use `--parent`** — every `render` call inside a screen needs `--parent <screenId>`
2. **`bg` on visible surfaces only** — use `var:` tokens on cards/screens/sections; omit on layout frames. Child frame defaults: no `bg` → transparent, no `rounded` → 0, no padding → 0.
3. **Spacing must match token scale** — `0, 4, 8, 16, 24, 32, 40, 48`. Off-scale values get warnings.
4. **`w="fill"` on all Text** — prevents clipping
5. **Root frame needs explicit pixel width** — `w="fill"` fails at root level. Standard: `326` (mobile padded), `390` (mobile full).
6. **Always specify `flex`** — `flex="col"` or `flex="row"` on every frame with children
7. **`var:` for all colors** — `bg`, `color`, `stroke` must use `var:--token`. No raw hex.
8. **Name frames descriptively** — `"Logo"`, `"Form"`, not `"Frame"`
9. **Spacers sparingly** — prefer `gap`/`padding`. Only fixed-height or `grow={1}` in rows.
10. **Quote consistency** — outer single quotes → inner double quotes, or vice versa

### Divider with label template

```jsx
<Frame name='Divider/Default' w={326} flex='row' items='center' gap={8}>
  <Frame name='Divider/Line' h={1} grow={1} bg='var:--color-neutral-4' />
  <Text size={12} color='var:--color-neutral-6'>or</Text>
  <Frame name='Divider/Line' h={1} grow={1} bg='var:--color-neutral-4' />
</Frame>
```

---

## Common Pitfalls

1. **Text cut off** — add `w="fill"` to parent frame AND every Text element
2. **Centred button text** — use `align="center"` on Text, or flex row with `justify="center"`
3. **No emojis** — use shapes: `<Frame w={20} h={20} rounded={4} stroke="var:--color-neutral-10" strokeWidth={2} />`
4. **Push items to edges** — `<Frame flex="row">` + `<Frame grow={1} />` between items
5. **Wrong prop names** — `layout` → `flex`, `padding` → `p`, `fill` → `bg`, `cornerRadius` → `rounded`, `fontSize` → `size`, `fontWeight` → `weight`
6. **Spacers at canvas root** — always use `--parent`
7. **Logo not centring in column** — wrap in a fill-width row with `justify="center"`:
   ```jsx
   <Frame name="Logo zone" w={390} flex="row" justify="center">
     <Frame name="Logo" w={80} h={80} rounded={16} bg="var:--color-primary" />
   </Frame>
   ```

---

## Key Rules

1. **Always use token variable names from tokens.json** — not raw hex values
2. **Name layers descriptively** — what a designer would write on a sticky note
3. **Always use `render` for frames** — has smart positioning
4. **Never use `eval` to create** — no positioning, overlaps at (0,0)
5. **For multiple frames:** Use `render-batch`
6. **Convert to components:** `node to-component` after creation
