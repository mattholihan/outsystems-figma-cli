# outsystems-figma-cli

<p align="center">
  <b>Control Figma Desktop with Claude Code.</b><br>
  Full read/write access. No API key required.<br>
  Just talk to Claude about your designs.
</p>
```
 ██████╗ ███████╗      ███████╗██╗ ██████╗ ███╗   ███╗ █████╗        ██████╗██╗     ██╗
██╔═══██╗██╔════╝      ██╔════╝██║██╔════╝ ████╗ ████║██╔══██╗      ██╔════╝██║     ██║
██║   ██║███████╗█████╗█████╗  ██║██║  ███╗██╔████╔██║███████║█████╗██║     ██║     ██║
██║   ██║╚════██║╚════╝██╔══╝  ██║██║   ██║██║╚██╔╝██║██╔══██║╚════╝██║     ██║     ██║
╚██████╔╝███████║      ██║     ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║      ╚██████╗███████╗██║
 ╚═════╝ ╚══════╝      ╚═╝     ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝       ╚═════╝╚══════╝╚═╝
```

# outsystems-figma-cli

A CLI that connects directly to Figma Desktop for designing OutSystems apps. No API key needed.

- **OutSystems UI Tokens** — Create variables and collections using OutSystems CSS naming conventions
- **OutSystems Patterns** — Scaffold Accordion, Card, Modal, Tabs, and 40+ other OS UI patterns
- **Screen Templates** — Generate mobile (390×844) and web (1440×900) screens ready for OutSystems
- **Theme Export** — Export design tokens as CSS variables for ODC or O11 Service Studio
- **Slots** — Create flexible content areas in components using Figma Slots
- **Create Anything** — Frames, text, shapes, icons (150k+ from Iconify), components
- **Team Libraries** — Import and use components, styles, variables from any library
- **Analyze Designs** — Colors, typography, spacing, find repeated patterns
- **Lint & Accessibility** — Contrast checker, touch targets, design rules
- **Export** — PNG, SVG, JSX, Storybook stories, CSS variables
- **Batch Operations** — Rename layers, find/replace text, create 100 variables at once
- **Works with Claude Code** — Just ask in natural language, Claude knows all OutSystems commands

## Why This CLI?

This project includes a `CLAUDE.md` file that Claude Code reads automatically. It contains:

- All available commands and their syntax
- OutSystems UI token naming conventions
- OS UI pattern names and component structures
- Platform targets (ODC vs O11)
- Screen size standards for mobile, tablet, and web

**Want to teach Claude new tricks?** Just update `CLAUDE.md`. No code changes needed.

**Example:** You type "Create a mobile login screen" → Claude already knows to use a 390×844 frame, OutSystems token variables, and OS layer naming conventions — because it's all documented in `CLAUDE.md`.

---

## What You Need

- **Node.js 18+** — `brew install node` (or [download](https://nodejs.org/))
- **Figma Desktop** (free account works)
- **Claude Code** ([get it here](https://www.anthropic.com/claude-code)) — optional but recommended
- **macOS** (primary support)
- **macOS Full Disk Access** for Terminal (Yolo Mode only — not needed for [Safe Mode](#-safe-mode--for-restricted-environments))

---

## Setup

```bash
git clone https://github.com/mattholihan/outsystems-figma-cli.git
cd outsystems-figma-cli
npm install
```

Add the `os-figma` alias to your shell (one-time setup):

```bash
open ~/.zshrc
```

Add this line at the bottom:
```bash
alias os-figma="node ~/projects/outsystems-figma-cli/src/index.js"
```

Save, then reload your shell:
```bash
source ~/.zshrc
```

### Connect to Figma

Launch Figma Desktop in debug mode:
```bash
open -a Figma --args --remote-debugging-port=9222
```

Then connect the CLI:
```bash
os-figma connect
```

Open a design file in Figma and start designing.

### Set up a project

Each project has its own config. Run these once from your project directory:
```bash
# Initialise project files
os-figma init

# Sync token values from Figma
os-figma tokens pull

# Index components from your component library (open it in Figma first)
os-figma pattern scan

# Index icons from your foundations library (open it in Figma first)
os-figma pattern scan --icons
```

After setup, `pattern list` and `pattern add` work offline using the indexed keys
in `library-config.json`. Re-run `pattern scan` and `pattern scan --icons` if your
libraries are updated.

### Using with Claude Code

From your project folder, start Claude Code:
```bash
cd ~/projects/outsystems-figma-cli
claude
```

Claude will automatically read `CLAUDE.md` and understand all OutSystems conventions. Try asking:

> "Create a mobile login screen using OutSystems UI conventions"

> "Add OutSystems design tokens to this file"

> "Create a Card pattern with primary brand colors"

---

## Two Connection Modes

### 🚀 Yolo Mode (Recommended)

**What it does:** Patches Figma once to enable a debug port, then connects directly.

**Pros:**
- Fully automatic (no manual steps after setup)
- Slightly faster execution
- Secure: random port, token auth, localhost only, auto-shutdown on idle

**Cons:**
- Requires one-time Figma patch
- Needs Full Disk Access on macOS (one-time)

```bash
os-figma connect
```

---

### 🔒 Safe Mode — For Restricted Environments

**What it does:** Uses a Figma plugin to communicate. No Figma modification needed.

**Pros:**
- No patching, no app modification
- Works everywhere (corporate, personal, any environment)
- No Full Disk Access needed

**Cons:**
- Start plugin manually each session (2 clicks)

```bash
os-figma connect --safe
```

**Import plugin (one-time only):**
1. In Figma: **Plugins → Development → Import plugin from manifest**
2. Select `plugin/manifest.json` from this project
3. Click **Open**

**Start the plugin (each session):**
1. In Figma: **Plugins → Development → FigCli**
2. Terminal shows: `Plugin connected!`

**Tip:** Right-click the plugin → **Add to toolbar** for quick access.

---

### Which Mode Should I Use?

| Situation | Command |
|---|---|
| Personal Mac | `os-figma connect` (Yolo Mode) |
| Corporate laptop | `os-figma connect --safe` |
| Permission errors with Yolo | `os-figma connect --safe` |
| Can't modify apps | `os-figma connect --safe` |

---

## Troubleshooting

### Permission Error When Patching (macOS)

If you see `EPERM: operation not permitted, open '.../app.asar'`:

**1. Grant Full Disk Access to Terminal**

1. Open **System Settings** → **Privacy & Security** → **Full Disk Access**
2. Click the **+** button
3. Add **Terminal**
4. **Restart Terminal completely** (quit and reopen)

**2. Make sure Figma is completely closed**
```bash
killall Figma
```

**3. Run connect again**
```bash
os-figma connect
```

### Figma Not Connecting

1. Make sure Figma Desktop is running (not the web version)
2. Open a design file in Figma (not just the home screen)
3. Restart connection: `os-figma connect`

### Daemon Not Running (ECONNREFUSED on port 3456)

The daemon must be running before you can send commands. In one Terminal tab run:
```bash
os-figma connect
```
Leave it running, then open a second tab for your commands.

---

## Updating

```bash
cd ~/projects/outsystems-figma-cli
git pull
npm install
```

---

## How It Works

Connects to Figma Desktop via Chrome DevTools Protocol (CDP). No API key needed because it uses your existing Figma session.

```
┌──────────────────────┐      WebSocket (CDP)      ┌─────────────┐
│ outsystems-figma-cli │ ◄───────────────────────► │   Figma     │
│        (CLI)         │   localhost:9222-9322     │   Desktop   │
└──────────────────────┘      (random port)        └─────────────┘
```

### Security

- **Session token authentication** — random 32-byte token required for all requests
- **No CORS headers** — blocks cross-origin browser requests
- **Host header validation** — only accepts localhost/127.0.0.1
- **Idle timeout** — auto-shutdown after 10 minutes of inactivity
- **Random port** — CDP uses a random port between 9222-9322 per session

---

## Full Feature List

### OutSystems-Specific

- **OutSystems UI Tokens** — colors, typography, spacing, radius using OS CSS variable naming
- **Platform-aware** — ODC and O11 support with correct CSS export targets
- **OS UI Patterns** — 40+ patterns including Card, Modal, Tabs, Accordion, Gallery, Wizard
- **Pattern Components** — import components directly from your Figma team libraries;
  `pattern scan` indexes component and icon keys locally, `pattern add` places instances
  with variant, state, and property control (`--prop` flag supports text, boolean, and
  instance swap)
- **Screen templates** — Dashboard, List, Detail, Form, Login, Settings (mobile and web)
- **Layer naming enforcement** — `OS/{Component}/{Variant}/{State}` convention

### Design Tokens & Variables

- Create and manage variable collections
- Variable modes (Light/Dark) with per-mode values
- Batch create up to 100 variables at once
- Bind variables to node properties (fill, stroke, gap, padding, radius)
- Export variables as CSS custom properties

### Create Elements

- Frames with auto-layout
- Rectangles, circles, ellipses, lines
- Text with custom fonts, sizes, weights
- Icons (150,000+ from Iconify: Lucide, Material Design, Heroicons, etc.)
- Components from frames, component instances, component sets with variants
- Slots — flexible content areas in components (add, reset, clear slot content in instances)

### Export

- Export nodes as PNG, SVG (with scale factor)
- Export to JSX (React code)
- Export to Storybook stories
- Export variables as CSS
- Take screenshots

### Lint & Accessibility

- Contrast checker (WCAG AA/AAA compliance)
- Touch target size check (minimum 44×44)
- No hardcoded colors check
- Unnamed layers detection
- Minimum text size check

### FigJam Support

- Create sticky notes, shapes, and connectors
- List FigJam elements
- Run JavaScript in FigJam context

---

## Powered By

This CLI is built on top of **[figma-use](https://github.com/dannote/figma-use)** by [dannote](https://github.com/dannote) and was inspired by **[figma-cli](https://github.com/silships/figma-cli)** by [silships](https://github.com/silships).

## License

MIT