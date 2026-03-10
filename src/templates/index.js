// Screen template layout definitions.
//
// Template structure:
// {
//   topBar?:    { label, h }       — full-bleed top bar (NavBar, placed outside padding)
//   bottomBar?: { label, h }       — full-bleed bottom bar (placed outside padding)
//   sidebar?:   { label, w, rounded? } — left sidebar (web layouts)
//   elements:   [...]              — content elements in vertical auto-layout order
//   gap:        '--space-*'        — spacing between content elements
//   padding:    '--space-*'        — content area padding
// }
//
// Element helpers:
//   ph(layerName, label, h, opts?)        — placeholder frame
//   comp(componentName, variant, label)   — library component (real if available)
//   row(children, gap?)                   — horizontal auto-layout group
//   col(children, opts?)                  — vertical auto-layout group (used inside rows)
//   text(content, opts?)                  — plain text node
//   spacer()                              — flexible space (pushes subsequent items down)
//
// opts for ph: { w?, rounded?: 4|8, align?: 'center' }
// opts for col: { w?, grow?: true, gap? }
// opts for text: { size?, color?, align?, decoration? }

function ph(layerName, label, h, opts = {}) {
  return { kind: 'ph', layerName, label, h, ...opts };
}

function comp(componentName, variant, label) {
  return { kind: 'comp', componentName, variant: variant || null, label: label || null };
}

function row(children, gap = '--space-s') {
  return { kind: 'row', children, gap };
}

function col(children, opts = {}) {
  return { kind: 'col', children, gap: opts.gap || '--space-s', w: opts.w || null, grow: opts.grow || false };
}

function text(content, opts = {}) {
  return { kind: 'text', content, size: opts.size || 14, color: opts.color || '--color-neutral-10',
    align: opts.align || null, decoration: opts.decoration || null };
}

function spacer() {
  return { kind: 'spacer' };
}

// ─────────────── LOGIN ───────────────

const login = {
  mobile: {
    gap: '--space-m',
    padding: '--space-l',
    elements: [
      spacer(),
      ph('Brand/Logo', 'Logo', 80, { w: 80, align: 'center', rounded: 8 }),
      comp('Input',  null,       'Email'),
      comp('Input',  null,       'Password'),
      comp('Button', 'Primary',  'Sign In'),
      text('Forgot password?', { size: 14, color: '--color-primary', align: 'center', decoration: 'underline' }),
      ph('Divider/Default', '', 2),
      comp('Button', 'Secondary', 'Sign in with SSO'),
      spacer(),
    ],
  },

  web: {
    sidebar: { label: 'Brand / Illustration', w: 720, rounded: 0 },
    gap: '--space-l',
    padding: '--space-xxl',
    elements: [
      spacer(),
      comp('Input',  null,       'Email'),
      comp('Input',  null,       'Password'),
      comp('Button', 'Primary',  'Sign In'),
      text('Forgot password?', { size: 14, color: '--color-primary', align: 'center', decoration: 'underline' }),
      ph('Divider/Default', '', 2),
      comp('Button', 'Secondary', 'Sign in with SSO'),
      spacer(),
    ],
  },
};

// ─────────────── LIST ────────────────

const list = {
  mobile: {
    topBar:    { label: 'Navigation / Top Bar',    h: 56 },
    bottomBar: { label: 'Navigation / Bottom Bar', h: 56 },
    gap: '--space-s',
    padding: '--space-l',
    elements: [
      comp('Search', null, null),
      ph('Card/Item', 'Card Item', 72, { rounded: 8 }),
      ph('Card/Item', 'Card Item', 72, { rounded: 8 }),
      ph('Card/Item', 'Card Item', 72, { rounded: 8 }),
      ph('Card/Item', 'Card Item', 72, { rounded: 8 }),
    ],
  },

  web: {
    topBar: { label: 'Navigation / Top Bar', h: 56 },
    gap: '--space-m',
    padding: '--space-xl',
    elements: [
      row([
        comp('Button', 'Primary',   '+ Add'),
        comp('Button', 'Secondary', 'Filter'),
        spacer(),
        comp('Search', null, null),
      ], '--space-s'),
      ph('Table/Default',      'Table',      540, { rounded: 8 }),
      ph('Pagination/Default', 'Pagination',  40, { rounded: 4 }),
    ],
  },
};

// ─────────────── FORM ────────────────

const form = {
  mobile: {
    topBar: { label: 'Navigation / Top Bar', h: 56 },
    gap: '--space-m',
    padding: '--space-l',
    elements: [
      comp('Input',      null,      'Name'),
      comp('Input',      null,      'Description'),
      comp('Dropdown',   null,      'Category'),
      comp('Date Picker', null,     'Due Date'),
      comp('Checkbox',   null,      'Mark as urgent'),
      spacer(),
      comp('Button', 'Primary', 'Save'),
    ],
  },

  web: {
    topBar: { label: 'Navigation / Top Bar', h: 56 },
    gap: '--space-m',
    padding: '--space-xl',
    elements: [
      comp('Input',      null,      'Name'),
      comp('Input',      null,      'Description'),
      comp('Dropdown',   null,      'Category'),
      comp('Date Picker', null,     'Due Date'),
      comp('Checkbox',   null,      'Mark as urgent'),
      spacer(),
      row([
        spacer(),
        comp('Button', 'Secondary', 'Cancel'),
        comp('Button', 'Primary',   'Save'),
      ], '--space-s'),
    ],
  },
};

// ─────────────── DETAIL ──────────────

const detail = {
  mobile: {
    topBar: { label: 'Navigation / Top Bar', h: 56 },
    gap: '--space-m',
    padding: '--space-l',
    elements: [
      ph('Media/Hero', 'Hero Image', 200, { rounded: 8 }),
      row([
        ph('Text/Body', 'Title', 36, { rounded: 4, grow: true }),
        comp('Tag', null, 'Status'),
      ], '--space-s'),
      ph('Text/Body', 'Body text', 64, { rounded: 4 }),
      ph('Divider/Default', '', 2),
      ph('List/Item', 'Detail row', 52, { rounded: 4 }),
      ph('List/Item', 'Detail row', 52, { rounded: 4 }),
      ph('List/Item', 'Detail row', 52, { rounded: 4 }),
      ph('List/Item', 'Detail row', 52, { rounded: 4 }),
      spacer(),
      comp('Button', 'Primary', 'Primary Action'),
    ],
  },

  web: {
    topBar: { label: 'Navigation / Top Bar', h: 56 },
    gap: '--space-xl',
    padding: '--space-xl',
    elements: [
      row([
        col([
          ph('Media/Hero', 'Hero Image', 280, { rounded: 8 }),
          ph('Text/Body',  'Title + description', 80, { rounded: 4 }),
          ph('Divider/Default', '', 2),
          ph('List/Item', 'Detail row', 52, { rounded: 4 }),
          ph('List/Item', 'Detail row', 52, { rounded: 4 }),
          ph('List/Item', 'Detail row', 52, { rounded: 4 }),
        ], { grow: true, gap: '--space-m' }),
        col([
          comp('Button', 'Primary',   'Primary Action'),
          comp('Button', 'Secondary', 'Secondary Action'),
          comp('Tag',    null,        'Status'),
          ph('Card/Action', 'Action Panel', 200, { rounded: 8 }),
        ], { w: 400, gap: '--space-s' }),
      ], '--space-xl'),
    ],
  },
};

// ─────────────── DASHBOARD ───────────

const dashboard = {
  mobile: {
    topBar:    { label: 'Navigation / Top Bar',    h: 56 },
    bottomBar: { label: 'Navigation / Bottom Bar', h: 56 },
    gap: '--space-m',
    padding: '--space-l',
    elements: [
      row([
        ph('Counter/Default', 'Stat counter', 88, { rounded: 8, grow: true }),
        ph('Counter/Default', 'Stat counter', 88, { rounded: 8, grow: true }),
      ], '--space-m'),
      ph('Text/SectionHeading', 'Recent Activity', 28, { rounded: 4 }),
      ph('Card/Item', 'Card Item', 72, { rounded: 8 }),
      ph('Card/Item', 'Card Item', 72, { rounded: 8 }),
      ph('Card/Item', 'Card Item', 72, { rounded: 8 }),
    ],
  },

  web: {
    topBar:  { label: 'Navigation / Top Bar', h: 56 },
    sidebar: { label: 'Sidebar', w: 240, rounded: 0 },
    gap: '--space-l',
    padding: '--space-xl',
    elements: [
      row([
        ph('Counter/Default', 'Stat counter', 108, { rounded: 8, grow: true }),
        ph('Counter/Default', 'Stat counter', 108, { rounded: 8, grow: true }),
        ph('Counter/Default', 'Stat counter', 108, { rounded: 8, grow: true }),
        ph('Counter/Default', 'Stat counter', 108, { rounded: 8, grow: true }),
      ], '--space-m'),
      row([
        ph('Chart/Default', 'Chart', 400, { rounded: 8, grow: true }),
        col([
          ph('Card/Item', 'Card Item', 80, { rounded: 8 }),
          ph('Card/Item', 'Card Item', 80, { rounded: 8 }),
          ph('Card/Item', 'Card Item', 80, { rounded: 8 }),
          ph('Card/Item', 'Card Item', 80, { rounded: 8 }),
        ], { w: 380, gap: '--space-s' }),
      ], '--space-l'),
    ],
  },
};

// ─────────────── exports ─────────────

export const TEMPLATES = { login, list, form, detail, dashboard };

export const VALID_TEMPLATES = Object.keys(TEMPLATES);
