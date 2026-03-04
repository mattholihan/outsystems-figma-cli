// outsystems.js
// Custom commands for OutSystems-specific Figma design

const PLATFORMS = {
  odc: { label: 'OutSystems Developer Cloud' },
  o11: { label: 'OutSystems 11' }
};

const SCREEN_SIZES = {
  mobile:  { width: 390,  height: 844  },
  tablet:  { width: 768,  height: 1024 },
  web:     { width: 1440, height: 900  }
};

const SCREEN_TEMPLATES = [
  'Dashboard', 'List', 'Detail', 'Form',
  'Login', 'Register', 'Empty State', 'Settings'
];

const OS_TOKENS = {
  colors: {
    primary:   '#0057D9',
    secondary: '#00A3E0',
    neutral0:  '#FFFFFF',
    neutral900:'#1A1A1A',
    success:   '#28A745',
    warning:   '#FFC107',
    error:     '#DC3545',
    info:      '#17A2B8'
  },
  spacing: { xs: 4, s: 8, m: 16, l: 24, xl: 32, xxl: 48 },
  radius:  { s: 4, m: 8, l: 16, pill: 999 }
};

module.exports = { PLATFORMS, SCREEN_SIZES, SCREEN_TEMPLATES, OS_TOKENS };