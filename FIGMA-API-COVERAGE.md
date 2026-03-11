# Figma Plugin API Coverage

Tracks which Figma Plugin API calls are used by this CLI.

**Status markers:**
- `[x]` implemented and in use
- `[ ]` known API, not yet used
- `[-]` partially implemented
- `[~]` intentionally skipped / not applicable

---

## Node Creation

| Status | API | Notes |
|--------|-----|-------|
| [x] | `figma.createFrame()` | Used for screens, frames, placeholders |
| [x] | `figma.createRectangle()` | Used for shape creation |
| [x] | `figma.createEllipse()` | Used for shape creation |
| [x] | `figma.createText()` | Used for text nodes |
| [x] | `figma.createLine()` | Used for line creation |
| [x] | `figma.createNodeFromSvg()` | Used for SVG import |
| [x] | `figma.createImage()` | Used for image creation |
| [x] | `figma.createImageAsync()` | Used for async image creation |
| [x] | `figma.createConnector()` | Used for FigJam connector creation |
| [x] | `figma.createShapeWithText()` | Used for FigJam shape nodes |
| [x] | `figma.createSticky()` | Used for FigJam sticky notes |
| [ ] | `figma.createVector()` | Vector node creation |
| [ ] | `figma.createPolygon()` | Polygon node creation |
| [ ] | `figma.createStar()` | Star node creation |
| [ ] | `figma.createBooleanOperation()` | Boolean operations |
| [ ] | `figma.createSlice()` | Slice creation |
| [~] | `figma.createPage()` | Page management out of scope |

---

## Node Transformation

| Status | API | Notes |
|--------|-----|-------|
| [x] | `figma.group()` | Grouping nodes |
| [x] | `figma.flatten()` | Flatten nodes |
| [x] | `figma.createComponentFromNode()` | Converting frames to components |
| [x] | `figma.combineAsVariants()` | Combining components as variants |
| [ ] | `figma.union()` | Boolean union |
| [ ] | `figma.subtract()` | Boolean subtract |
| [ ] | `figma.intersect()` | Boolean intersect |
| [ ] | `figma.exclude()` | Boolean exclude |

---

## Node Lookup

| Status | API | Notes |
|--------|-----|-------|
| [x] | `figma.getNodeById()` | Core node resolution |
| [x] | `figma.getNodeByIdAsync()` | Async node resolution |
| [x] | `figma.currentPage` | Current page access |
| [x] | `figma.currentPage.selection` | Selection read/write |
| [x] | `figma.currentPage.children` | Page children |
| [x] | `figma.currentPage.findAll()` | Recursive node search |
| [x] | `figma.currentPage.findOne()` | Recursive node search (first) |
| [x] | `figma.currentPage.appendChild()` | Append child to page |
| [x] | `figma.root.findAll()` | Search across all pages |
| [x] | `figma.root.findAllWithCriteria()` | Criteria-based search |
| [ ] | `figma.root.findOne()` | Search across all pages (first) |

---

## Node Properties

| Status | API | Notes |
|--------|-----|-------|
| [x] | `.fills` | Fill paint array |
| [x] | `.strokes` | Stroke paint array |
| [x] | `.strokeWeight` | Stroke width |
| [x] | `.strokeAlign` | Stroke alignment |
| [x] | `.effects` | Effects array |
| [x] | `.effectStyleId` | Bound effect style |
| [x] | `.cornerRadius` | Corner radius |
| [x] | `.visible` | Visibility |
| [x] | `.locked` | Lock state |
| [x] | `.rotation` | Rotation degrees |
| [x] | `.width` | Node width |
| [x] | `.height` | Node height |
| [x] | `.constraints` | Resize constraints |
| [ ] | `.opacity` | Node opacity |
| [ ] | `.blendMode` | Blend mode |
| [ ] | `.isMask` | Mask state |
| [ ] | `.exportSettings` | Export settings |
| [ ] | `.reactions` | Prototype reactions |
| [ ] | `.name` | Node name (read/write) |

---

## Auto-Layout

| Status | API | Notes |
|--------|-----|-------|
| [x] | `.layoutMode` | HORIZONTAL / VERTICAL / NONE |
| [x] | `.paddingTop` | Auto-layout padding |
| [x] | `.paddingRight` | Auto-layout padding |
| [x] | `.paddingBottom` | Auto-layout padding |
| [x] | `.paddingLeft` | Auto-layout padding |
| [x] | `.itemSpacing` | Gap between children |
| [x] | `.primaryAxisAlignItems` | Main axis alignment |
| [x] | `.counterAxisAlignItems` | Cross axis alignment |
| [x] | `.layoutSizingHorizontal` | FIXED / HUG / FILL |
| [x] | `.layoutSizingVertical` | FIXED / HUG / FILL |
| [x] | `.layoutWrap` | Wrap behaviour |
| [x] | `.primaryAxisSizingMode` | Legacy sizing mode |
| [x] | `.counterAxisSizingMode` | Legacy sizing mode |
| [ ] | `.layoutAlign` | Child layout align |
| [x] | `.layoutGrow` | Grow factor |
| [x] | `.layoutPositioning` | Absolute / auto |
| [ ] | `.counterAxisSpacing` | Wrap row gap |
| [ ] | `.minWidth` | Min width constraint |
| [ ] | `.maxWidth` | Max width constraint |
| [ ] | `.minHeight` | Min height constraint |
| [ ] | `.maxHeight` | Max height constraint |

---

## Typography

| Status | API | Notes |
|--------|-----|-------|
| [x] | `.characters` | Text content |
| [x] | `.fontSize` | Font size |
| [x] | `.fontName` | Font family + style |
| [x] | `.lineHeight` | Line height |
| [x] | `.letterSpacing` | Letter spacing |
| [x] | `.textAlignHorizontal` | Horizontal text alignment |
| [x] | `.textStyleId` | Bound text style |
| [x] | `figma.loadFontAsync()` | Load font before editing |
| [ ] | `.textAlignVertical` | Vertical text alignment |
| [ ] | `.textDecoration` | Underline / strikethrough |
| [ ] | `.textCase` | Text case transformation |
| [ ] | `.paragraphSpacing` | Spacing between paragraphs |
| [ ] | `.paragraphIndent` | Paragraph indent |
| [ ] | `figma.getLocalTextStyles()` | Read local text styles |
| [ ] | `figma.importStyleByKeyAsync()` | Import style from library |

---

## Components & Instances

| Status | API | Notes |
|--------|-----|-------|
| [x] | `figma.importComponentByKeyAsync()` | Import component from library |
| [x] | `figma.importComponentSetByKeyAsync()` | Import component set from library |
| [x] | `.componentProperties` | Read component properties |
| [x] | `.setProperties()` | Set component properties on instance |
| [ ] | `.detachInstance()` | Detach component instance |
| [x] | `.resetOverrides()` | Reset instance overrides |
| [x] | `.mainComponent` | Access main component |
| [x] | `.swapComponent()` | Swap instance main component |

---

## Variables

| Status | API | Notes |
|--------|-----|-------|
| [x] | `figma.variables.getLocalVariables()` | Read local variables (sync) |
| [x] | `figma.variables.getLocalVariablesAsync()` | Read local variables (async) |
| [x] | `figma.variables.getLocalVariableCollections()` | Read collections (sync) |
| [x] | `figma.variables.getLocalVariableCollectionsAsync()` | Read collections (async) |
| [x] | `figma.variables.getVariableById()` | Resolve variable by ID |
| [x] | `figma.variables.getVariableByIdAsync()` | Resolve variable by ID (async) |
| [x] | `figma.variables.getVariableCollectionById()` | Resolve collection |
| [x] | `figma.variables.createVariable()` | Create new variable |
| [x] | `figma.variables.createVariableCollection()` | Create new collection |
| [x] | `figma.variables.importVariableByKeyAsync()` | Import variable from library |
| [x] | `figma.variables.setBoundVariableForPaint()` | Bind variable to paint |
| [x] | `.setBoundVariable()` | Bind variable to node property |
| [x] | `.boundVariables` | Read current variable bindings on a node |
| [x] | `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` | Library collections |
| [x] | `figma.teamLibrary.getVariablesInLibraryCollectionAsync()` | Library variables |
| [ ] | `figma.variables.getVariableCollectionByIdAsync()` | Async collection lookup |

---

## Styles

| Status | API | Notes |
|--------|-----|-------|
| [x] | `figma.getLocalTextStyles()` | Read local text styles |
| [x] | `figma.getLocalEffectStyles()` | Read local effect styles |
| [x] | `figma.getLocalPaintStyles()` | Read local paint styles |
| [x] | `figma.getLocalGridStyles()` | Read local grid styles |
| [x] | `figma.importStyleByKeyAsync()` | Import style from library |
| [ ] | `figma.createPaintStyle()` | Create paint style |
| [ ] | `figma.createTextStyle()` | Create text style |
| [ ] | `figma.createEffectStyle()` | Create effect style |
| [ ] | `figma.createGridStyle()` | Create grid style |

---

## Plugin Data

| Status | API | Notes |
|--------|-----|-------|
| [x] | `figma.root.getPluginData()` | Read root plugin data |
| [x] | `figma.root.setPluginData()` | Write root plugin data |
| [ ] | `node.getPluginData()` | Read node plugin data |
| [ ] | `node.setPluginData()` | Write node plugin data |
| [ ] | `node.getSharedPluginData()` | Read shared plugin data |
| [ ] | `node.setSharedPluginData()` | Write shared plugin data |

---

## Viewport & UI

| Status | API | Notes |
|--------|-----|-------|
| [x] | `figma.viewport.scrollAndZoomIntoView()` | Pan/zoom to nodes |
| [x] | `figma.viewport.bounds` | Current viewport bounds |
| [ ] | `figma.viewport.center` | Viewport center point |
| [ ] | `figma.viewport.zoom` | Viewport zoom level |
| [~] | `figma.showUI()` | Plugin UI — CLI doesn't use UI |
| [~] | `figma.ui.postMessage()` | Plugin UI messaging |

---

## Misc

| Status | API | Notes |
|--------|-----|-------|
| [x] | `figma.editorType` | Detect Figma vs FigJam |
| [x] | `figma.fileKey` | Current file key |
| [ ] | `figma.currentUser` | Current user info |
| [ ] | `figma.activeUsers` | Active collaborators |
| [ ] | `figma.notify()` | Toast notification |
| [ ] | `figma.closePlugin()` | Close plugin |
| [~] | `figma.on()` | Event listeners — daemon handles lifecycle |
