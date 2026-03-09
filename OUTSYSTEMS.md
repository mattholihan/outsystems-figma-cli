# OutSystems Figma CLI — Knowledge Base

## What This CLI Does
This CLI controls Figma Desktop to create designs specifically for OutSystems apps.
It understands OutSystems UI patterns, tokens, and component naming conventions.

## OutSystems UI Kit
- Based on OutSystems UI v2.0.0 (Figma Community)
- Uses Figma Variables and Tokens, Auto-Layout, and Component Variants
- Supports both ODC (OutSystems Developer Cloud) and O11 (OutSystems 11)

## Design Token Naming Conventions

Token values (colors, typography, spacing, border, shadow) are project-specific and stored in `tokens.json` in the project directory.

Run `os-figma tokens pull` to sync the latest values from your active Figma file.

Token names follow CSS custom property conventions:
- Colors: `--color-primary`, `--color-neutral-0` through `--color-neutral-10`, `--color-info`, `--color-success`, `--color-warning`, `--color-error` (each with a `-light` variant)
- Typography: `--font-size-*`, `--font-light/regular/semi-bold/bold`, `--line-height-base`
- Spacing: `--space-xs/s/base/m/l/xl/xxl`
- Border: `--border-radius-*`, `--border-size-*`
- Shadow: `--shadow-xs/s/m/l/xl`

## OutSystems UI Pattern Names (for use in commands)
Accordion, Alert, Badge, Blank Slate, Breadcrumbs, Button, Button Group, Card, Card Background, Card Item, Card Sectioned, Carousel, Checkbox, Chat Message, Counter, Date Picker, Dropdown, Dropdown Search, Dropdown Tags, Feedback Message, Flip Content, Floating Actions, Floating Content, Form, Input, Input With Icon, Link, List, List Item Content, Notification, Pagination, Popover, Popup, Progress Bar, Progress Circle, Radio Group, Range Slider, Search, Section, Section Group, SectionIndex, Sidebar, Switch, Table, Tabs, Tag, Text Area, Tooltip, Upload, User Avatar, Wizard

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
Available screen template types (mobile and web):
  - Dashboards
  - Details
  - Forms
  - Galleries
  - Lists
  - Onboardings

## Platform Flags
Always specify platform when relevant:
  --platform odc       (OutSystems Developer Cloud — modern)
  --platform o11       (OutSystems 11 — classic)

## CSS Export Targets
  --target odc-studio          (for ODC Theme CSS)
  --target service-studio      (for O11 Service Studio theme)

## Slots (Flexible Component Content)
Slots are component properties (type: CHILDREN) that create flexible areas within components.
Use slots for card bodies, modal content, list items, and any area where child content varies.

Slot commands:
  os-figma slot create "COMP_ID" "FRAME_ID" "SlotName"
  os-figma slot list "COMP_ID"
  os-figma slot add "INST_ID" "SLOT_FRAME_ID" "CONTENT_ID"
  os-figma slot reset "INST_ID" "SLOT_FRAME_ID"
  os-figma slot clear "INST_ID" "SLOT_FRAME_ID"

Slot naming convention for OutSystems:
  OS/{Component}/Content     — main content slot
  OS/{Component}/Actions     — action buttons slot
  OS/{Component}/Header      — header content slot
  OS/{Component}/Footer      — footer content slot

## Key Rules
1. Always use OutSystems token variable names from tokens.json — never raw hex values
2. Mobile frames are 390x844 (iPhone 14 base)
3. Web frames are 1440x900 (desktop) or 768x1024 (tablet)
4. Components should be built with Auto-Layout enabled
5. Use slots for components with variable child content (cards, modals, lists)