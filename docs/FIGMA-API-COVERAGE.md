# Figma Plugin API Coverage

Tracks which Figma Plugin API capabilities are exposed as CLI commands.
 **Rule:** Any new command added to the CLI must check off its row here.
 **Source:** [Figma Plugin API Reference](https://www.figma.com/plugin-docs/api/figma/)

Legend: `[x]` implemented · `[-]` partial · `[ ]` not implemented · `[~]` intentionally skipped

------

## figma global object

### Node Retrieval

| Status | API                                  | CLI Command                      | Notes                                      |
| ------ | ------------------------------------ | -------------------------------- | ------------------------------------------ |
| `[x]`  | `figma.getNodeByIdAsync(id)`         | internal — used by most commands |                                            |
| `[x]`  | `figma.currentPage.selection` (read) | `node inspect` (no-arg form)     |                                            |
| `[ ]`  | `figma.currentPage.selection` (set)  | —                                | agent needs this to point at what it built |
| `[x]`  | `figma.currentPage.findAll()`        | internal — used by pattern scan  |                                            |
| `[ ]`  | `figma.currentPage.findOne()`        | —                                | useful for agent node lookup by name       |
| `[ ]`  | `figma.root.children` (all pages)    | —                                | low priority                               |

### Node Creation

| Status | API                               | CLI Command          | Notes                                       |
| ------ | --------------------------------- | -------------------- | ------------------------------------------- |
| `[x]`  | `figma.createFrame()`             | `render <Frame>`     | via JSX render                              |
| `[x]`  | `figma.createText()`              | `render <Text>`      | via JSX render                              |
| `[x]`  | `figma.createRectangle()`         | `render <Rectangle>` | via JSX render                              |
| `[x]`  | `figma.createComponent()`         | `node to-component`  |                                             |
| `[ ]`  | `figma.createComponentFromNode()` | —                    | cleaner than createComponent; added API v86 |
| `[ ]`  | `figma.createEllipse()`           | —                    | low priority                                |
| `[ ]`  | `figma.createLine()`              | —                    | low priority                                |
| `[ ]`  | `figma.createVector()`            | —                    | low priority                                |
| `[ ]`  | `figma.createBooleanOperation()`  | —                    | low priority                                |
| `[ ]`  | `figma.createPage()`              | —                    | useful for multi-page screen templates      |
| `[ ]`  | `figma.group()`                   | —                    | occasionally useful                         |
| `[ ]`  | `figma.ungroup()`                 | —                    | occasionally useful                         |
| `[ ]`  | `figma.flatten()`                 | —                    | low priority                                |
| `[ ]`  | `figma.createImage()`             | —                    | needed for image fill support               |
| `[ ]`  | `figma.createImageAsync()`        | —                    | needed for image fill support               |

### Document & Pages

| Status | API                               | CLI Command | Notes                                |
| ------ | --------------------------------- | ----------- | ------------------------------------ |
| `[x]`  | `figma.currentPage` (read)        | internal    |                                      |
| `[ ]`  | `figma.setCurrentPageAsync()`     | —           | useful for multi-page workflows      |
| `[ ]`  | `figma.currentPage.name` (set)    | —           | rename page                          |
| `[ ]`  | `figma.saveVersionHistoryAsync()` | —           | nice-to-have before major agent runs |
| `[ ]`  | `figma.commitUndo()`              | —           | agent should commit undo checkpoints |
| `[ ]`  | `figma.triggerUndo()`             | —           | revert last agent action             |

### Viewport

| Status | API                                      | CLI Command | Notes                               |
| ------ | ---------------------------------------- | ----------- | ----------------------------------- |
| `[ ]`  | `figma.viewport.scrollAndZoomIntoView()` | —           | agent should focus on what it built |
| `[ ]`  | `figma.viewport.center` (set)            | —           |                                     |
| `[ ]`  | `figma.viewport.zoom` (set)              | —           |                                     |

------

## figma.variables (Variables API)

| Status | API                                     | CLI Command                     | Notes                                        |
| ------ | --------------------------------------- | ------------------------------- | -------------------------------------------- |
| `[x]`  | `getLocalVariablesAsync()`              | `tokens pull/push/status`       |                                              |
| `[x]`  | `getVariableById()`                     | internal — used by node inspect |                                              |
| `[x]`  | `getLocalVariableCollectionsAsync()`    | internal                        |                                              |
| `[x]`  | `setBoundVariable()` on fills           | `bind fill`                     |                                              |
| `[ ]`  | `setBoundVariable()` on strokes         | —                               | needed for border color tokens               |
| `[ ]`  | `setBoundVariable()` on effects         | —                               | needed for shadow tokens                     |
| `[ ]`  | `setBoundVariable()` on text properties | —                               | fontSize, lineHeight, letterSpacing; API v91 |
| `[ ]`  | `createVariable()`                      | —                               | low priority — tokens managed in Figma       |
| `[ ]`  | `createVariableCollection()`            | —                               | low priority                                 |
| `[ ]`  | `deleteVariable()`                      | —                               | low priority                                 |

------

## figma.teamLibrary (Team Library API)

| Status | API                                             | CLI Command   | Notes                                          |
| ------ | ----------------------------------------------- | ------------- | ---------------------------------------------- |
| `[x]`  | `getAvailableLibraryVariableCollectionsAsync()` | `tokens pull` |                                                |
| `[x]`  | `getVariablesInLibraryCollectionAsync()`        | `tokens pull` |                                                |
| `[x]`  | `importComponentByKeyAsync()`                   | `pattern add` |                                                |
| `[ ]`  | `importComponentSetByKeyAsync()`                | —             | import whole variant set at once               |
| `[ ]`  | `importStyleByKeyAsync()`                       | —             | **needed for styles pull**                     |
| `[ ]`  | `getAvailableLibraryTextStylesAsync()`          | —             | **needed for styles pull**                     |
| `[ ]`  | `getAvailableLibraryEffectStylesAsync()`        | —             | **needed for styles pull**                     |
| `[ ]`  | `getAvailableLibraryGridStylesAsync()`          | —             | low priority                                   |
| `[ ]`  | `getAvailableLibraryPaintStylesAsync()`         | —             | low priority (covered by variables for tokens) |

------

## Node Properties — Layout & Auto-Layout

| Status | Property                                  | CLI Command             | Notes                                           |
| ------ | ----------------------------------------- | ----------------------- | ----------------------------------------------- |
| `[x]`  | `layoutMode` (HORIZONTAL/VERTICAL/NONE)   | `render flex="row/col"` |                                                 |
| `[x]`  | `paddingTop/Right/Bottom/Left`            | `render p= px= py=`     |                                                 |
| `[x]`  | `itemSpacing`                             | `render gap=`           |                                                 |
| `[x]`  | `primaryAxisAlignItems`                   | `render justify=`       |                                                 |
| `[x]`  | `counterAxisAlignItems`                   | `render items=`         |                                                 |
| `[x]`  | `layoutSizingHorizontal` (FIXED/HUG/FILL) | `render w="fill/hug"`   |                                                 |
| `[x]`  | `layoutSizingVertical`                    | `render h="fill/hug"`   |                                                 |
| `[ ]`  | `layoutWrap`                              | —                       | flex wrap; useful for tag/chip rows             |
| `[ ]`  | `minWidth / maxWidth`                     | —                       | needed for responsive fill-width buttons        |
| `[ ]`  | `minHeight / maxHeight`                   | —                       |                                                 |
| `[ ]`  | `counterAxisSpacing`                      | —                       | gap between wrapped rows                        |
| `[ ]`  | `primaryAxisSizingMode`                   | —                       | separate from layoutSizing in some API versions |
| `[ ]`  | `layoutGrow`                              | `render grow=`          | partially — needs audit                         |
| `[ ]`  | `layoutAlign`                             | —                       | STRETCH/INHERIT per child                       |
| `[ ]`  | `constraints`                             | —                       | pin to top/left/right/bottom/center/scale       |

------

## Node Properties — Fills & Strokes

| Status | Property                     | CLI Command           | Notes                          |
| ------ | ---------------------------- | --------------------- | ------------------------------ |
| `[x]`  | `fills` — SOLID color        | `render bg=`          |                                |
| `[x]`  | `fills` — variable binding   | `bind fill`           |                                |
| `[ ]`  | `fills` — GRADIENT_LINEAR    | —                     | low priority                   |
| `[ ]`  | `fills` — GRADIENT_RADIAL    | —                     | low priority                   |
| `[ ]`  | `fills` — IMAGE              | —                     | needed for hero/avatar images  |
| `[x]`  | `strokes` — SOLID color      | `render stroke=`      |                                |
| `[ ]`  | `strokes` — variable binding | —                     | border color tokens unbound    |
| `[ ]`  | `strokeWeight`               | `render strokeWidth=` | needs audit — may already work |
| `[ ]`  | `strokeAlign`                | —                     | INSIDE/OUTSIDE/CENTER          |
| `[ ]`  | `strokeDashPattern`          | —                     | dashed borders; low priority   |
| `[ ]`  | `opacity`                    | —                     | layer-level opacity            |
| `[ ]`  | `blendMode`                  | —                     | low priority                   |

------

## Node Properties — Corner Radius

| Status | Property                                                     | CLI Command       | Notes                               |
| ------ | ------------------------------------------------------------ | ----------------- | ----------------------------------- |
| `[x]`  | `cornerRadius` (uniform)                                     | `render rounded=` |                                     |
| `[ ]`  | `topLeftRadius / topRightRadius / bottomLeftRadius / bottomRightRadius` | —                 | per-corner radius; useful for cards |

------

## Node Properties — Effects

| Status | Property                                | CLI Command    | Notes                                   |
| ------ | --------------------------------------- | -------------- | --------------------------------------- |
| `[ ]`  | `effects` — DROP_SHADOW (set)           | —              | **high priority** — core to polished UI |
| `[ ]`  | `effects` — INNER_SHADOW (set)          | —              |                                         |
| `[ ]`  | `effects` — LAYER_BLUR (set)            | —              |                                         |
| `[ ]`  | `effects` — BACKGROUND_BLUR (set)       | —              | frosted glass pattern                   |
| `[ ]`  | `effectStyleId` (bind to library style) | —              | **needed after styles pull**            |
| `[x]`  | `effects` (read)                        | `node inspect` |                                         |

------

## Node Properties — Typography

| Status | Property                              | CLI Command                   | Notes                                 |
| ------ | ------------------------------------- | ----------------------------- | ------------------------------------- |
| `[x]`  | `characters` (text content)           | `render <Text>`               |                                       |
| `[x]`  | `fontSize`                            | `render size=`                |                                       |
| `[x]`  | `fontName` (family + style/weight)    | `render weight=`              |                                       |
| `[x]`  | `fills` on text (color + variable)    | `render color=` / `bind fill` |                                       |
| `[ ]`  | `textStyleId` (bind to library style) | —                             | **needed after styles pull**          |
| `[ ]`  | `lineHeight`                          | —                             | needed for precise type ramp matching |
| `[ ]`  | `letterSpacing`                       | —                             |                                       |
| `[ ]`  | `textAlignHorizontal`                 | —                             | LEFT/CENTER/RIGHT/JUSTIFIED           |
| `[ ]`  | `textAlignVertical`                   | —                             | TOP/CENTER/BOTTOM                     |
| `[ ]`  | `textDecoration`                      | —                             | NONE/UNDERLINE/STRIKETHROUGH          |
| `[ ]`  | `textCase`                            | —                             | ORIGINAL/UPPER/LOWER/TITLE            |
| `[ ]`  | `paragraphSpacing`                    | —                             |                                       |
| `[ ]`  | `truncation`                          | —                             | text overflow; useful for list items  |

------

## Node Properties — Styles (local document)

| Status | API                            | CLI Command | Notes                           |
| ------ | ------------------------------ | ----------- | ------------------------------- |
| `[ ]`  | `figma.getLocalTextStyles()`   | —           | read local text styles          |
| `[ ]`  | `figma.getLocalEffectStyles()` | —           | read local effect styles        |
| `[ ]`  | `figma.getLocalPaintStyles()`  | —           | read local color styles         |
| `[ ]`  | `figma.getLocalGridStyles()`   | —           | read local grid styles          |
| `[ ]`  | `figma.getStyleByIdAsync()`    | —           | look up style by ID             |
| `[ ]`  | `figma.createPaintStyle()`     | —           | low priority                    |
| `[ ]`  | `figma.createTextStyle()`      | —           | low priority                    |
| `[ ]`  | `figma.createEffectStyle()`    | —           | low priority                    |
| `[ ]`  | `node.textStyleId` (set)       | —           | apply text style to a TEXT node |
| `[ ]`  | `node.effectStyleId` (set)     | —           | apply effect style to any node  |
| `[ ]`  | `node.fillStyleId` (set)       | —           | apply paint style to fills      |

------

## Components & Instances

| Status | API                                   | CLI Command          | Notes                                |
| ------ | ------------------------------------- | -------------------- | ------------------------------------ |
| `[x]`  | `importComponentByKeyAsync()`         | `pattern add`        |                                      |
| `[ ]`  | `importComponentSetByKeyAsync()`      | —                    |                                      |
| `[x]`  | `instance.setProperties()`            | `pattern add --prop` | TEXT, BOOLEAN, INSTANCE_SWAP         |
| `[x]`  | `instance.componentProperties` (read) | `node inspect`       |                                      |
| `[ ]`  | `component.addComponentProperty()`    | —                    | create new component props; advanced |
| `[ ]`  | `component.editComponentProperty()`   | —                    |                                      |
| `[ ]`  | `component.deleteComponentProperty()` | —                    |                                      |
| `[ ]`  | `instance.detachInstance()`           | —                    |                                      |
| `[ ]`  | `instance.resetOverrides()`           | —                    |                                      |
| `[ ]`  | `instance.swapComponent()`            | —                    | swap to different component variant  |
| `[ ]`  | `figma.combineAsVariants()`           | —                    | create component set from components |

------

## Inspection

| Status | API                             | CLI Command           | Notes                                       |
| ------ | ------------------------------- | --------------------- | ------------------------------------------- |
| `[x]`  | `figma.getNodeByIdAsync()`      | `node inspect`        |                                             |
| `[x]`  | identity, geometry, layout      | `node inspect`        |                                             |
| `[x]`  | fills + variable binding (read) | `node inspect`        |                                             |
| `[x]`  | strokes (read)                  | `node inspect`        |                                             |
| `[x]`  | effects (read)                  | `node inspect`        |                                             |
| `[x]`  | typography (read)               | `node inspect`        |                                             |
| `[x]`  | component properties (read)     | `node inspect`        |                                             |
| `[x]`  | children (shallow)              | `node inspect`        |                                             |
| `[x]`  | children (recursive)            | `node inspect --deep` |                                             |
| `[x]`  | design system warnings          | `node inspect`        | unbound fills/strokes/styles                |
| `[ ]`  | `node inspect --children`       | —                     | list all top-level children of current page |

------

## Miscellaneous / Low Priority

| Status | API                                      | CLI Command | Notes                                         |
| ------ | ---------------------------------------- | ----------- | --------------------------------------------- |
| `[ ]`  | `figma.viewport.scrollAndZoomIntoView()` | —           | agent UX — focus canvas on result             |
| `[ ]`  | `figma.commitUndo()`                     | —           | agent should checkpoint before bulk changes   |
| `[ ]`  | `node.setPluginData()`                   | —           | persist metadata on nodes; advanced           |
| `[ ]`  | `node.getPluginData()`                   | —           |                                               |
| `[ ]`  | `node.setSharedPluginData()`             | —           |                                               |
| `[ ]`  | `figma.on('selectionchange')`            | —           | event-driven workflows; not applicable to CLI |
| `[~]`  | `figma.showUI()`                         | —           | CLI has no plugin UI                          |
| `[~]`  | `figma.ui.*`                             | —           | CLI has no plugin UI                          |
| `[~]`  | FigJam-only APIs (timer, stickies, etc.) | —           | out of scope                                  |
| `[~]`  | `figma.payments`                         | —           | out of scope                                  |

------

## Priority Backlog

Ranked by impact on agentic screen-building:

| Priority | API Gap                                  | Unlocks                                       |
| -------- | ---------------------------------------- | --------------------------------------------- |
| 🔴 1      | `effectStyleId` (set) + `styles pull`    | Shadows on cards, overlays, elevation system  |
| 🔴 2      | `textStyleId` (set) + `styles pull`      | Correct type ramp application                 |
| 🔴 3      | `setBoundVariable()` on strokes          | Border color tokens                           |
| 🟡 4      | `minWidth / maxWidth`                    | Fill-width buttons, responsive frames         |
| 🟡 5      | `lineHeight / letterSpacing`             | Precise type ramp matching                    |
| 🟡 6      | `textAlignHorizontal`                    | Center-aligned headings, CTAs                 |
| 🟡 7      | `figma.viewport.scrollAndZoomIntoView()` | Agent focuses canvas on output                |
| 🟡 8      | `figma.commitUndo()`                     | Safe checkpoints before bulk agent operations |
| 🟢 9      | `layoutWrap`                             | Chip/tag row patterns                         |
| 🟢 10     | `fills` — IMAGE type                     | Hero images, avatars                          |
| 🟢 11     | `createPage()`                           | Multi-page file scaffolding                   |
| 🟢 12     | Per-corner radius                        | Card-specific rounding                        |
| 🟢 13     | `figma.createComponentFromNode()`        | Cleaner component creation (API v86)          |
| 🟢 14     | `currentPage.selection` (set)            | Agent selects what it just built              |