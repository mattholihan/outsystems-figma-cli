# outsystems-figma-cli Command Reference

Full command reference. For quick start, see CLAUDE.md.

## Setup & Connection

```bash
os-figma init                            # Initialise project (tokens.json + library-config.json)
os-figma connect                         # Connect (Yolo Mode)
os-figma connect --safe                  # Connect (Safe Mode, plugin)
os-figma daemon status                   # Check daemon status
os-figma daemon restart                  # Restart daemon
os-figma files                           # List open Figma files (JSON)
```

## Design Tokens & Variables

### Create OutSystems Token Collections

```bash
os-figma tokens preset                   # Create all OutSystems token collections
os-figma tokens spacing                  # OutSystems spacing tokens only
os-figma tokens radii                    # OutSystems border radius tokens only
os-figma tokens pull                     # Pull from Foundations file → tokens.json
os-figma tokens pull --file "Name"       # Override target file
os-figma tokens push                     # Push tokens.json → Foundations file
os-figma tokens push --file "Name"       # Override target file
os-figma tokens status                   # Compare tokens.json vs Foundations file
os-figma tokens status --file "Name"     # Override target file
```

Token commands target `library-config.json → libraries.foundations` automatically.
The Foundations file must be open in Figma Desktop. Use `--file` to override.

### Manage Variables

```bash
os-figma var list                        # Show all variables
os-figma var list -t COLOR               # Filter by type
os-figma var visualize                   # Show colors on canvas
os-figma var create "name" -c "ColId" -t COLOR -v "#1068EB"
```

### Bind Variables

```bash
os-figma bind fill "--color-primary"
os-figma bind stroke "--color-neutral-4"
os-figma bind radius "--border-radius-soft"
os-figma bind gap "--space-m"
os-figma bind padding "--space-l"
os-figma bind list                       # List available variables
```

## Pattern Components

### Scan & List
```bash
os-figma pattern scan                    # Index component keys from current Figma document
                                         # Open component library file in Figma first
os-figma pattern scan --icons            # Index icon keys from current Figma document
                                         # Open icon/foundations library file in Figma first
os-figma pattern list                    # List all indexed components (no Figma connection needed)
```

### Add Components
```bash
os-figma pattern add Button              # Add component at viewport centre
os-figma pattern add Button --variant Primary
os-figma pattern add Button --variant Primary --state Default
os-figma pattern add Button --x 100 --y 200   # Add at specific position
```

### Add with --prop flag

`--prop` can be passed multiple times. Format: `"Key=Value"`. Types are auto-detected:
```bash
# Text property
os-figma pattern add Button --variant Primary --prop "Text=Sign In"

# Boolean property
os-figma pattern add Button --variant Primary --prop "Show icon (L)=true"

# Instance swap — value must match an icon name from pattern scan --icons
os-figma pattern add Button --variant Primary --prop "Icon (L)=arrow-left"

# Full combination
os-figma pattern add Button --variant Primary --state Default \
  --prop "Text=Sign In" \
  --prop "Show icon (L)=true" \
  --prop "Icon (L)=arrow-left"
```

Property names are matched case-insensitively. Figma's internal `#id` suffix and
`↳` prefix are handled automatically — do not include them.

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

## Create Elements

### Quick Primitives

```bash
os-figma create rect "Card" -w 320 -h 200 --fill "var:--color-neutral-0" --radius 8
os-figma create circle "Avatar" -w 48 --fill "var:--color-primary"
os-figma create text "Hello" -s 16 -c "var:--color-neutral-10" -w bold
os-figma create line -l 200 -c "var:--color-neutral-4"
os-figma create autolayout "Card" -d col -g 16 -p 24 --fill "var:--color-neutral-0"
os-figma create icon lucide:star -s 24 -c "var:--color-warning"
os-figma create image "https://example.com/photo.png" -w 200
os-figma create group "Header"
os-figma create component "Button"
```

### Create with OutSystems Variable Binding

Use `var:name` syntax to bind OutSystems tokens at creation time:

```bash
os-figma create rect "Card" --fill "var:--color-neutral-0" --stroke "var:--color-neutral-4"
os-figma create circle "Avatar" --fill "var:--color-primary"
os-figma create text "Hello" -c "var:--color-neutral-10"
os-figma create line -c "var:--color-neutral-4"
os-figma create frame "Section" --fill "var:--color-neutral-0"
os-figma create autolayout "Container" --fill "var:--color-neutral-1"
os-figma create icon lucide:star -c "var:--color-warning"
```

### Render with JSX

```bash
os-figma render '<Frame name="OS/Card/Default" w={320} bg="var:--color-neutral-0" rounded={8} flex="col" gap={8} p={24} stroke="var:--color-neutral-4" strokeWidth={1}>
  <Text size={18} weight="bold" color="var:--color-neutral-10" w="fill">Card Title</Text>
  <Text size={14} color="var:--color-neutral-7" w="fill">Card description text.</Text>
</Frame>'
```

### Render with OutSystems Variable Binding

```bash
os-figma render '<Frame name="OS/Card/Default" w={320} bg="var:--color-neutral-0" stroke="var:--color-neutral-4" rounded={8} flex="col" gap={8} p={24}>
  <Text size={18} weight="bold" color="var:--color-neutral-10" w="fill">Card Title</Text>
  <Text size={14} color="var:--color-neutral-7" w="fill">Description text.</Text>
  <Frame bg="var:--color-primary" px={16} py={8} rounded={4} flex="row" justify="center" items="center">
    <Text color="var:--color-neutral-0" weight="semi-bold">Action</Text>
  </Frame>
</Frame>'
```

OutSystems color variables: `--color-primary`, `--color-secondary`, `--color-neutral-0` through `--color-neutral-10`, `--color-feedback-success`, `--color-feedback-warning`, `--color-feedback-error`, `--color-feedback-info`

### Render Batch (Multiple Frames)

```bash
os-figma render-batch '[
  "<Frame name=\"OS/Card/1\" w={300} h={200} bg=\"var:--color-neutral-0\"><Text>Card 1</Text></Frame>",
  "<Frame name=\"OS/Card/2\" w={300} h={200} bg=\"var:--color-neutral-0\"><Text>Card 2</Text></Frame>"
]' -d row -g 40
```

Options: `-d row|col` (direction), `-g <n>` (gap)

## Slots (Flexible Component Content)

```bash
os-figma slot create "COMP_ID" "FRAME_ID" "SlotName"   # Convert frame to slot
os-figma slot create "COMP_ID" "FRAME_ID" "Content" --description "Main content area"
os-figma slot list "COMP_ID"                            # List slots on component
os-figma slot list "INSTANCE_ID"                        # List slots on instance
os-figma slot add "INST_ID" "SLOT_ID" "CONTENT_ID"      # Add content to slot
os-figma slot reset "INST_ID" "SLOT_ID"                 # Reset slot to default
os-figma slot clear "INST_ID" "SLOT_ID"                 # Clear all slot content
```

Slots create flexible areas in components where instance content can vary. Use for card bodies, modal content, list items, and any area where child content differs between instances.

## Modify Elements

```bash
os-figma set fill "var:--color-primary"          # Bind fill to OS token
os-figma set fill "#1068EB" -n "1:234"            # On specific node (hex fallback)
os-figma set stroke "var:--color-neutral-4" -w 1  # Add stroke
os-figma set radius 8                             # Corner radius
os-figma set size 320 200                         # Resize
os-figma set pos 100 100                          # Move
os-figma set opacity 0.5                          # Opacity
os-figma set autolayout row -g 8 -p 16            # Apply auto-layout
os-figma set name "OS/Button/Primary/Default"     # Rename (use OS convention)
```

## Layout & Sizing

```bash
os-figma sizing hug                      # Hug contents
os-figma sizing fill                     # Fill container
os-figma sizing fixed 390 844            # Fixed size (e.g. mobile screen)
os-figma padding 16                      # All sides
os-figma padding 16 24                   # Vertical, horizontal
os-figma gap 16                          # Set gap
os-figma align center                    # Align items
```

## Find & Select

```bash
os-figma find "OS/Button"                # Find by name
os-figma find "OS/Card" -t FRAME         # Filter by type
os-figma raw query "//*[@name^='OS/']"   # All OutSystems layers
os-figma select "1:234"                  # Select node
os-figma get                             # Get selection props
os-figma get "1:234"                     # Get specific node
```

## Canvas Operations

```bash
os-figma canvas info                     # What's on canvas
os-figma canvas next                     # Next free position
os-figma arrange -g 100                  # Arrange frames
os-figma arrange -g 100 -c 3             # 3 columns
```

## Duplicate & Delete

```bash
os-figma duplicate                       # Duplicate selection
os-figma dup "1:234" --offset 50         # With offset
os-figma delete                          # Delete selection
os-figma delete "1:234"                  # Delete by ID
```

## Node Operations

```bash
os-figma node tree                       # Show tree structure
os-figma node tree "1:234" -d 5          # Deeper depth
os-figma node bindings                   # Show variable bindings
os-figma node to-component "1:234"       # Convert to component
os-figma node delete "1:234"             # Delete by ID
```

## Export

```bash
os-figma export css                      # Variables as CSS (OutSystems format)
os-figma export screenshot -o out.png    # Viewport screenshot
os-figma export node "1:234" -o card.png          # Export node by ID
os-figma export node "1:234" -s 2 -f png          # 2x scale PNG
os-figma export node "1:234" -f svg -o card.svg   # SVG export
os-figma export-jsx "1:234"              # Export as JSX
os-figma export-jsx "1:234" -o Card.jsx --pretty
os-figma export-storybook "1:234"        # Storybook stories
```

## Analysis & Linting

```bash
os-figma lint                            # Check all rules
os-figma lint --fix                      # Auto-fix
os-figma lint --rule color-contrast      # Specific rule
os-figma lint --rule no-hardcoded-colors # Enforce OS token usage
os-figma lint --preset accessibility     # Accessibility preset
os-figma analyze colors                  # Color usage
os-figma analyze typography              # Typography
os-figma analyze spacing                 # Spacing
os-figma analyze clusters                # Find repeated patterns
```

Lint rules: `no-default-names`, `no-deeply-nested`, `no-empty-frames`, `prefer-auto-layout`, `no-hardcoded-colors`, `color-contrast`, `touch-target-size`, `min-text-size`

Presets: `recommended`, `strict`, `accessibility`, `design-system`

## XPath Queries

```bash
os-figma raw query "//FRAME"
os-figma raw query "//COMPONENT"
os-figma raw query "//*[@name^='OS/']"
os-figma raw query "//*[contains(@name, 'Button')]"
os-figma raw select "1:234"
os-figma raw export "1:234" --scale 2
```

## Website Recreation

```bash
os-figma recreate-url "https://example.com" --name "My Page"
os-figma recreate-url "https://example.com" -w 390 -h 844   # Mobile
os-figma analyze-url "https://example.com" --screenshot
os-figma screenshot-url "https://example.com" --full
```

## Images

```bash
os-figma create image "https://example.com/photo.png"
os-figma screenshot-url "https://example.com"
os-figma remove-bg                       # Remove background (needs API key)
```

## FigJam

```bash
os-figma fj list                         # List pages
os-figma fj sticky "Text" -x 100 -y 100 --color "#FEF08A"
os-figma fj shape "Label" -x 200 -y 100 -w 200 -h 100
os-figma fj connect "ID1" "ID2"          # Connect elements
os-figma fj nodes                        # Show elements
os-figma fj delete "ID"
os-figma fj eval "figma.currentPage.children.length"
```

Shape types: `ROUNDED_RECTANGLE`, `RECTANGLE`, `ELLIPSE`, `DIAMOND`, `TRIANGLE_UP`, `TRIANGLE_DOWN`, `PARALLELOGRAM_RIGHT`, `PARALLELOGRAM_LEFT`

## Daemon & Connection

```bash
os-figma connect                         # Connect (Yolo Mode)
os-figma connect --safe                  # Connect (Safe Mode, plugin)
os-figma daemon status                   # Check daemon status
os-figma daemon restart                  # Restart daemon
os-figma files                           # List open Figma files (JSON)
```

## JavaScript Eval

```bash
os-figma eval "figma.currentPage.name"
os-figma eval --file /tmp/script.js
os-figma run /tmp/script.js
```

## Render JSX Syntax

**Elements:** `<Frame>`, `<Rectangle>`, `<Ellipse>`, `<Text>`, `<Line>`, `<Image>`, `<SVG>`, `<Icon>`

**Size:** `w={390} h={844}` (mobile), `w={1440} h={900}` (web), `w="fill"`, `minW={100} maxW={500}`

**Layout:** `flex="row|col"`, `gap={16}`, `wrap={true}`, `justify="start|center|end|between"`, `items="start|center|end"`

**Padding:** `p={24}`, `px={16} py={8}`, `pt={8} pr={16} pb={8} pl={16}`

**Appearance:** `bg="var:--color-neutral-0"`, `stroke="var:--color-neutral-4"`, `strokeWidth={1}`, `opacity={0.5}`

**Corners:** `rounded={8}` (soft), `rounded={100}` (pill), `overflow="hidden"`

**Effects:** `shadow="0 4 12 #0001"`, `blur={10}`, `rotate={45}`

**Text:** `<Text size={16} weight="bold" color="var:--color-neutral-10" w="fill">Hello</Text>`

**WRONG vs RIGHT:**
```
layout="horizontal"  →  flex="row"
padding={24}         →  p={24}
fill="#fff"          →  bg="var:--color-neutral-0"
cornerRadius={8}     →  rounded={8}
fontSize={16}        →  size={16}
fontWeight="bold"    →  weight="bold"
```

## Advanced Examples

### Switch to Dark Mode (OutSystems Light/Dark tokens)

```javascript
os-figma eval "
const node = figma.getNodeById('NODE_ID');
function findModeCollection(n) {
  if (n.boundVariables) {
    for (const [prop, binding] of Object.entries(n.boundVariables)) {
      const b = Array.isArray(binding) ? binding[0] : binding;
      if (b && b.id) {
        const variable = figma.variables.getVariableById(b.id);
        if (variable) {
          const col = figma.variables.getVariableCollectionById(variable.variableCollectionId);
          if (col && col.modes.length > 1) return { col, modes: col.modes };
        }
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
  const darkMode = found.modes.find(m => m.name.includes('Dark'));
  if (darkMode) node.setExplicitVariableModeForCollection(found.col, darkMode.modeId);
}
"
```

### Create OutSystems Component Instance

```javascript
os-figma eval "(function() {
  const comp = figma.currentPage.findOne(n => n.type === 'COMPONENT' && n.name === 'OS/Button/Primary/Default');
  if (!comp) return 'Component not found';
  const instance = comp.createInstance();
  instance.x = 100;
  instance.y = 100;
  return instance.id;
})()"
```

### Smart Positioning (respects existing OS frames)

```javascript
let smartX = 0;
figma.currentPage.children.forEach(n => { smartX = Math.max(smartX, n.x + n.width); });
smartX += 100;
const frame = figma.createFrame();
frame.x = smartX;
frame.resize(390, 844); // Mobile screen size
frame.name = 'OS/Screen/Mobile/New';
```