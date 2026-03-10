# Architecture

## How outsystems-figma-cli Works

**Yolo Mode (CDP):**
```
┌──────────────────────┐      WebSocket (CDP)      ┌─────────────────┐
│ outsystems-figma-cli │ ◄───────────────────────► │  Figma Desktop  │
│       (CLI)          │    localhost:9222-9322     │                 │
└──────────────────────┘      (random port)         └─────────────────┘
```

**Safe Mode (Plugin):**
```
┌──────────────────────┐      WebSocket      ┌─────────────┐    Plugin API    ┌─────────────┐
│ outsystems-figma-cli │ ◄─────────────────► │   Daemon    │ ◄─────────────► │   Plugin    │
│       (CLI)          │    localhost:3456   └─────────────┘                  └─────────────┘
└──────────────────────┘
```

### Technology Stack

1. **Chrome DevTools Protocol (CDP)**: Figma Desktop is an Electron app with a Chromium runtime. We connect via CDP on a random port in the 9222–9322 range (Yolo Mode).

2. **Speed Daemon**: A local HTTP server (`localhost:3456`) that maintains a persistent connection to Figma, making subsequent commands significantly faster. Started automatically by `os-figma connect`.

3. **Figma Plugin API**: We execute JavaScript against the global `figma` object, which provides full access to the Figma Plugin API.

### Connection Flow

1. User runs `os-figma connect`
2. **Yolo Mode**: CLI patches Figma to enable remote debugging, Figma restarts, CLI connects via WebSocket to the CDP port
3. **Safe Mode**: User starts the FigCli plugin manually; daemon connects via Plugin API over WebSocket on `localhost:3456`
4. Commands are executed as JavaScript in Figma's context

### Key Files

```
outsystems-figma-cli/          ← Global CLI tool (installed via npm install -g .)
├── src/
│   ├── index.js               # Main CLI entry point, all commands
│   ├── outsystems-tokens.js   # OutSystems token definitions
│   └── daemon.js              # Speed daemon for faster command execution
├── bin/
│   ├── fig-start              # Figma launcher script
│   └── setup-alias.sh         # One-time alias setup
├── package.json               # npm package config (bin: os-figma)
├── CLAUDE.md                  # AI agent knowledge base (global, all projects)
├── ARCHITECTURE.md            # This file
├── README.md                  # User documentation
└── docs/
    ├── COMMANDS.md            # Full command reference
    ├── TECHNIQUES.md          # Advanced patterns
    ├── FIGJAM.md              # FigJam support
    └── CLAUDE-SESSION.md      # Session quick reference

project-directory/             ← Per-project files (one per client/project)
├── tokens.json                # Project-specific token values, synced with Figma
└── library-config.json        # Figma library connections, component keys, and icon keys
```

## Project Architecture

The CLI follows a global tool / local project model:

- **Global CLI** — installed once, used across all projects via `os-figma` command
- **Project config** — each project has its own `tokens.json` and `library-config.json`

### Setting up a new project
1. Create a project directory
2. Run `os-figma init` — generates `tokens.json` and `library-config.json`
3. Run `os-figma tokens pull` — syncs token values from Figma into `tokens.json`
4. Run `os-figma pattern scan` — open component library file in Figma first;
   indexes component keys into library-config.json (one-time setup)
5. Run `os-figma pattern scan --icons` — open foundations/icon library file in
   Figma first; indexes icon keys into library-config.json (one-time setup)

### Token sync flow
```
tokens.json  ──── os-figma tokens push ────►  Figma Variables
tokens.json  ◄─── os-figma tokens pull ────   Figma Variables
             ◄─── os-figma tokens status ───►  (compare only)
```

### Two Figma library files
Each project connects to two separate Figma Team Library files:
- **Foundations** — colors, typography, spacing, border tokens
- **Components** — UI patterns (Button, Card, Input, etc.)

Library file names are configured per-project in `library-config.json`.

### No API Key Required

Unlike the Figma REST API which requires authentication, we use the Plugin API directly through the desktop app. This means:

- Full read/write access to everything
- No rate limits
- Access to features not available in REST API (like variable modes)
- Works with the user's existing Figma session

### CLI Design

This CLI is purpose-built for designing apps with a Figma component library. It is aware of:

- **Custom component library** — two-file setup (Foundations + Components) linked as Figma Team Libraries
- **Project-specific tokens** — token values stored in `tokens.json`, synced bidirectionally with Figma
- **Design tokens** — CSS custom property naming (`--color-primary`, `--space-m`, etc.)
- **Screen sizes** — correct frame dimensions for mobile (390×844), tablet (768×1024), and web (1440×900)
- **Layer naming** — `{Component}/{Variant}/{State}` convention throughout
- **Slots** — support for Figma Slots (CHILDREN component properties) to create flexible content areas in components
- **Pattern index** — component and icon keys stored in `library-config.json`,
  populated by `os-figma pattern scan`. Enables `pattern list` and `pattern add`
  without requiring a live library enumeration API.

### Limitations

- macOS only (for now)
- Requires Figma Desktop (not web)
- One Figma instance at a time
- Some eval commands don't return output (but still execute)
- Project commands (`tokens pull`, `tokens push`, `tokens status`) must be run from a project directory containing `tokens.json` and `library-config.json`
- Token values are project-specific — always run `os-figma tokens pull` when switching between projects
- `pattern scan` and `pattern scan --icons` must be run with the relevant Figma
  library file open in Figma Desktop
