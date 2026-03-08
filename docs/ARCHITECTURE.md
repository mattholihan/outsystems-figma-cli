# Architecture

## How outsystems-figma-cli Works

```
┌─────────────────────┐      Chrome DevTools      ┌─────────────────┐
│ outsystems-figma-cli│ ◄────── Protocol ───────► │  Figma Desktop  │
│        (CLI)        │      (localhost:9222)      │                 │
└─────────────────────┘                            └─────────────────┘
```

### Technology Stack

1. **Chrome DevTools Protocol (CDP)**: Figma Desktop is an Electron app with a Chromium runtime. We connect via CDP on port 9222.

2. **figma-use**: The underlying library that handles CDP connection and JavaScript execution. Our CLI wraps this.

3. **Figma Plugin API**: We execute JavaScript against the global `figma` object, which provides full access to the Figma Plugin API.

### Connection Flow

1. User runs `node src/index.js connect`
2. CLI patches Figma to enable remote debugging (adds `--remote-debugging-port=9222` flag)
3. Figma restarts with debugging enabled
4. CLI connects via WebSocket to `localhost:9222`
5. Commands are executed as JavaScript in Figma's context

### Key Files

```
outsystems-figma-cli/
├── src/
│   ├── index.js          # Main CLI entry point, all commands
│   └── outsystems.js     # OutSystems-specific constants and helpers
├── package.json          # npm package config
├── CLAUDE.md             # AI agent knowledge base (OutSystems conventions)
├── OUTSYSTEMS.md         # OutSystems design system reference
├── ARCHITECTURE.md       # This file
├── README.md             # User documentation
└── docs/                 # Technical documentation
```

### No API Key Required

Unlike the Figma REST API which requires authentication, we use the Plugin API directly through the desktop app. This means:

- Full read/write access to everything
- No rate limits
- Access to features not available in REST API (like variable modes)
- Works with the user's existing Figma session

### OutSystems-Specific Design

This CLI is purpose-built for OutSystems app design. It is aware of:

- **OutSystems UI Kit v2.0** — component and pattern naming conventions
- **Design tokens** — OutSystems CSS custom property naming (`--color-primary`, `--space-m`, etc.)
- **Platform targets** — ODC (OutSystems Developer Cloud) and O11 (OutSystems 11)
- **Screen sizes** — correct frame dimensions for mobile (390×844), tablet (768×1024), and web (1440×900)
- **Layer naming** — enforces `OS/{Component}/{Variant}/{State}` convention throughout
- **Slots** — support for Figma Slots (CHILDREN component properties) to create flexible content areas in components

### Limitations

- macOS only (for now)
- Requires Figma Desktop (not web)
- One Figma instance at a time
- Some eval commands don't return output (but still execute)