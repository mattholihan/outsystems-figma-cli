# OutSystems Figma CLI — Knowledge Base

## What This CLI Does
This CLI controls Figma Desktop to create designs specifically for OutSystems apps.
It understands OutSystems UI patterns, tokens, and component naming conventions.

## OutSystems UI Kit
- Based on OutSystems UI v2.0.0 (Figma Community)
- Uses Figma Variables and Tokens, Auto-Layout, and Component Variants
- Supports both ODC (OutSystems Developer Cloud) and O11 (OutSystems 11)

## Design Token Naming Conventions
Color:
  --color-primary         (main brand color)
  --color-secondary       (secondary brand color)
  --color-neutral-0       (white)
  --color-neutral-1     (lightest gray) through --color-neutral-10 (darkest)
  --color-info / info-light/ success / success-light / -warning / warning-light / -error / -error-light

Typography:
  --font-size-xs / -s / -base (16px default)
  --font-size-h1 through --font-size-h6
  --font-light / -regular / -semi-bold / -bold
  --line-height-base

Border:
  --border-radius-soft / -rounded / -circle
  --border-size- s / -m / -l

Spacing:
  --space-xs / -s / -base / -m / -l / -xl / -xxl

Shadow:
  --shadow-xs / -s / -m / -l / -xl

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

## Key Rules
1. Always use OutSystems UI token names, not raw hex values, when creating variables
2. Mobile frames are 390x844 (iPhone 14 base)
3. Web frames are 1440x900 (desktop) or 768x1024 (tablet)
4. Components should be built with Auto-Layout enabled