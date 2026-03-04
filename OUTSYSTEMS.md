# OutSystems Figma CLI — Knowledge Base

## What This CLI Does
This CLI controls Figma Desktop to create designs specifically for OutSystems apps.
It understands OutSystems UI patterns, tokens, and component naming conventions.

## OutSystems UI Kit
- Based on OutSystems UI v2.0.0 (Figma Community)
- Uses Figma Variables and Tokens, Auto-Layout, and Component Variants
- Supports both ODC (OutSystems Developer Cloud) and O11 (OutSystems 11)

## Design Token Naming Conventions
Colors:
  --color-primary         (main brand color)
  --color-secondary       (secondary brand color)
  --color-neutral-0       (white)
  --color-neutral-100     (lightest gray) through --color-neutral-900 (darkest)
  --color-feedback-success / -warning / -error / -info

Typography:
  --font-size-base        (16px default)
  --font-size-h1 through --font-size-h6
  --font-weight-regular / -medium / -bold
  --line-height-base

Spacing:
  --space-xs / -s / -m / -l / -xl / -2xl

Radius:
  --border-radius-s / -m / -l / -pill

## OutSystems UI Pattern Names (for use in commands)
Accordion, Alert, AnimatedLabel, Balloon, Badge, BottomBar, Breadcrumbs,
ButtonGroup, Card, Carousel, Columns, DatePicker, Dropdown, FileUpload,
FloatingActions, Gallery, IconBadge, InlineSVG, InputWithIcon, Map,
MasterDetail, Modal, Notification, ProgressBar, RangeSlider, Rating,
Ribbon, Search, Section, SectionIndex, Sidebar, Skeleton, Stacked Cards,
StatusBar, Tabs, Tag, TimePicker, Timeline, Toggle, ToolTip, Video,
Wizard

## Layer Naming Conventions
Always name Figma layers using this pattern:
  OS/{Component}/{Variant}/{State}
Examples:
  OS/Button/Primary/Default
  OS/Button/Primary/Hover
  OS/Card/Default
  OS/Input/Text/Focused
  OS/Navigation/TopBar/Mobile

## Screen Templates
Available screen template types:
  - Dashboard
  - List (mobile and web)
  - Detail
  - Form
  - Login / Register
  - Empty State
  - Settings

## Platform Flags
Always specify platform when relevant:
  --platform odc       (OutSystems Developer Cloud — modern)
  --platform o11       (OutSystems 11 — classic)

## CSS Export Targets
  --target odc-studio          (for ODC Theme CSS)
  --target service-studio      (for O11 Service Studio theme)

## Key Rules
1. Always use OutSystems UI token names, not raw hex values, when creating variables
2. Mobile frames are 390x844 (iPhone 14 base)
3. Web frames are 1440x900 (desktop) or 768x1024 (tablet)
4. Components should be built with Auto-Layout enabled
5. Dark mode variants should always be created alongside Light mode