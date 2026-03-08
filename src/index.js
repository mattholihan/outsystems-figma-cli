#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execSync, spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInterface } from 'readline';
import { homedir, platform } from 'os';
import { createServer } from 'http';
import { FigJamClient } from './figjam-client.js';
import { FigmaClient } from './figma-client.js';
import { isPatched, patchFigma, unpatchFigma, getFigmaCommand, getCdpPort } from './figma-patch.js';

// Daemon configuration
const DAEMON_PORT = 3456;
const DAEMON_PID_FILE = join(homedir(), '.outsystems-figma-cli-daemon.pid');
const DAEMON_TOKEN_FILE = join(homedir(), '.outsystems-figma-cli', '.daemon-token');

// Generate and save a new session token for daemon authentication
function generateDaemonToken() {
  const configDir = join(homedir(), '.outsystems-figma-cli');
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
  const token = randomBytes(32).toString('hex');
  writeFileSync(DAEMON_TOKEN_FILE, token, { mode: 0o600 });
  return token;
}

// Read the current daemon session token
function getDaemonToken() {
  try {
    return readFileSync(DAEMON_TOKEN_FILE, 'utf8').trim();
  } catch {
    return null;
  }
}

// Check if daemon is running
function isDaemonRunning() {
  try {
    const token = getDaemonToken();
    const tokenHeader = token ? ` -H "X-Daemon-Token: ${token}"` : '';
    const response = execSync(`curl -s -o /dev/null -w "%{http_code}"${tokenHeader} http://localhost:${DAEMON_PORT}/health`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 1000
    });
    return response.trim() === '200';
  } catch {
    return false;
  }
}

// Send command to daemon (uses native fetch in Node 18+)
async function daemonExec(action, data = {}) {
  const token = getDaemonToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['X-Daemon-Token'] = token;

  const response = await fetch(`http://localhost:${DAEMON_PORT}/exec`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...data }),
    signal: AbortSignal.timeout(60000)
  });

  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result.result;
}

// Fast eval via daemon (falls back to direct connection)
async function fastEval(code) {
  // Try daemon first
  if (isDaemonRunning()) {
    try {
      return await daemonExec('eval', { code });
    } catch (e) {
      // Continue to fallback
    }
  }

  // Fall back to direct connection
  const client = await getFigmaClient();
  return await client.eval(code);
}

// Fast render via daemon (falls back to direct connection)
async function fastRender(jsx) {
  // Try daemon first
  if (isDaemonRunning()) {
    try {
      return await daemonExec('render', { jsx });
    } catch (e) {
      // Continue to fallback
    }
  }

  // Fall back to direct connection
  const client = await getFigmaClient();
  return await client.render(jsx);
}

// Helper: run figma-use commands with Node 20+ compatibility warning
function runFigmaUse(cmd, options = {}) {
  try {
    execSync(cmd, { stdio: options.stdio || 'inherit', timeout: options.timeout || 60000 });
  } catch (error) {
    if (error.message?.includes('enableCompileCache')) {
      console.log(chalk.red('\n✗ figma-use is broken on Node.js ' + process.version));
      console.log(chalk.yellow('  This is a known upstream bug (enableCompileCache not available in ESM).'));
      console.log(chalk.gray('  Workaround: use Node.js 18.x, or wait for a figma-use update.\n'));
    } else {
      throw error;
    }
  }
}

// Start daemon in background
function startDaemon(forceRestart = false, mode = 'auto') {
  // If force restart, always kill existing daemon first
  if (forceRestart) {
    stopDaemon();
    // Wait for port to be released
    try { execSync('sleep 0.3', { stdio: 'pipe' }); } catch {}
  } else if (isDaemonRunning()) {
    return true; // Already running
  }

  // Generate session token before spawning daemon
  generateDaemonToken();

  const daemonScript = join(dirname(fileURLToPath(import.meta.url)), 'daemon.js');
  const child = spawn('node', [daemonScript], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, DAEMON_PORT: String(DAEMON_PORT), DAEMON_MODE: mode }
  });
  child.unref();

  // Save PID
  writeFileSync(DAEMON_PID_FILE, String(child.pid));
  return true;
}

// Stop daemon
function stopDaemon() {
  try {
    if (existsSync(DAEMON_PID_FILE)) {
      const pid = readFileSync(DAEMON_PID_FILE, 'utf8').trim();
      try {
        process.kill(parseInt(pid), 'SIGTERM');
      } catch {}
      unlinkSync(DAEMON_PID_FILE);
    }
    // Also try to kill by port
    if (IS_MAC || IS_LINUX) {
      execSync(`lsof -ti:${DAEMON_PORT} | xargs kill -9 2>/dev/null || true`, { stdio: 'pipe' });
    }
  } catch {}
}

// Platform detection
const IS_WINDOWS = platform() === 'win32';
const IS_MAC = platform() === 'darwin';
const IS_LINUX = platform() === 'linux';

// Platform-specific Figma paths and commands
function getFigmaPath() {
  if (IS_MAC) {
    return '/Applications/Figma.app/Contents/MacOS/Figma';
  } else if (IS_WINDOWS) {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    return join(localAppData, 'Figma', 'Figma.exe');
  } else {
    // Linux
    return '/usr/bin/figma';
  }
}

function startFigma() {
  const port = getCdpPort(); // Fixed port 9222 for figma-use compatibility
  const figmaPath = getFigmaPath();
  if (IS_MAC) {
    execSync(`open -a Figma --args --remote-debugging-port=${port}`, { stdio: 'pipe' });
  } else if (IS_WINDOWS) {
    spawn(figmaPath, [`--remote-debugging-port=${port}`], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn(figmaPath, [`--remote-debugging-port=${port}`], { detached: true, stdio: 'ignore' }).unref();
  }
}

function killFigma() {
  try {
    if (IS_MAC) {
      execSync('pkill -x Figma 2>/dev/null || true', { stdio: 'pipe' });
    } else if (IS_WINDOWS) {
      execSync('taskkill /IM Figma.exe /F 2>nul', { stdio: 'pipe' });
    } else {
      execSync('pkill -x figma 2>/dev/null || true', { stdio: 'pipe' });
    }
  } catch (e) {
    // Ignore errors if Figma wasn't running
  }
}

function getManualStartCommand() {
  const port = getCdpPort();
  if (IS_MAC) {
    return `open -a Figma --args --remote-debugging-port=${port}`;
  } else if (IS_WINDOWS) {
    return `"%LOCALAPPDATA%\\Figma\\Figma.exe" --remote-debugging-port=${port}`;
  } else {
    return `figma --remote-debugging-port=${port}`;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const CONFIG_DIR = join(homedir(), '.outsystems-figma-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const program = new Command();

// Helper: Prompt user
function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

// Helper: Load config
function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

// Helper: Save config
function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Singleton FigmaClient instance
let _figmaClient = null;

// Helper: Get or create FigmaClient
async function getFigmaClient() {
  if (!_figmaClient) {
    _figmaClient = new FigmaClient();
    await _figmaClient.connect();
  }
  return _figmaClient;
}

// Helper: Run code in Figma (replaces figma-use eval)
async function figmaEval(code) {
  const client = await getFigmaClient();
  return await client.eval(code);
}

// Sync wrapper for figmaEval - uses daemon via curl (fast) or fallback to direct connection
function figmaEvalSync(code) {
  // Try daemon first (fast path)
  const daemonRunning = isDaemonRunning();
  if (daemonRunning) {
    try {
      // Wrap code to ensure return value for plugin mode
      // CDP returns last expression automatically, plugin needs explicit return
      let wrappedCode = code.trim();
      // Don't wrap if already an IIFE or starts with return - plugin handles these
      // For simple expressions and multi-statement code, just pass through
      // The plugin will add return to the last statement
      const payload = JSON.stringify({ action: 'eval', code: wrappedCode });
      const payloadFile = `/tmp/figma-payload-${Date.now()}.json`;
      writeFileSync(payloadFile, payload);
      const daemonToken = getDaemonToken();
      const tokenHeader = daemonToken ? ` -H "X-Daemon-Token: ${daemonToken}"` : '';
      const result = execSync(
        `curl -s -X POST http://127.0.0.1:${DAEMON_PORT}/exec -H "Content-Type: application/json"${tokenHeader} -d @${payloadFile}`,
        { encoding: 'utf8', timeout: 60000 }
      );
      try { unlinkSync(payloadFile); } catch {}
      if (!result || result.trim() === '') {
        throw new Error('Empty response from daemon');
      }
      const data = JSON.parse(result);
      if (data.error) throw new Error(data.error);
      return data.result;
    } catch (e) {
      // Check if we're in Safe Mode (plugin only) - don't fall through to CDP
      try {
        const healthToken = getDaemonToken();
        const healthHeader = healthToken ? ` -H "X-Daemon-Token: ${healthToken}"` : '';
        const healthRes = execSync(`curl -s${healthHeader} http://127.0.0.1:${DAEMON_PORT}/health`, { encoding: 'utf8', timeout: 2000 });
        const health = JSON.parse(healthRes);
        if (health.plugin && !health.cdp) {
          // Safe Mode - re-throw the error, don't try CDP fallback
          throw e;
        }
      } catch {}
      // Fall through to direct CDP connection
    }
  }

  // Fallback: direct connection via temp script
  const tempFile = join('/tmp', `figma-eval-${Date.now()}.mjs`);
  const resultFile = join('/tmp', `figma-result-${Date.now()}.json`);

  const script = `
    import { FigmaClient } from '${join(process.cwd(), 'src/figma-client.js').replace(/\\/g, '/')}';
    import { writeFileSync } from 'fs';

    (async () => {
      try {
        const client = new FigmaClient();
        await client.connect();
        const result = await client.eval(${JSON.stringify(code)});
        writeFileSync('${resultFile}', JSON.stringify({ success: true, result }));
        client.close();
      } catch (e) {
        writeFileSync('${resultFile}', JSON.stringify({ success: false, error: e.message }));
      }
    })();
  `;

  writeFileSync(tempFile, script);
  try {
    execSync(`node ${tempFile}`, { stdio: 'pipe', timeout: 60000 });
    if (existsSync(resultFile)) {
      const data = JSON.parse(readFileSync(resultFile, 'utf8'));
      try { execSync(`rm -f ${tempFile} ${resultFile}`, { stdio: 'pipe' }); } catch {}
      if (data.success) return data.result;
      throw new Error(data.error);
    }
  } catch (e) {
    try { execSync(`rm -f ${tempFile} ${resultFile}`, { stdio: 'pipe' }); } catch {}
    throw e;
  }
  return null;
}

// Compatibility wrapper for old figmaUse calls
function figmaUse(args, options = {}) {
  // Parse eval command
  const evalMatch = args.match(/^eval\s+"(.+)"$/s) || args.match(/^eval\s+'(.+)'$/s);

  if (evalMatch) {
    // Only unescape quotes, NOT \n (which would break string literals like .join('\n'))
    const code = evalMatch[1].replace(/\\"/g, '"');
    try {
      const result = figmaEvalSync(code);
      if (!options.silent && result !== undefined) {
        console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
      }
      return typeof result === 'object' ? JSON.stringify(result) : String(result || '');
    } catch (error) {
      if (options.silent) return null;
      throw error;
    }
  }

  if (args === 'status' || args.startsWith('status')) {
    try {
      const port = getCdpPort();
      const result = execSync(`curl -s http://localhost:${port}/json`, { encoding: 'utf8', stdio: 'pipe' });
      const pages = JSON.parse(result);
      const figmaPage = pages.find(p => p.url?.includes('figma.com/design') || p.url?.includes('figma.com/file'));
      if (figmaPage) {
        const status = `Connected to Figma\n  File: ${figmaPage.title.replace(' – Figma', '')}`;
        if (!options.silent) console.log(status);
        return status;
      }
      return 'Not connected';
    } catch {
      return 'Not connected';
    }
  }

  if (args === 'variable list') {
    const result = figmaEvalSync(`(async () => {
      const vars = await figma.variables.getLocalVariablesAsync();
      return vars.map(v => v.name + ' (' + v.resolvedType + ')').join('\\n');
    })()`);
    if (!options.silent) console.log(result);
    return result;
  }

  if (args === 'collection list') {
    const result = figmaEvalSync(`(async () => {
      const cols = await figma.variables.getLocalVariableCollectionsAsync();
      return cols.map(c => c.name + ' (' + c.variableIds.length + ' vars)').join('\\n');
    })()`);
    if (!options.silent) console.log(result);
    return result;
  }

  if (args.startsWith('collection create ')) {
    const name = args.replace('collection create ', '').replace(/"/g, '');
    const result = figmaEvalSync(`
      const col = figma.variables.createVariableCollection('${name}');
      col.id
    `);
    if (!options.silent) console.log(chalk.green('✓ Created collection: ' + name));
    return result;
  }

  if (args.startsWith('variable find ')) {
    const pattern = args.replace('variable find ', '').replace(/"/g, '');
    const result = figmaEvalSync(`(async () => {
      const pattern = '${pattern}'.replace('*', '.*');
      const re = new RegExp(pattern, 'i');
      const vars = await figma.variables.getLocalVariablesAsync();
      return vars.filter(v => re.test(v.name)).map(v => v.name).join('\\n');
    })()`);
    if (!options.silent) console.log(result);
    return result;
  }

  if (args.startsWith('select ')) {
    const nodeId = args.replace('select ', '').replace(/"/g, '');
    figmaEvalSync(`(async () => {
      const node = await figma.getNodeByIdAsync('${nodeId}');
      if (node) figma.currentPage.selection = [node];
    })()`);
    return 'Selected';
  }

  // Fallback warning
  if (!options.silent) {
    console.log(chalk.yellow('Command not fully supported: ' + args));
  }
  return null;
}

// Helper: Check connection
async function checkConnection() {
  // First check daemon (works for both CDP and Plugin modes)
  try {
    const connToken = getDaemonToken();
    const connHeader = connToken ? ` -H "X-Daemon-Token: ${connToken}"` : '';
    const health = execSync(`curl -s${connHeader} http://127.0.0.1:${DAEMON_PORT}/health`, { encoding: 'utf8', timeout: 2000 });
    const data = JSON.parse(health);
    if (data.status === 'ok' && (data.plugin || data.cdp)) {
      return true;
    }
  } catch {}

  // Fallback: check CDP directly
  const connected = await FigmaClient.isConnected();
  if (!connected) {
    console.log(chalk.red('\n✗ Not connected to Figma\n'));
    console.log(chalk.white('  Make sure Figma is running:'));
    console.log(chalk.cyan('  outsystems-figma-cli connect') + chalk.gray(' (Yolo Mode)'));
    console.log(chalk.cyan('  outsystems-figma-cli connect --safe') + chalk.gray(' (Safe Mode)\n'));
    process.exit(1);
  }
  return true;
}

// Helper: Check connection (sync version for backwards compat)
function checkConnectionSync() {
  // First check daemon (works for both CDP and Plugin modes)
  try {
    const syncToken = getDaemonToken();
    const syncHeader = syncToken ? ` -H "X-Daemon-Token: ${syncToken}"` : '';
    const health = execSync(`curl -s${syncHeader} http://127.0.0.1:${DAEMON_PORT}/health`, { encoding: 'utf8', timeout: 2000 });
    const data = JSON.parse(health);
    if (data.status === 'ok' && (data.plugin || data.cdp)) {
      return true;
    }
  } catch {}

  // Fallback: check CDP directly
  try {
    const port = getCdpPort();
    execSync(`curl -s http://localhost:${port}/json > /dev/null`, { stdio: 'pipe', timeout: 2000 });
    return true;
  } catch {
    console.log(chalk.red('\n✗ Not connected to Figma\n'));
    console.log(chalk.white('  Make sure Figma is running:'));
    console.log(chalk.cyan('  outsystems-figma-cli connect') + chalk.gray(' (Yolo Mode)'));
    console.log(chalk.cyan('  outsystems-figma-cli connect --safe') + chalk.gray(' (Safe Mode)\n'));
    process.exit(1);
  }
}

// Helper: Check if Figma is patched
function isFigmaPatched() {
  const config = loadConfig();
  return config.patched === true;
}

// Helper: Hex to Figma RGB (handles both #RGB and #RRGGBB)
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Expand 3-char hex to 6-char
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: #${hex}`);
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  };
}

// Helper: Check if value is a variable reference (var:name)
function isVarRef(value) {
  return typeof value === 'string' && value.startsWith('var:');
}

// Helper: Extract variable name from var:name syntax
function getVarName(value) {
  return value.slice(4);
}

// Helper: Generate fill code (hex or variable binding)
function generateFillCode(color, nodeVar = 'node', property = 'fills') {
  if (isVarRef(color)) {
    const varName = getVarName(color);
    return {
      code: `${nodeVar}.${property} = [boundFill(vars['${varName}'])];`,
      usesVars: true
    };
  }
  const { r, g, b } = hexToRgb(color);
  return {
    code: `${nodeVar}.${property} = [{ type: 'SOLID', color: { r: ${r}, g: ${g}, b: ${b} } }];`,
    usesVars: false
  };
}

// Helper: Generate stroke code (hex or variable binding)
function generateStrokeCode(color, nodeVar = 'node', weight = 1) {
  if (isVarRef(color)) {
    const varName = getVarName(color);
    return {
      code: `${nodeVar}.strokes = [boundFill(vars['${varName}'])]; ${nodeVar}.strokeWeight = ${weight};`,
      usesVars: true
    };
  }
  const { r, g, b } = hexToRgb(color);
  return {
    code: `${nodeVar}.strokes = [{ type: 'SOLID', color: { r: ${r}, g: ${g}, b: ${b} } }]; ${nodeVar}.strokeWeight = ${weight};`,
    usesVars: false
  };
}

// Helper: Variable loading code for all collections
function varLoadingCode() {
  return `
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const vars = {};
// Load variables from all collections
for (const col of collections) {
  for (const id of col.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (v) vars[v.name] = v;
  }
}
const boundFill = (variable) => figma.variables.setBoundVariableForPaint(
  { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }, 'color', variable
);
`;
}

// Helper: Smart positioning code (returns JS to get next free X position)
function smartPosCode(gap = 100) {
  return `
const children = figma.currentPage.children;
let smartX = 0;
if (children.length > 0) {
  children.forEach(n => { smartX = Math.max(smartX, n.x + n.width); });
  smartX += ${gap};
}
`;
}

program
  .name('os-figma')
  .description('CLI for managing Figma design systems')
  .version(pkg.version);

// Default action when no command is given
program.action(async () => {
  const config = loadConfig();

  // First time? Run init
  if (!config.patched) {
    showBanner();
    console.log(chalk.white('  Welcome! Let\'s get you set up.\n'));
    console.log(chalk.gray('  This takes about 30 seconds. No API key needed.\n'));

    // Step 1: Check Node version
    console.log(chalk.blue('Step 1/3: ') + 'Checking Node.js...');
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (nodeMajor < 18) {
      console.log(chalk.red(`  ✗ Node.js ${nodeVersion} is too old. Please upgrade to Node 18+`));
      process.exit(1);
    }
    console.log(chalk.green(`  ✓ Node.js ${nodeVersion}`));

    // Step 2: Patch Figma
    console.log(chalk.blue('\nStep 2/3: ') + 'Patching Figma Desktop...');
    if (config.patched) {
      console.log(chalk.green('  ✓ Figma already patched'));
    } else {
      console.log(chalk.gray('  (This allows CLI to connect to Figma)'));
      const spinner = ora('  Patching...').start();
      try {
        const patchStatus = isPatched();
        if (patchStatus === true) {
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma already patched');
        } else if (patchStatus === false) {
          patchFigma();
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma patched');
        } else {
          // Can't determine - assume it's fine (old Figma version)
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma ready (no patch needed)');
        }
      } catch (error) {
        spinner.fail('Patch failed: ' + error.message);
        if ((error.message.includes('EPERM') || error.message.includes('permission') || error.message.includes('Full Disk Access')) && process.platform === 'darwin') {
          console.log(chalk.yellow('\n  ⚠️  Your Terminal needs "Full Disk Access" permission.\n'));
          console.log(chalk.gray('  1. Open System Settings → Privacy & Security → Full Disk Access'));
          console.log(chalk.gray('  2. Click + and add your Terminal app'));
          console.log(chalk.gray('  3. Quit Terminal completely (Cmd+Q)'));
          console.log(chalk.gray('  4. Reopen Terminal and try again\n'));
        } else if (error.message.includes('EPERM') || error.message.includes('permission')) {
          console.log(chalk.yellow('\n  Try running as administrator.\n'));
        }
      }
    }

    // Step 3: Start Figma
    console.log(chalk.blue('\nStep 3/3: ') + 'Starting Figma...');
    try {
      killFigma();
      await new Promise(r => setTimeout(r, 1000));
      startFigma();
      console.log(chalk.green('  ✓ Figma started'));

      // Wait for connection
      const spinner = ora('  Waiting for connection...').start();
      let connected = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        connected = await FigmaClient.isConnected();
        if (connected) break;
      }

      if (connected) {
        spinner.succeed('Connected to Figma');
      } else {
        spinner.warn('Connection pending - open a file in Figma');
      }
    } catch (error) {
      console.log(chalk.yellow('  ! Could not start Figma automatically'));
      console.log(chalk.gray('    Start manually: ' + getManualStartCommand()));
    }

    // Done!
    console.log(chalk.green('\n  ✓ Setup complete!\n'));
    showQuickStart();
    return;
  }

  // Already set up - check connection and show status
  showBanner();

  const connected = await FigmaClient.isConnected();
  if (connected) {
    console.log(chalk.green('  ✓ Connected to Figma\n'));
    try {
      const client = new FigmaClient();
      await client.connect();
      const info = await client.getPageInfo();
      console.log(chalk.gray(`  File: ${client.pageTitle.replace(' – Figma', '')}`));
      console.log(chalk.gray(`  Page: ${info.name}`));
      client.close();
    } catch {}
    console.log();
    showQuickStart();
  } else {
    console.log(chalk.yellow('  ⚠ Figma not connected\n'));
    console.log(chalk.white('  Starting Figma...'));
    try {
      killFigma();
      await new Promise(r => setTimeout(r, 500));
      startFigma();
      console.log(chalk.green('  ✓ Figma started\n'));

      const spinner = ora('  Waiting for connection...').start();
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 1000));
        if (await FigmaClient.isConnected()) {
          spinner.succeed('Connected to Figma\n');
          showQuickStart();
          return;
        }
      }
      spinner.warn('Open a file in Figma to connect\n');
      showQuickStart();
    } catch {
      console.log(chalk.gray('  Start manually: ' + getManualStartCommand() + '\n'));
    }
  }
});

function showQuickStart() {
  console.log(chalk.white('  Just ask Claude:\n'));
  console.log(chalk.white('    "Add OutSystems tokens to my project"'));
  console.log(chalk.white('    "Create a blue card with rounded corners"'));
  console.log(chalk.white('    "Show me what\'s on the canvas"'));
  console.log(chalk.white('    "Export this frame as PNG"'));
  console.log();
}

// ============ WELCOME BANNER ============

function showBanner() {
  console.log(chalk.cyan(`
 ██████╗ ███████╗      ███████╗██╗ ██████╗ ███╗   ███╗ █████╗        ██████╗██╗     ██╗
██╔═══██╗██╔════╝      ██╔════╝██║██╔════╝ ████╗ ████║██╔══██╗      ██╔════╝██║     ██║
██║   ██║███████╗█████╗█████╗  ██║██║  ███╗██╔████╔██║███████║█████╗██║     ██║     ██║
██║   ██║╚════██║╚════╝██╔══╝  ██║██║   ██║██║╚██╔╝██║██╔══██║╚════╝██║     ██║     ██║
╚██████╔╝███████║      ██║     ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║      ╚██████╗███████╗██║
 ╚═════╝ ╚══════╝      ╚═╝     ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝       ╚═════╝╚══════╝╚═╝
`));
  console.log(chalk.white(`  OutSystems Figma CLI ${chalk.gray('v' + pkg.version)}`));
  console.log(chalk.gray(`  OutSystems app design tools for Figma\n`));
}

// ============ INIT (Interactive Onboarding) ============

program
  .command('init')
  .description('Interactive setup wizard')
  .action(async () => {
    showBanner();

    console.log(chalk.white('  Welcome! Let\'s get you set up.\n'));
    console.log(chalk.gray('  This takes about 30 seconds. No API key needed.\n'));

    // Step 1: Check Node version
    console.log(chalk.blue('Step 1/4: ') + 'Checking Node.js...');
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (nodeMajor < 18) {
      console.log(chalk.red(`  ✗ Node.js ${nodeVersion} is too old. Please upgrade to Node 18+`));
      process.exit(1);
    }
    console.log(chalk.green(`  ✓ Node.js ${nodeVersion}`));

    // Step 2: Patch Figma
    console.log(chalk.blue('\nStep 2/3: ') + 'Patching Figma Desktop...');
    const config = loadConfig();
    if (config.patched) {
      console.log(chalk.green('  ✓ Figma already patched'));
    } else {
      console.log(chalk.gray('  (This allows CLI to connect to Figma)'));
      const spinner = ora('  Patching...').start();
      try {
        const patchStatus = isPatched();
        if (patchStatus === true) {
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma already patched');
        } else if (patchStatus === false) {
          patchFigma();
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma patched');
        } else {
          config.patched = true;
          saveConfig(config);
          spinner.succeed('Figma ready (no patch needed)');
        }
      } catch (error) {
        spinner.fail('Patch failed: ' + error.message);
        if ((error.message.includes('EPERM') || error.message.includes('permission') || error.message.includes('Full Disk Access')) && process.platform === 'darwin') {
          console.log(chalk.yellow('\n  ⚠️  Your Terminal needs "Full Disk Access" permission.\n'));
          console.log(chalk.gray('  1. Open System Settings → Privacy & Security → Full Disk Access'));
          console.log(chalk.gray('  2. Click + and add your Terminal app'));
          console.log(chalk.gray('  3. Quit Terminal completely (Cmd+Q)'));
          console.log(chalk.gray('  4. Reopen Terminal and try again\n'));
        } else if (error.message.includes('EPERM') || error.message.includes('permission')) {
          console.log(chalk.yellow('\n  Try running as administrator.\n'));
        }
      }
    }

    // Step 3: Start Figma
    console.log(chalk.blue('\nStep 3/3: ') + 'Starting Figma...');
    try {
      killFigma();
      await new Promise(r => setTimeout(r, 1000));
      startFigma();
      console.log(chalk.green('  ✓ Figma started'));

      // Wait for connection
      const spinner = ora('  Waiting for connection...').start();
      let connected = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        connected = await FigmaClient.isConnected();
        if (connected) break;
      }

      if (connected) {
        spinner.succeed('Connected to Figma');
      } else {
        spinner.warn('Connection pending - open a file in Figma');
      }
    } catch (error) {
      console.log(chalk.yellow('  ! Could not start Figma automatically'));
      console.log(chalk.gray('    Start manually: ' + getManualStartCommand()));
    }

    // Done!
    console.log(chalk.green('\n  ✓ Setup complete!\n'));

    console.log(chalk.white('  Just ask Claude:\n'));
    console.log(chalk.white('    "Add OutSystems tokens to my project"'));
    console.log(chalk.white('    "Create a blue card with rounded corners"'));
    console.log(chalk.white('    "Show me what\'s on the canvas"'));
    console.log(chalk.white('    "Export this frame as PNG"'));
    console.log();
  });

// ============ SETUP (alias for init) ============

program
  .command('setup')
  .description('Setup Figma for CLI access (alias for init)')
  .action(() => {
    // Redirect to init
    execSync('outsystems-figma-cli init', { stdio: 'inherit' });
  });

// ============ STATUS ============

program
  .command('status')
  .description('Check connection to Figma')
  .action(() => {
    // Check if first run
    const config = loadConfig();
    if (!config.patched && !checkDependencies(true)) {
      console.log(chalk.yellow('\n⚠ First time? Run the setup wizard:\n'));
      console.log(chalk.cyan('  outsystems-figma-cli init\n'));
      return;
    }
    figmaUse('status');
  });

// ============ UNPATCH ============

program
  .command('unpatch')
  .description('Restore Figma to original state (removes remote debugging patch)')
  .action(() => {
    const spinner = ora('Checking Figma patch status...').start();

    try {
      const patchStatus = isPatched();

      if (patchStatus === false) {
        spinner.succeed('Figma is already in original state (not patched)');
        return;
      }

      if (patchStatus === null) {
        spinner.warn('Cannot determine patch status. Figma version may be incompatible.');
        return;
      }

      spinner.text = 'Restoring Figma to original state...';
      unpatchFigma();

      // Update config
      const config = loadConfig();
      config.patched = false;
      saveConfig(config);

      spinner.succeed('Figma restored to original state');
      console.log(chalk.gray('  Remote debugging is now blocked by default.'));
      console.log(chalk.gray('  Run "node src/index.js connect" to re-enable it.'));
    } catch (err) {
      spinner.fail(`Failed to unpatch: ${err.message}`);
    }
  });

// ============ CONNECT ============

program
  .command('connect')
  .description('Connect to Figma Desktop')
  .option('--safe', 'Use Safe Mode (plugin-based, no patching required)')
  .action(async (options) => {
    // Fun welcome message
    console.log(chalk.cyan(`
     ██████╗ ███████╗      ███████╗██╗ ██████╗ ███╗   ███╗ █████╗        ██████╗██╗     ██╗
    ██╔═══██╗██╔════╝      ██╔════╝██║██╔════╝ ████╗ ████║██╔══██╗      ██╔════╝██║     ██║
    ██║   ██║███████╗█████╗█████╗  ██║██║  ███╗██╔████╔██║███████║█████╗██║     ██║     ██║
    ██║   ██║╚════██║╚════╝██╔══╝  ██║██║   ██║██║╚██╔╝██║██╔══██║╚════╝██║     ██║     ██║
    ╚██████╔╝███████║      ██║     ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║      ╚██████╗███████╗██║
     ╚═════╝ ╚══════╝      ╚═╝     ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝       ╚═════╝╚══════╝╚═╝
    `));
    console.log(chalk.hex('#FF6B35')('\n  ✨ Welcome to the OutSystems Figma CLI! '));
    console.log(chalk.hex('#4ECDC4')('  🎨 Go ahead and build something great for OutSystems! '));

    const config = loadConfig();

    // Safe Mode: Plugin-based connection (no patching, no CDP)
    if (options.safe) {
      console.log(chalk.hex('#4ECDC4')('  🔒 Safe Mode ') + chalk.gray('(plugin-based, no patching required)\n'));

      // Stop any existing daemon
      stopDaemon();

      // Start daemon in plugin mode
      const daemonSpinner = ora('Starting daemon in Safe Mode...').start();
      try {
        startDaemon(true, 'plugin');  // Force restart in plugin mode
        await new Promise(r => setTimeout(r, 1000));
        if (isDaemonRunning()) {
          daemonSpinner.succeed('Daemon running in Safe Mode');
        } else {
          daemonSpinner.fail('Daemon failed to start');
          return;
        }
      } catch (e) {
        daemonSpinner.fail('Daemon failed: ' + e.message);
        return;
      }

      // Show plugin setup instructions
      console.log(chalk.hex('#FF6B35')('\n  ┌─────────────────────────────────────────────────────┐'));
      console.log(chalk.hex('#FF6B35')('  │') + chalk.white.bold('  Setup the FigCli plugin                           ') + chalk.hex('#FF6B35')('│'));
      console.log(chalk.hex('#FF6B35')('  └─────────────────────────────────────────────────────┘\n'));

      console.log(chalk.white.bold('  ONE-TIME SETUP:\n'));
      console.log(chalk.cyan('  1. ') + chalk.white('Open Figma Desktop and any design file'));
      console.log(chalk.cyan('  2. ') + chalk.white('Go to ') + chalk.yellow('Plugins → Development → Import plugin from manifest'));
      console.log(chalk.cyan('  3. ') + chalk.white('Navigate to: ') + chalk.yellow(process.cwd() + '/plugin/manifest.json'));
      console.log(chalk.cyan('  4. ') + chalk.white('Click ') + chalk.yellow('Open') + chalk.white(' — plugin is now installed!\n'));

      console.log(chalk.white.bold('  EACH SESSION:\n'));
      console.log(chalk.cyan('  → ') + chalk.white('In Figma: ') + chalk.yellow('Plugins → Development → FigCli\n'));

      console.log(chalk.gray('  💡 Tip: Right-click plugin → "Add to toolbar" for one-click access\n'));

      // Wait for plugin connection
      const pluginSpinner = ora('Waiting for plugin connection...').start();
      let pluginConnected = false;
      for (let i = 0; i < 30; i++) {  // Wait up to 30 seconds
        await new Promise(r => setTimeout(r, 1000));
        try {
          const pluginToken = getDaemonToken();
          const pluginHeader = pluginToken ? ` -H "X-Daemon-Token: ${pluginToken}"` : '';
          const healthRes = execSync(`curl -s${pluginHeader} http://127.0.0.1:${DAEMON_PORT}/health`, { encoding: 'utf8' });
          const health = JSON.parse(healthRes);
          if (health.plugin) {
            pluginSpinner.succeed('Plugin connected!');
            console.log(chalk.green('\n  ✓ Ready! Safe Mode active.\n'));
            pluginConnected = true;
            break;
          }
        } catch {}
      }

      if (!pluginConnected) {
        pluginSpinner.warn('Plugin not detected. Start the plugin in Figma to connect.');
      }
      return;
    }

    // Yolo Mode: CDP-based connection (default)
    console.log(chalk.hex('#FF6B35')('  🚀 Yolo Mode ') + chalk.gray('(direct CDP connection)\n'));

    // Patch Figma if needed
    if (!config.patched) {
      const patchSpinner = ora('Setting up Figma connection...').start();
      try {
        const patchStatus = isPatched();
        if (patchStatus === true) {
          patchSpinner.succeed('Figma ready');
        } else if (patchStatus === false) {
          patchFigma();
          patchSpinner.succeed('Figma configured');
        } else {
          patchSpinner.succeed('Figma ready');
        }
        config.patched = true;
        saveConfig(config);
      } catch (err) {
        patchSpinner.fail('Setup failed');

        // macOS Full Disk Access needed
        if (process.platform === 'darwin') {
          console.log(chalk.hex('#FF6B35')('\n  ┌─────────────────────────────────────────────────────┐'));
          console.log(chalk.hex('#FF6B35')('  │') + chalk.white.bold('  One-time setup required                           ') + chalk.hex('#FF6B35')('│'));
          console.log(chalk.hex('#FF6B35')('  └─────────────────────────────────────────────────────┘\n'));

          console.log(chalk.white('  Your Terminal needs permission to configure Figma.\n'));

          console.log(chalk.cyan('  Step 1: ') + chalk.white('Open ') + chalk.yellow('System Settings'));
          console.log(chalk.cyan('  Step 2: ') + chalk.white('Go to ') + chalk.yellow('Privacy & Security → Full Disk Access'));
          console.log(chalk.cyan('  Step 3: ') + chalk.white('Click ') + chalk.yellow('+') + chalk.white(' and add ') + chalk.yellow('Terminal'));
          console.log(chalk.cyan('  Step 4: ') + chalk.white('Quit Terminal completely ') + chalk.gray('(Cmd+Q)'));
          console.log(chalk.cyan('  Step 5: ') + chalk.white('Reopen Terminal and try again\n'));

          console.log(chalk.gray('  Or use Safe Mode: ') + chalk.cyan('node src/index.js connect --safe\n'));
        } else {
          console.log(chalk.yellow('\n  Try running as administrator.\n'));
          console.log(chalk.gray('  Or use Safe Mode: ') + chalk.cyan('node src/index.js connect --safe\n'));
        }
        return;
      }
    }

    // Stop any existing daemon
    stopDaemon();

    console.log(chalk.blue('Starting Figma...'));
    try {
      killFigma();
      await new Promise(r => setTimeout(r, 500));
    } catch {}

    startFigma();
    console.log(chalk.green('✓ Figma started\n'));

    // Wait and check connection
    const spinner = ora('Waiting for connection...').start();
    let connected = false;
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const result = figmaUse('status', { silent: true });
      if (result && result.includes('Connected')) {
        spinner.succeed('Connected to Figma');
        console.log(chalk.gray(result.trim()));
        connected = true;
        break;
      }
    }

    if (!connected) {
      spinner.warn('Open a file in Figma to connect');
      return;
    }

    // Start daemon for fast commands (force restart to get fresh connection)
    const daemonSpinner = ora('Starting speed daemon...').start();
    try {
      startDaemon(true, 'auto');  // Auto mode: uses plugin if connected, otherwise CDP
      await new Promise(r => setTimeout(r, 1500));
      if (isDaemonRunning()) {
        daemonSpinner.succeed('Speed daemon running (commands are now 10x faster)');
      } else {
        daemonSpinner.warn('Daemon failed to start, commands will be slower');
      }
    } catch (e) {
      daemonSpinner.warn('Daemon failed: ' + e.message);
    }
  });

// ============ VARIABLES ============

const variables = program
  .command('variables')
  .alias('var')
  .description('Manage design tokens/variables');

variables
  .command('list')
  .description('List all variables')
  .action(() => {
    checkConnection();
    figmaUse('variable list');
  });

variables
  .command('create <name>')
  .description('Create a variable')
  .requiredOption('-c, --collection <id>', 'Collection ID or name')
  .requiredOption('-t, --type <type>', 'Type: COLOR, FLOAT, STRING, BOOLEAN')
  .option('-v, --value <value>', 'Initial value')
  .action((name, options) => {
    checkConnection();
    const type = options.type.toUpperCase();
    const code = `(async () => {
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.id === '${options.collection}' || c.name === '${options.collection}');
if (!col) return 'Collection not found: ${options.collection}';
const modeId = col.modes[0].modeId;

function hexToRgb(hex) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : null;
}

const v = figma.variables.createVariable('${name}', col, '${type}');
${options.value ? `
let figmaValue = '${options.value}';
if ('${type}' === 'COLOR') figmaValue = hexToRgb('${options.value}');
else if ('${type}' === 'FLOAT') figmaValue = parseFloat('${options.value}');
else if ('${type}' === 'BOOLEAN') figmaValue = '${options.value}' === 'true';
v.setValueForMode(modeId, figmaValue);
` : ''}
return 'Created ${type.toLowerCase()} variable: ${name}';
})()`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

variables
  .command('find <pattern>')
  .description('Find variables by name pattern')
  .action((pattern) => {
    checkConnection();
    figmaUse(`variable find "${pattern}"`);
  });

variables
  .command('visualize [collection]')
  .description('Create color swatches on canvas')
  .action(async (collection, options) => {
    checkConnection();
    const spinner = ora('Creating color palette...').start();

    const code = `(async () => {
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const colorVars = await figma.variables.getLocalVariablesAsync('COLOR');

const targetCols = ${collection ? `collections.filter(c => c.name.toLowerCase().includes('${collection}'.toLowerCase()))` : 'collections'};
if (targetCols.length === 0) return 'No collections found';

// Skip semantic collections (they're aliases, colors already shown in primitives)
const filteredCols = targetCols.filter(c => !c.name.toLowerCase().includes('semantic'));
if (filteredCols.length === 0) return 'No color collections found (only semantic)';

let startX = 0;
figma.currentPage.children.forEach(n => {
  startX = Math.max(startX, n.x + (n.width || 0));
});
startX += 100;

let totalSwatches = 0;

// color order for palette display
const colorOrder = ['primary','secondary','neutral','info','success','warning','error','brand','accent','slate','gray','zinc','stone','red','orange','amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet','purple','fuchsia','pink','rose','white','black'];

for (const col of filteredCols) {
  const colVars = colorVars.filter(v => v.variableCollectionId === col.id);
  if (colVars.length === 0) continue;

  // Group by prefix (handles both "blue/500" and semantic names)
  const groups = {};
  const semanticGroups = {
    'background': 'base', 'foreground': 'base', 'border': 'base', 'input': 'base', 'ring': 'base',
    'primary': 'primary', 'primary-foreground': 'primary',
    'secondary': 'secondary', 'secondary-foreground': 'secondary',
    'muted': 'muted', 'muted-foreground': 'muted',
    'accent': 'accent', 'accent-foreground': 'accent',
    'card': 'card', 'card-foreground': 'card',
    'popover': 'popover', 'popover-foreground': 'popover',
    'destructive': 'destructive', 'destructive-foreground': 'destructive',
    'chart-1': 'chart', 'chart-2': 'chart', 'chart-3': 'chart', 'chart-4': 'chart', 'chart-5': 'chart',
  };
  colVars.forEach(v => {
    const parts = v.name.split('/');
    let prefix;
    if (parts.length > 1) {
      prefix = parts[0];
    } else if (v.name.startsWith('sidebar-')) {
      prefix = 'sidebar';
    } else {
      prefix = semanticGroups[v.name] || 'other';
    }
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(v);
  });

  // Sort groups
  const semanticOrder = ['base','primary','secondary','muted','accent','card','popover','destructive','chart','sidebar'];
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    const aColorIdx = colorOrder.indexOf(a[0]);
    const bColorIdx = colorOrder.indexOf(b[0]);
    const aSemanticIdx = semanticOrder.indexOf(a[0]);
    const bSemanticIdx = semanticOrder.indexOf(b[0]);
    if (aColorIdx !== -1 && bColorIdx !== -1) return aColorIdx - bColorIdx;
    if (aColorIdx !== -1) return -1;
    if (bColorIdx !== -1) return 1;
    if (aSemanticIdx !== -1 && bSemanticIdx !== -1) return aSemanticIdx - bSemanticIdx;
    return a[0].localeCompare(b[0]);
  });

  // Create container
  const container = figma.createFrame();
  container.name = col.name;
  container.x = startX;
  container.y = 0;
  container.layoutMode = 'VERTICAL';
  container.primaryAxisSizingMode = 'AUTO';
  container.counterAxisSizingMode = 'AUTO';
  container.itemSpacing = 8;
  container.paddingTop = 32;
  container.paddingBottom = 32;
  container.paddingLeft = 32;
  container.paddingRight = 32;
  container.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  container.cornerRadius = 16;

  // Title
  const title = figma.createText();
  title.characters = col.name;
  title.fontSize = 20;
  title.fontName = { family: 'Inter', style: 'Medium' };
  title.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
  container.appendChild(title);

  // Spacer
  const spacer = figma.createFrame();
  spacer.resize(1, 16);
  spacer.fills = [];
  container.appendChild(spacer);

  const modeId = col.modes[0].modeId;
  const swatchesToBind = [];

  for (const [groupName, vars] of sortedGroups) {
    // Row container with label
    const rowContainer = figma.createFrame();
    rowContainer.name = groupName;
    rowContainer.layoutMode = 'HORIZONTAL';
    rowContainer.primaryAxisSizingMode = 'AUTO';
    rowContainer.counterAxisSizingMode = 'AUTO';
    rowContainer.itemSpacing = 16;
    rowContainer.counterAxisAlignItems = 'CENTER';
    rowContainer.fills = [];
    container.appendChild(rowContainer);

    // Label
    const label = figma.createText();
    label.characters = groupName;
    label.fontSize = 13;
    label.fontName = { family: 'Inter', style: 'Medium' };
    label.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
    label.resize(80, label.height);
    label.textAlignHorizontal = 'RIGHT';
    rowContainer.appendChild(label);

    // Swatches row
    const swatchRow = figma.createFrame();
    swatchRow.layoutMode = 'HORIZONTAL';
    swatchRow.primaryAxisSizingMode = 'AUTO';
    swatchRow.counterAxisSizingMode = 'AUTO';
    swatchRow.itemSpacing = 0;
    swatchRow.fills = [];
    swatchRow.cornerRadius = 6;
    swatchRow.clipsContent = true;
    rowContainer.appendChild(swatchRow);

    // Sort shades
    vars.sort((a, b) => {
      const aNum = parseInt(a.name.split('/').pop()) || 0;
      const bNum = parseInt(b.name.split('/').pop()) || 0;
      return aNum - bNum;
    });

    for (const v of vars) {
      const swatch = figma.createFrame();
      swatch.name = v.name;
      swatch.resize(48, 32);
      swatch.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
      swatchRow.appendChild(swatch);
      swatchesToBind.push({ swatch, variable: v, modeId });
      totalSwatches++;
    }
  }

  // Bind after appending
  for (const { swatch, variable, modeId } of swatchesToBind) {
    try {
      let value = variable.valuesByMode[modeId];
      if (value && value.type === 'VARIABLE_ALIAS') {
        const resolved = figma.variables.getVariableById(value.id);
        if (resolved) value = resolved.valuesByMode[Object.keys(resolved.valuesByMode)[0]];
      }
      if (value && value.r !== undefined) {
        swatch.fills = [figma.variables.setBoundVariableForPaint(
          { type: 'SOLID', color: { r: value.r, g: value.g, b: value.b } }, 'color', variable
        )];
      }
    } catch (e) {}
  }

  startX += container.width + 60;
}

figma.viewport.scrollAndZoomIntoView(figma.currentPage.children.slice(-filteredCols.length));
return 'Created ' + totalSwatches + ' color swatches';
})()`;

    try {
      const result = await fastEval(code);
      spinner.succeed(result || 'Created color palette');
    } catch (error) {
      spinner.fail('Failed to create palette');
      console.error(chalk.red(error.message));
    }
  });

variables
  .command('create-batch <json>')
  .description('Create multiple variables at once (faster than individual calls)')
  .requiredOption('-c, --collection <id>', 'Collection ID or name')
  .action((json, options) => {
    checkConnection();
    let vars;
    try {
      vars = JSON.parse(json);
    } catch {
      console.log(chalk.red('Invalid JSON. Expected: [{"name": "color/red", "type": "COLOR", "value": "#ff0000"}, ...]'));
      return;
    }
    if (!Array.isArray(vars)) {
      console.log(chalk.red('Expected JSON array'));
      return;
    }

    const code = `(async () => {
const vars = ${JSON.stringify(vars)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.id === '${options.collection}' || c.name === '${options.collection}');
if (!col) return 'Collection not found: ${options.collection}';
const modeId = col.modes[0].modeId;

function hexToRgb(hex) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 } : null;
}

let created = 0;
for (const v of vars) {
  const type = (v.type || 'COLOR').toUpperCase();
  const variable = figma.variables.createVariable(v.name, col, type);
  if (v.value !== undefined) {
    let figmaValue = v.value;
    if (type === 'COLOR') figmaValue = hexToRgb(v.value);
    else if (type === 'FLOAT') figmaValue = parseFloat(v.value);
    else if (type === 'BOOLEAN') figmaValue = v.value === true || v.value === 'true';
    variable.setValueForMode(modeId, figmaValue);
  }
  created++;
}
return 'Created ' + created + ' variables';
})()`;

    const result = figmaEvalSync(code);
    console.log(chalk.green(result || `✓ Created ${vars.length} variables`));
  });

variables
  .command('delete-all')
  .description('Delete all local variables and collections')
  .option('-c, --collection <name>', 'Only delete variables in this collection')
  .action((options) => {
    checkConnection();
    const spinner = ora('Deleting variables...').start();

    const filterCode = options.collection
      ? `cols = cols.filter(c => c.name.includes('${options.collection}'));`
      : '';

    const code = `(async () => {
let cols = await figma.variables.getLocalVariableCollectionsAsync();
${filterCode}
let deleted = 0;
for (const col of cols) {
  const vars = await figma.variables.getLocalVariablesAsync();
  const colVars = vars.filter(v => v.variableCollectionId === col.id);
  for (const v of colVars) {
    v.remove();
    deleted++;
  }
  col.remove();
}
return 'Deleted ' + deleted + ' variables and ' + cols.length + ' collections';
})()`;

    try {
      const result = figmaEvalSync(code);
      spinner.succeed(result);
    } catch (error) {
      spinner.fail('Failed to delete variables');
      console.error(chalk.red(error.message));
    }
  });

// ============ BATCH OPERATIONS ============

program
  .command('delete-batch <nodeIds>')
  .description('Delete multiple nodes at once (comma-separated IDs or JSON array)')
  .action((nodeIds) => {
    checkConnection();
    let ids;
    try {
      ids = JSON.parse(nodeIds);
    } catch {
      ids = nodeIds.split(',').map(s => s.trim());
    }

    const code = `(async () => {
const ids = ${JSON.stringify(ids)};
let deleted = 0;
for (const id of ids) {
  const node = await figma.getNodeByIdAsync(id);
  if (node) {
    node.remove();
    deleted++;
  }
}
return 'Deleted ' + deleted + ' nodes';
})()`;

    const result = figmaEvalSync(code);
    console.log(chalk.green(result || `✓ Deleted nodes`));
  });

program
  .command('bind-batch <json>')
  .description('Bind variables to multiple nodes at once')
  .action((json) => {
    checkConnection();
    let bindings;
    try {
      bindings = JSON.parse(json);
    } catch {
      console.log(chalk.red('Invalid JSON. Expected: [{"nodeId": "1:234", "property": "fill", "variable": "primary/500"}, ...]'));
      return;
    }

    const code = `(async () => {
const bindings = ${JSON.stringify(bindings)};
const vars = await figma.variables.getLocalVariablesAsync();
let bound = 0;

for (const b of bindings) {
  const node = await figma.getNodeByIdAsync(b.nodeId);
  if (!node) continue;

  const variable = vars.find(v => v.name === b.variable || v.name.endsWith('/' + b.variable));
  if (!variable) continue;

  const prop = b.property.toLowerCase();

  if (prop === 'fill' && 'fills' in node && node.fills.length > 0) {
    const newFill = figma.variables.setBoundVariableForPaint(node.fills[0], 'color', variable);
    node.fills = [newFill];
    bound++;
  } else if (prop === 'stroke' && 'strokes' in node && node.strokes.length > 0) {
    const newStroke = figma.variables.setBoundVariableForPaint(node.strokes[0], 'color', variable);
    node.strokes = [newStroke];
    bound++;
  } else if (prop === 'radius' && 'cornerRadius' in node) {
    node.setBoundVariable('cornerRadius', variable);
    bound++;
  } else if (prop === 'gap' && 'itemSpacing' in node) {
    node.setBoundVariable('itemSpacing', variable);
    bound++;
  } else if (prop === 'padding' && 'paddingTop' in node) {
    node.setBoundVariable('paddingTop', variable);
    node.setBoundVariable('paddingBottom', variable);
    node.setBoundVariable('paddingLeft', variable);
    node.setBoundVariable('paddingRight', variable);
    bound++;
  }
}
return 'Bound ' + bound + ' properties';
})()`;

    const result = figmaEvalSync(code);
    console.log(chalk.green(result || `✓ Bound variables`));
  });

program
  .command('set-batch <json>')
  .description('Set properties on multiple nodes at once')
  .action((json) => {
    checkConnection();
    let operations;
    try {
      operations = JSON.parse(json);
    } catch {
      console.log(chalk.red('Invalid JSON. Expected: [{"nodeId": "1:234", "fill": "#ff0000", "radius": 8}, ...]'));
      return;
    }

    const code = `(async () => {
const operations = ${JSON.stringify(operations)};
let updated = 0;

function hexToRgb(hex) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 } : null;
}

for (const op of operations) {
  const node = await figma.getNodeByIdAsync(op.nodeId);
  if (!node) continue;

  if (op.fill && 'fills' in node) {
    const rgb = hexToRgb(op.fill);
    if (rgb) node.fills = [{ type: 'SOLID', color: rgb }];
  }
  if (op.stroke && 'strokes' in node) {
    const rgb = hexToRgb(op.stroke);
    if (rgb) node.strokes = [{ type: 'SOLID', color: rgb }];
  }
  if (op.strokeWidth !== undefined && 'strokeWeight' in node) {
    node.strokeWeight = op.strokeWidth;
  }
  if (op.radius !== undefined && 'cornerRadius' in node) {
    node.cornerRadius = op.radius;
  }
  if (op.opacity !== undefined && 'opacity' in node) {
    node.opacity = op.opacity;
  }
  if (op.name && 'name' in node) {
    node.name = op.name;
  }
  if (op.visible !== undefined && 'visible' in node) {
    node.visible = op.visible;
  }
  if (op.x !== undefined) node.x = op.x;
  if (op.y !== undefined) node.y = op.y;
  if (op.width !== undefined && op.height !== undefined && 'resize' in node) {
    node.resize(op.width, op.height);
  }
  updated++;
}
return 'Updated ' + updated + ' nodes';
})()`;

    const result = figmaEvalSync(code);
    console.log(chalk.green(result || `✓ Updated nodes`));
  });

program
  .command('rename-batch <json>')
  .description('Rename multiple nodes at once')
  .action((json) => {
    checkConnection();
    let renames;
    try {
      renames = JSON.parse(json);
    } catch {
      console.log(chalk.red('Invalid JSON. Expected: [{"nodeId": "1:234", "name": "New Name"}, ...] or {"1:234": "New Name", ...}'));
      return;
    }

    // Support both array and object format
    let pairs;
    if (Array.isArray(renames)) {
      pairs = renames.map(r => ({ id: r.nodeId, name: r.name }));
    } else {
      pairs = Object.entries(renames).map(([id, name]) => ({ id, name }));
    }

    const code = `(async () => {
const pairs = ${JSON.stringify(pairs)};
let renamed = 0;
for (const p of pairs) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (node) {
    node.name = p.name;
    renamed++;
  }
}
return 'Renamed ' + renamed + ' nodes';
})()`;

    const result = figmaEvalSync(code);
    console.log(chalk.green(result || `✓ Renamed nodes`));
  });

// ============ DAEMON ============

const daemon = program
  .command('daemon')
  .description('Manage the speed daemon');

daemon
  .command('status')
  .description('Check if daemon is running')
  .action(() => {
    if (isDaemonRunning()) {
      console.log(chalk.green('✓ Daemon is running on port ' + DAEMON_PORT));
    } else {
      console.log(chalk.yellow('○ Daemon is not running'));
      console.log(chalk.gray('  Run "outsystems-figma-cli connect" to start it automatically'));
    }
  });

daemon
  .command('start')
  .description('Start the daemon manually')
  .action(async () => {
    if (isDaemonRunning()) {
      console.log(chalk.green('✓ Daemon already running'));
      return;
    }
    console.log(chalk.blue('Starting daemon...'));
    startDaemon();
    await new Promise(r => setTimeout(r, 1500));
    if (isDaemonRunning()) {
      console.log(chalk.green('✓ Daemon started on port ' + DAEMON_PORT));
    } else {
      console.log(chalk.red('✗ Failed to start daemon'));
    }
  });

daemon
  .command('stop')
  .description('Stop the daemon')
  .action(() => {
    console.log(chalk.blue('Stopping daemon...'));
    stopDaemon();
    console.log(chalk.green('✓ Daemon stopped'));
  });

daemon
  .command('restart')
  .description('Restart the daemon')
  .action(async () => {
    console.log(chalk.blue('Restarting daemon...'));
    stopDaemon();
    await new Promise(r => setTimeout(r, 500));
    startDaemon();
    await new Promise(r => setTimeout(r, 1500));
    if (isDaemonRunning()) {
      console.log(chalk.green('✓ Daemon restarted'));
    } else {
      console.log(chalk.red('✗ Failed to restart daemon'));
    }
  });

daemon
  .command('reconnect')
  .description('Reconnect to Figma (use if connection is stale)')
  .action(async () => {
    if (!isDaemonRunning()) {
      console.log(chalk.yellow('○ Daemon is not running'));
      console.log(chalk.gray('  Run "outsystems-figma-cli connect" first'));
      return;
    }
    console.log(chalk.blue('Reconnecting to Figma...'));
    try {
      const reconnToken = getDaemonToken();
      const reconnHeaders = {};
      if (reconnToken) reconnHeaders['X-Daemon-Token'] = reconnToken;
      const response = await fetch(`http://localhost:${DAEMON_PORT}/reconnect`, { headers: reconnHeaders });
      const result = await response.json();
      if (result.error) {
        console.log(chalk.red('✗ Reconnect failed: ' + result.error));
      } else {
        console.log(chalk.green('✓ Reconnected to Figma'));
      }
    } catch (e) {
      console.log(chalk.red('✗ Failed: ' + e.message));
    }
  });

// ============ COLLECTIONS ============

const collections = program
  .command('collections')
  .alias('col')
  .description('Manage variable collections');

collections
  .command('list')
  .description('List all collections')
  .action(() => {
    checkConnection();
    figmaUse('collection list');
  });

collections
  .command('create <name>')
  .description('Create a collection')
  .action((name) => {
    checkConnection();
    figmaUse(`collection create "${name}"`);
  });

// ============ TOKENS (PRESETS) ============

const tokens = program
  .command('tokens')
  .description('Create design token presets');

tokens
  .command('preset')
  .description('Create all OutSystems design token collections')
  .action(async () => {
    checkConnection();

    console.log(chalk.cyan('\n  OutSystems Design Tokens'));
    console.log(chalk.gray('  Creating collections in Figma...\n'));

    // ── Colors (Light/Dark modes) ──
    const osColors = {
      '--color-primary':       { light: '#1068EB', dark: '#5A9BF5' },
      '--color-secondary':     { light: '#303D60', dark: '#8D9BB5' },
      '--color-neutral-0':     { light: '#FFFFFF', dark: '#101213' },
      '--color-neutral-1':     { light: '#F8F9FA', dark: '#1A1D1F' },
      '--color-neutral-2':     { light: '#F1F3F5', dark: '#222628' },
      '--color-neutral-3':     { light: '#E9ECEF', dark: '#2C3033' },
      '--color-neutral-4':     { light: '#DEE2E6', dark: '#3A3F44' },
      '--color-neutral-5':     { light: '#CED4DA', dark: '#4F575E' },
      '--color-neutral-6':     { light: '#ADB5BD', dark: '#6A7178' },
      '--color-neutral-7':     { light: '#6A7178', dark: '#ADB5BD' },
      '--color-neutral-8':     { light: '#4F575E', dark: '#CED4DA' },
      '--color-neutral-9':     { light: '#272B30', dark: '#E9ECEF' },
      '--color-neutral-10':    { light: '#101213', dark: '#FFFFFF' },
      '--color-info':          { light: '#017AAD', dark: '#33A3D4' },
      '--color-info-light':    { light: '#E5F5FC', dark: '#0A2E3D' },
      '--color-success':       { light: '#29823B', dark: '#4CAF5E' },
      '--color-success-light': { light: '#EAF3EB', dark: '#0F2E14' },
      '--color-warning':       { light: '#E9A100', dark: '#FFB82E' },
      '--color-warning-light': { light: '#FDF6E5', dark: '#3D2A00' },
      '--color-error':         { light: '#DC2020', dark: '#F25050' },
      '--color-error-light':   { light: '#FCEAEA', dark: '#3D0A0A' }
    };

    let spinner = ora('Creating OS/Colors (Light/Dark)...').start();
    const colorsCode = `(async () => {
const colors = ${JSON.stringify(osColors)};
function hexToRgb(hex) {
  const r = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 } : null;
}
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === 'OS/Colors');
if (!col) col = figma.variables.createVariableCollection('OS/Colors');

let lightModeId = col.modes.find(m => m.name === 'Light')?.modeId;
let darkModeId = col.modes.find(m => m.name === 'Dark')?.modeId;
if (!lightModeId) {
  col.renameMode(col.modes[0].modeId, 'Light');
  lightModeId = col.modes[0].modeId;
}
if (!darkModeId) {
  darkModeId = col.addMode('Dark');
}

const existingVars = await figma.variables.getLocalVariablesAsync('COLOR');
let count = 0;
for (const [name, vals] of Object.entries(colors)) {
  let v = existingVars.find(ev => ev.name === name && ev.variableCollectionId === col.id);
  if (!v) {
    v = figma.variables.createVariable(name, col, 'COLOR');
    count++;
  }
  v.setValueForMode(lightModeId, hexToRgb(vals.light));
  v.setValueForMode(darkModeId, hexToRgb(vals.dark));
}
return count;
})()`;

    try {
      const result = await fastEval(colorsCode);
      spinner.succeed(`OS/Colors (${String(result ?? '21').trim()} variables, Light/Dark modes)`);
    } catch (error) {
      spinner.fail('OS/Colors failed');
      console.error(chalk.red(error.message));
    }

    // ── Typography ──
    const osTypography = {
      '--font-size-display': 36, '--font-size-h1': 32, '--font-size-h2': 28,
      '--font-size-h3': 26, '--font-size-h4': 22, '--font-size-h5': 20,
      '--font-size-h6': 18, '--font-size-base': 16, '--font-size-s': 14,
      '--font-size-xs': 12,
      '--font-light': 300, '--font-regular': 400,
      '--font-semi-bold': 600, '--font-bold': 700
    };

    spinner = ora('Creating OS/Typography...').start();
    const typographyCode = `(async () => {
const typography = ${JSON.stringify(osTypography)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === 'OS/Typography');
if (!col) col = figma.variables.createVariableCollection('OS/Typography');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [name, value] of Object.entries(typography)) {
  let v = existingVars.find(ev => ev.name === name && ev.variableCollectionId === col.id);
  if (!v) {
    v = figma.variables.createVariable(name, col, 'FLOAT');
    count++;
  }
  v.setValueForMode(modeId, value);
}
return count;
})()`;

    try {
      const result = await fastEval(typographyCode);
      spinner.succeed(`OS/Typography (${String(result ?? '14').trim()} variables)`);
    } catch { spinner.fail('OS/Typography failed'); }

    // ── Spacing ──
    const osSpacing = {
      '--space-none': 0, '--space-xs': 4, '--space-s': 8,
      '--space-base': 16, '--space-m': 24, '--space-l': 32,
      '--space-xl': 40, '--space-xxl': 48
    };

    spinner = ora('Creating OS/Spacing...').start();
    const spacingCode = `(async () => {
const spacings = ${JSON.stringify(osSpacing)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === 'OS/Spacing');
if (!col) col = figma.variables.createVariableCollection('OS/Spacing');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [name, value] of Object.entries(spacings)) {
  let v = existingVars.find(ev => ev.name === name && ev.variableCollectionId === col.id);
  if (!v) {
    v = figma.variables.createVariable(name, col, 'FLOAT');
    count++;
  }
  v.setValueForMode(modeId, value);
}
return count;
})()`;

    try {
      const result = await fastEval(spacingCode);
      spinner.succeed(`OS/Spacing (${String(result ?? '8').trim()} variables)`);
    } catch { spinner.fail('OS/Spacing failed'); }

    // ── Border Radius ──
    const osRadii = {
      '--border-radius-none': 0, '--border-radius-soft': 4, '--border-radius-rounded': 100
    };

    spinner = ora('Creating OS/Border Radius...').start();
    const radiiCode = `(async () => {
const radii = ${JSON.stringify(osRadii)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === 'OS/Border Radius');
if (!col) col = figma.variables.createVariableCollection('OS/Border Radius');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [name, value] of Object.entries(radii)) {
  let v = existingVars.find(ev => ev.name === name && ev.variableCollectionId === col.id);
  if (!v) {
    v = figma.variables.createVariable(name, col, 'FLOAT');
    count++;
  }
  v.setValueForMode(modeId, value);
}
return count;
})()`;

    try {
      const result = await fastEval(radiiCode);
      spinner.succeed(`OS/Border Radius (${String(result ?? '3').trim()} variables)`);
    } catch { spinner.fail('OS/Border Radius failed'); }

    await new Promise(r => setTimeout(r, 100));

    console.log(chalk.green('\n  OutSystems design tokens created!\n'));
    console.log(chalk.white('  Collections:'));
    console.log(chalk.gray('    OS/Colors        - 21 colors (Light/Dark modes)'));
    console.log(chalk.gray('    OS/Typography    - 14 variables (font sizes + weights)'));
    console.log(chalk.gray('    OS/Spacing       - 8 variables (none to xxl)'));
    console.log(chalk.gray('    OS/Border Radius - 3 variables (none, soft, rounded)'));
    console.log();
    console.log(chalk.gray('  Total: ~46 variables across 4 collections\n'));
  });

tokens
  .command('spacing')
  .description('Create OutSystems spacing scale')
  .option('-c, --collection <name>', 'Collection name', 'OS/Spacing')
  .action((options) => {
    checkConnection();
    const spinner = ora('Creating OutSystems spacing scale...').start();

    const spacings = {
      '--space-none': 0, '--space-xs': 4, '--space-s': 8,
      '--space-base': 16, '--space-m': 24, '--space-l': 32,
      '--space-xl': 40, '--space-xxl': 48
    };

    const code = `(async () => {
const spacings = ${JSON.stringify(spacings)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === '${options.collection}');
if (!col) col = figma.variables.createVariableCollection('${options.collection}');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [name, value] of Object.entries(spacings)) {
  const existing = existingVars.find(v => v.name === name && v.variableCollectionId === col.id);
  if (!existing) {
    const v = figma.variables.createVariable(name, col, 'FLOAT');
    v.setValueForMode(modeId, value);
    count++;
  }
}
return 'Created ' + count + ' spacing variables';
})()`;

    try {
      const result = figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      spinner.succeed(String(result ?? '').trim() || 'Created OutSystems spacing scale');
    } catch (error) {
      spinner.fail('Failed to create spacing scale');
    }
  });

tokens
  .command('radii')
  .description('Create OutSystems border radius scale')
  .option('-c, --collection <name>', 'Collection name', 'OS/Border Radius')
  .action((options) => {
    checkConnection();
    const spinner = ora('Creating OutSystems border radii...').start();

    const radii = {
      '--border-radius-none': 0, '--border-radius-soft': 4, '--border-radius-rounded': 100
    };

    const code = `(async () => {
const radii = ${JSON.stringify(radii)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === '${options.collection}');
if (!col) col = figma.variables.createVariableCollection('${options.collection}');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [name, value] of Object.entries(radii)) {
  const existing = existingVars.find(v => v.name === name && v.variableCollectionId === col.id);
  if (!existing) {
    const v = figma.variables.createVariable(name, col, 'FLOAT');
    v.setValueForMode(modeId, value);
    count++;
  }
}
return 'Created ' + count + ' radius variables';
})()
`;

    try {
      const result = figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      spinner.succeed(String(result ?? '').trim() || 'Created OutSystems border radii');
    } catch (error) {
      spinner.fail('Failed to create radii');
    }
  });

tokens
  .command('import <file>')
  .description('Import tokens from JSON file')
  .option('-c, --collection <name>', 'Collection name')
  .action((file, options) => {
    checkConnection();

    // Read JSON file
    let tokensData;
    try {
      const content = readFileSync(file, 'utf8');
      tokensData = JSON.parse(content);
    } catch (error) {
      console.log(chalk.red(`✗ Could not read file: ${file}`));
      process.exit(1);
    }

    const spinner = ora('Importing tokens...').start();

    // Detect format and convert
    // Support: { "colors": { "primary": "#xxx" } } or { "primary": { "value": "#xxx", "type": "color" } }
    const collectionName = options.collection || 'Imported Tokens';

    const code = `(async () => {
const data = ${JSON.stringify(tokensData)};
const collectionName = '${collectionName}';

function hexToRgb(hex) {
  const r = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  if (!r) return null;
  return { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 };
}

function detectType(value) {
  if (typeof value === 'string' && value.startsWith('#')) return 'COLOR';
  if (typeof value === 'number') return 'FLOAT';
  if (typeof value === 'boolean') return 'BOOLEAN';
  return 'STRING';
}

function flattenTokens(obj, prefix = '') {
  const result = [];
  for (const [key, val] of Object.entries(obj)) {
    const name = prefix ? prefix + '/' + key : key;
    if (val && typeof val === 'object' && !val.value && !val.type) {
      result.push(...flattenTokens(val, name));
    } else {
      const value = val?.value ?? val;
      const type = val?.type?.toUpperCase() || detectType(value);
      result.push({ name, value, type });
    }
  }
  return result;
}

const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === collectionName);
if (!col) col = figma.variables.createVariableCollection(collectionName);
const modeId = col.modes[0].modeId;

const existingVars = await figma.variables.getLocalVariablesAsync();
const tokens = flattenTokens(data);
let count = 0;

for (const { name, value, type } of tokens) {
  const existing = existingVars.find(v => v.name === name);
  if (!existing) {
    try {
      const figmaType = type === 'COLOR' ? 'COLOR' : type === 'FLOAT' || type === 'NUMBER' ? 'FLOAT' : type === 'BOOLEAN' ? 'BOOLEAN' : 'STRING';
      const v = figma.variables.createVariable(name, col, figmaType);
      let figmaValue = value;
      if (figmaType === 'COLOR') figmaValue = hexToRgb(value);
      if (figmaValue !== null) {
        v.setValueForMode(modeId, figmaValue);
        count++;
      }
    } catch (e) {}
  }
}

return 'Imported ' + count + ' tokens into ' + collectionName;
})()`;

    try {
      const result = figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      spinner.succeed(result?.trim() || 'Tokens imported');
    } catch (error) {
      spinner.fail('Failed to import tokens');
      console.error(error.message);
    }
  });

tokens
  .command('ds')
  .description('Create IDS Base Design System (complete starter kit)')
  .action(async () => {
    checkConnection();

    console.log(chalk.cyan('\n  IDS Base Design System'));
    console.log(chalk.gray('  by Into Design Systems\n'));

    // IDS Base values
    const idsColors = {
      gray: { 50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b' },
      primary: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' },
      accent: { 50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9', 500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75', 950: '#4a044e' }
    };

    const idsSemanticColors = {
      'background/default': '#ffffff',
      'background/muted': '#f4f4f5',
      'background/emphasis': '#18181b',
      'foreground/default': '#18181b',
      'foreground/muted': '#71717a',
      'foreground/emphasis': '#ffffff',
      'border/default': '#e4e4e7',
      'border/focus': '#3b82f6',
      'action/primary': '#3b82f6',
      'action/primary-hover': '#2563eb',
      'feedback/success': '#22c55e',
      'feedback/success-muted': '#dcfce7',
      'feedback/warning': '#f59e0b',
      'feedback/warning-muted': '#fef3c7',
      'feedback/error': '#ef4444',
      'feedback/error-muted': '#fee2e2'
    };

    const idsSpacing = {
      'xs': 4, 'sm': 8, 'md': 16, 'lg': 24, 'xl': 32, '2xl': 48, '3xl': 64
    };

    const idsTypography = {
      'size/xs': 12, 'size/sm': 14, 'size/base': 16, 'size/lg': 18,
      'size/xl': 20, 'size/2xl': 24, 'size/3xl': 30, 'size/4xl': 36,
      'weight/normal': 400, 'weight/medium': 500, 'weight/semibold': 600, 'weight/bold': 700
    };

    const idsRadii = {
      'none': 0, 'sm': 4, 'md': 8, 'lg': 12, 'xl': 16, 'full': 9999
    };

    // Create Color - Primitives
    let spinner = ora('Creating Color - Primitives...').start();
    const primitivesCode = `(async () => {
const colors = ${JSON.stringify(idsColors)};
function hexToRgb(hex) {
  const r = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 };
}
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === 'Color - Primitives');
if (!col) col = figma.variables.createVariableCollection('Color - Primitives');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [colorName, shades] of Object.entries(colors)) {
  for (const [shade, hex] of Object.entries(shades)) {
    const existing = existingVars.find(v => v.name === colorName + '/' + shade);
    if (!existing) {
      const v = figma.variables.createVariable(colorName + '/' + shade, col, 'COLOR');
      v.setValueForMode(modeId, hexToRgb(hex));
      count++;
    }
  }
}
return count;
})()`;
    try {
      const result = figmaUse(`eval "${primitivesCode.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      spinner.succeed(`Color - Primitives (${result?.trim() || '33'} variables)`);
    } catch { spinner.fail('Color - Primitives failed'); }

    // Create Color - Semantic
    spinner = ora('Creating Color - Semantic...').start();
    const semanticCode = `(async () => {
const colors = ${JSON.stringify(idsSemanticColors)};
function hexToRgb(hex) {
  const r = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 };
}
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === 'Color - Semantic');
if (!col) col = figma.variables.createVariableCollection('Color - Semantic');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [name, hex] of Object.entries(colors)) {
  const existing = existingVars.find(v => v.name === name);
  if (!existing) {
    const v = figma.variables.createVariable(name, col, 'COLOR');
    v.setValueForMode(modeId, hexToRgb(hex));
    count++;
  }
}
return count;
})()`;
    try {
      const result = figmaUse(`eval "${semanticCode.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      spinner.succeed(`Color - Semantic (${result?.trim() || '13'} variables)`);
    } catch { spinner.fail('Color - Semantic failed'); }

    // Create Spacing
    spinner = ora('Creating Spacing...').start();
    const spacingCode = `(async () => {
const spacings = ${JSON.stringify(idsSpacing)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === 'Spacing');
if (!col) col = figma.variables.createVariableCollection('Spacing');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [name, value] of Object.entries(spacings)) {
  const existing = existingVars.find(v => v.name === name);
  if (!existing) {
    const v = figma.variables.createVariable(name, col, 'FLOAT');
    v.setValueForMode(modeId, value);
    count++;
  }
}
return count;
})()`;
    try {
      const result = figmaUse(`eval "${spacingCode.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      spinner.succeed(`Spacing (${result?.trim() || '7'} variables)`);
    } catch { spinner.fail('Spacing failed'); }

    // Create Typography
    spinner = ora('Creating Typography...').start();
    const typographyCode = `(async () => {
const typography = ${JSON.stringify(idsTypography)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === 'Typography');
if (!col) col = figma.variables.createVariableCollection('Typography');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [name, value] of Object.entries(typography)) {
  const existing = existingVars.find(v => v.name === name);
  if (!existing) {
    const v = figma.variables.createVariable(name, col, 'FLOAT');
    v.setValueForMode(modeId, value);
    count++;
  }
}
return count;
})()`;
    try {
      const result = figmaUse(`eval "${typographyCode.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      spinner.succeed(`Typography (${result?.trim() || '12'} variables)`);
    } catch { spinner.fail('Typography failed'); }

    // Create Border Radii
    spinner = ora('Creating Border Radii...').start();
    const radiiCode = `(async () => {
const radii = ${JSON.stringify(idsRadii)};
const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === 'Border Radii');
if (!col) col = figma.variables.createVariableCollection('Border Radii');
const modeId = col.modes[0].modeId;
const existingVars = await figma.variables.getLocalVariablesAsync();
let count = 0;
for (const [name, value] of Object.entries(radii)) {
  const existing = existingVars.find(v => v.name === name);
  if (!existing) {
    const v = figma.variables.createVariable(name, col, 'FLOAT');
    v.setValueForMode(modeId, value);
    count++;
  }
}
return count;
})()`;
    try {
      const result = figmaUse(`eval "${radiiCode.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      spinner.succeed(`Border Radii (${result?.trim() || '6'} variables)`);
    } catch { spinner.fail('Border Radii failed'); }

    // Small delay to let spinner render
    await new Promise(r => setTimeout(r, 100));

    // Summary
    console.log(chalk.green('\n  ✓ IDS Base Design System created!\n'));
    console.log(chalk.white('  Collections:'));
    console.log(chalk.gray('    • Color - Primitives (gray, primary, accent)'));
    console.log(chalk.gray('    • Color - Semantic (background, foreground, border, action, feedback)'));
    console.log(chalk.gray('    • Spacing (xs to 3xl, 4px base)'));
    console.log(chalk.gray('    • Typography (sizes + weights)'));
    console.log(chalk.gray('    • Border Radii (none to full)'));
    console.log();
    console.log(chalk.gray('  Total: ~74 variables across 5 collections\n'));
    console.log(chalk.gray('  Next: ') + chalk.cyan('outsystems-figma-cli tokens components') + chalk.gray(' to add UI components\n'));
  });

tokens
  .command('components')
  .description('Create IDS Base Components (Button, Input, Card, Badge)')
  .action(async () => {
    checkConnection();

    console.log(chalk.cyan('\n  IDS Base Components'));
    console.log(chalk.gray('  by Into Design Systems\n'));

    // Component colors (using IDS Base values)
    const colors = {
      primary500: '#3b82f6',
      primary600: '#2563eb',
      gray100: '#f4f4f5',
      gray200: '#e4e4e7',
      gray500: '#71717a',
      gray900: '#18181b',
      white: '#ffffff',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444'
    };

    // First, clean up any existing IDS components
    let spinner = ora('Cleaning up existing components...').start();
    const cleanupCode = `
const names = ['Button / Primary', 'Button / Secondary', 'Button / Outline', 'Input', 'Card', 'Badge / Default', 'Badge / Success', 'Badge / Warning', 'Badge / Error'];
let removed = 0;
figma.currentPage.children.forEach(n => {
  if (names.includes(n.name)) { n.remove(); removed++; }
});
removed
`;
    try {
      const removed = figmaUse(`eval "${cleanupCode.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      spinner.succeed(`Cleaned up ${removed?.trim() || '0'} old elements`);
    } catch { spinner.succeed('Ready'); }

    // Step 1: Create frames using JSX render (handles fonts)
    spinner = ora('Creating frames...').start();
    const jsxComponents = [
      { jsx: `<Frame name="Button / Primary" bg="${colors.primary500}" px={16} py={10} rounded={8} flex="row"><Text size={14} weight="semibold" color="#ffffff">Button</Text></Frame>` },
      { jsx: `<Frame name="Button / Secondary" bg="${colors.gray100}" px={16} py={10} rounded={8} flex="row"><Text size={14} weight="semibold" color="${colors.gray900}">Button</Text></Frame>` },
      { jsx: `<Frame name="Button / Outline" bg="#ffffff" stroke="${colors.gray200}" px={16} py={10} rounded={8} flex="row"><Text size={14} weight="semibold" color="${colors.gray900}">Button</Text></Frame>` },
      { jsx: `<Frame name="Input" w={200} bg="#ffffff" stroke="${colors.gray200}" px={12} py={10} rounded={8} flex="row"><Text size={14} color="${colors.gray500}">Placeholder</Text></Frame>` },
      { jsx: `<Frame name="Card" bg="#ffffff" stroke="${colors.gray200}" p={24} rounded={12} flex="col" gap={8}><Text size={18} weight="semibold" color="${colors.gray900}">Card Title</Text><Text size={14} color="${colors.gray500}">Card description goes here.</Text></Frame>` },
      { jsx: `<Frame name="Badge / Default" bg="${colors.gray100}" px={10} py={4} rounded={9999} flex="row"><Text size={12} weight="medium" color="${colors.gray900}">Badge</Text></Frame>` },
      { jsx: `<Frame name="Badge / Success" bg="#dcfce7" px={10} py={4} rounded={9999} flex="row"><Text size={12} weight="medium" color="#166534">Success</Text></Frame>` },
      { jsx: `<Frame name="Badge / Warning" bg="#fef3c7" px={10} py={4} rounded={9999} flex="row"><Text size={12} weight="medium" color="#92400e">Warning</Text></Frame>` },
      { jsx: `<Frame name="Badge / Error" bg="#fee2e2" px={10} py={4} rounded={9999} flex="row"><Text size={12} weight="medium" color="#991b1b">Error</Text></Frame>` }
    ];

    try {
      const client = await getFigmaClient();
      for (const { jsx } of jsxComponents) {
        await client.render(jsx);
      }
      spinner.succeed('9 frames created');
    } catch (e) { spinner.fail('Frame creation failed: ' + e.message); }

    // Step 2: Convert to components one by one with positioning
    spinner = ora('Converting to components...').start();

    const componentOrder = [
      { name: 'Button / Primary', row: 0, width: 80, varFill: 'action/primary' },
      { name: 'Button / Secondary', row: 0, width: 80, varFill: 'background/muted' },
      { name: 'Button / Outline', row: 0, width: 80, varFill: 'background/default', varStroke: 'border/default' },
      { name: 'Input', row: 0, width: 200, varFill: 'background/default', varStroke: 'border/default' },
      { name: 'Card', row: 0, width: 240, varFill: 'background/default', varStroke: 'border/default' },
      { name: 'Badge / Default', row: 1, width: 60, varFill: 'background/muted' },
      { name: 'Badge / Success', row: 1, width: 70, varFill: 'feedback/success-muted' },
      { name: 'Badge / Warning', row: 1, width: 70, varFill: 'feedback/warning-muted' },
      { name: 'Badge / Error', row: 1, width: 50, varFill: 'feedback/error-muted' }
    ];

    let row0X = 0, row1X = 0;
    const gap = 32;

    for (const comp of componentOrder) {
      const convertSingle = `
const f = figma.currentPage.children.find(n => n.name === '${comp.name}' && n.type === 'FRAME');
if (f) {
  const vars = figma.variables.getLocalVariables();
  const findVar = (name) => vars.find(v => v.name === name);
  ${comp.varFill ? `
  const vFill = findVar('${comp.varFill}');
  if (vFill && f.fills && f.fills.length > 0) {
    const fills = JSON.parse(JSON.stringify(f.fills));
    fills[0] = figma.variables.setBoundVariableForPaint(fills[0], 'color', vFill);
    f.fills = fills;
  }` : ''}
  ${comp.varStroke ? `
  const vStroke = findVar('${comp.varStroke}');
  if (vStroke && f.strokes && f.strokes.length > 0) {
    const strokes = JSON.parse(JSON.stringify(f.strokes));
    strokes[0] = figma.variables.setBoundVariableForPaint(strokes[0], 'color', vStroke);
    f.strokes = strokes;
  }` : ''}
  const c = figma.createComponentFromNode(f);
  c.x = ${comp.row === 0 ? row0X : row1X};
  c.y = ${comp.row === 0 ? 0 : 80};
}
`;
      try {
        figmaUse(`eval "${convertSingle.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
        if (comp.row === 0) row0X += comp.width + gap;
        else row1X += comp.width + 24;
      } catch {}
    }
    spinner.succeed('9 components with variables');

    await new Promise(r => setTimeout(r, 100));

    console.log(chalk.green('\n  ✓ IDS Base Components created!\n'));
    console.log(chalk.white('  Components:'));
    console.log(chalk.gray('    • Button (Primary, Secondary, Outline)'));
    console.log(chalk.gray('    • Input'));
    console.log(chalk.gray('    • Card'));
    console.log(chalk.gray('    • Badge (Default, Success, Warning, Error)'));
    console.log();
    console.log(chalk.gray('  Total: 9 components on canvas\n'));
  });

tokens
  .command('add <name> <value>')
  .description('Add a single token')
  .option('-c, --collection <name>', 'Collection name', 'Tokens')
  .option('-t, --type <type>', 'Type: COLOR, FLOAT, STRING, BOOLEAN (auto-detected if not set)')
  .action((name, value, options) => {
    checkConnection();

    const code = `(async () => {
function hexToRgb(hex) {
  const r = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  if (!r) return null;
  return { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 };
}

const value = '${value}';
let type = '${options.type || ''}';
if (!type) {
  if (value.startsWith('#')) type = 'COLOR';
  else if (!isNaN(parseFloat(value))) type = 'FLOAT';
  else if (value === 'true' || value === 'false') type = 'BOOLEAN';
  else type = 'STRING';
}

const cols = await figma.variables.getLocalVariableCollectionsAsync();
let col = cols.find(c => c.name === '${options.collection}');
if (!col) col = figma.variables.createVariableCollection('${options.collection}');
const modeId = col.modes[0].modeId;

const v = figma.variables.createVariable('${name}', col, type);
let figmaValue = value;
if (type === 'COLOR') figmaValue = hexToRgb(value);
else if (type === 'FLOAT') figmaValue = parseFloat(value);
else if (type === 'BOOLEAN') figmaValue = value === 'true';
v.setValueForMode(modeId, figmaValue);

return 'Created ' + type.toLowerCase() + ' token: ${name}';
})()`;

    try {
      const result = figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      console.log(chalk.green(result?.trim() || `✓ Created token: ${name}`));
    } catch (error) {
      console.log(chalk.red(`✗ Failed to create token: ${name}`));
    }
  });

// ============ CREATE ============

const create = program
  .command('create')
  .description('Create Figma elements');

create
  .command('frame <name>')
  .description('Create a frame')
  .option('-w, --width <n>', 'Width', '100')
  .option('-h, --height <n>', 'Height', '100')
  .option('-x <n>', 'X position')
  .option('-y <n>', 'Y position', '0')
  .option('--fill <color>', 'Fill color (hex or var:name)')
  .option('--radius <n>', 'Corner radius')
  .option('--smart', 'Auto-position to avoid overlaps (default if no -x)')
  .option('-g, --gap <n>', 'Gap for smart positioning', '100')
  .action(async (name, options) => {
    checkConnection();
    const useSmartPos = options.smart || options.x === undefined;
    const usesVars = options.fill && isVarRef(options.fill);

    const fillCode = options.fill ? generateFillCode(options.fill, 'frame') : null;

    let code = `
(async () => {
${usesVars ? varLoadingCode() : ''}
${useSmartPos ? smartPosCode(options.gap) : `const smartX = ${options.x};`}
const frame = figma.createFrame();
frame.name = '${name}';
frame.x = smartX;
frame.y = ${options.y};
frame.resize(${options.width}, ${options.height});
${fillCode ? fillCode.code : ''}
${options.radius ? `frame.cornerRadius = ${options.radius};` : ''}
figma.currentPage.selection = [frame];
return '${name} created at (' + smartX + ', ${options.y})';
})()
`;
    const result = await daemonExec('eval', { code });
    console.log(result);
  });

create
  .command('icon <name>')
  .description('Create an icon from Iconify (e.g., lucide:star, mdi:home) - auto-positions')
  .option('-s, --size <n>', 'Size', '24')
  .option('-c, --color <color>', 'Color (hex or var:name)', '#000000')
  .option('-x <n>', 'X position (auto if not set)')
  .option('-y <n>', 'Y position', '0')
  .option('--spacing <n>', 'Gap from other elements', '100')
  .action(async (name, options) => {
    checkConnection();
    const spinner = ora(`Fetching icon ${name}...`).start();

    try {
      // Parse icon name (prefix:name format)
      const [prefix, iconName] = name.includes(':') ? name.split(':') : ['lucide', name];

      // Fetch SVG from Iconify API (use black for var: refs, actual color otherwise)
      const size = parseInt(options.size) || 24;
      const usesVar = isVarRef(options.color);
      const fetchColor = usesVar ? '#000000' : (options.color || '#000000');
      const url = `https://api.iconify.design/${prefix}/${iconName}.svg?width=${size}&height=${size}&color=${encodeURIComponent(fetchColor)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Icon not found: ${name}`);
      }
      const svgContent = await response.text();

      if (!svgContent.includes('<svg')) {
        throw new Error(`Invalid icon: ${name}`);
      }

      spinner.text = 'Creating in Figma...';

      // Create SVG in Figma via daemon
      const posX = options.x !== undefined ? parseInt(options.x) : null;
      const posY = parseInt(options.y) || 0;
      const spacing = parseInt(options.spacing) || 100;

      // If using var: syntax, we need to bind after creation
      const varName = usesVar ? getVarName(options.color) : null;

      const code = `
(async () => {
  ${usesVar ? varLoadingCode() : ''}

  // Smart positioning
  let x = ${posX};
  if (x === null) {
    x = 0;
    figma.currentPage.children.forEach(n => {
      x = Math.max(x, n.x + (n.width || 0));
    });
    x += ${spacing};
  }

  // Create SVG node
  const node = figma.createNodeFromSvg(${JSON.stringify(svgContent)});
  node.name = "${name}";
  node.x = x;
  node.y = ${posY};

  // Flatten to vector for cleaner result
  let finalNode = node;
  if (node.type === 'FRAME' && node.children.length > 0) {
    finalNode = figma.flatten([node]);
    finalNode.name = "${name}";
  }

  ${usesVar ? `
  // Bind variable to fills
  if ('fills' in finalNode && vars['${varName}']) {
    finalNode.fills = [boundFill(vars['${varName}'])];
  }
  ` : ''}

  return { id: finalNode.id, x: finalNode.x, y: finalNode.y, width: finalNode.width, height: finalNode.height };
})()`;

      const result = await daemonExec('eval', { code });
      spinner.succeed(`Created icon: ${name}`);
      console.log(chalk.gray(`  Position: (${result.x}, ${result.y}), Size: ${result.width}x${result.height}px`));
    } catch (error) {
      spinner.fail('Error creating icon');
      console.error(chalk.red(error.message));
    }
  });

create
  .command('image <url>')
  .description('Create an image from URL (PNG, JPG, GIF, WebP)')
  .option('-w, --width <n>', 'Width (auto if not set)')
  .option('-h, --height <n>', 'Height (auto if not set)')
  .option('-x <n>', 'X position (auto if not set)')
  .option('-y <n>', 'Y position', '0')
  .option('-n, --name <name>', 'Node name', 'Image')
  .option('--spacing <n>', 'Gap from other elements', '100')
  .action(async (url, options) => {
    checkConnection();
    const spinner = ora('Loading image...').start();

    const code = `
(async () => {
  try {
    // Smart positioning
    let smartX = 0;
    if (${options.x === undefined}) {
      figma.currentPage.children.forEach(n => {
        smartX = Math.max(smartX, n.x + (n.width || 0));
      });
      smartX += ${options.spacing || 100};
    } else {
      smartX = ${options.x || 0};
    }

    // Create image from URL
    const image = await figma.createImageAsync("${url}");
    const { width, height } = await image.getSizeAsync();

    // Calculate dimensions
    let w = ${options.width || 'null'};
    let h = ${options.height || 'null'};
    if (w && !h) h = Math.round(height * (w / width));
    if (h && !w) w = Math.round(width * (h / height));
    if (!w && !h) { w = width; h = height; }

    // Create rectangle with image fill
    const rect = figma.createRectangle();
    rect.name = "${options.name}";
    rect.resize(w, h);
    rect.x = smartX;
    rect.y = ${options.y};
    rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];

    figma.currentPage.selection = [rect];
    figma.viewport.scrollAndZoomIntoView([rect]);

    return 'Image created: ' + w + 'x' + h + ' at (' + smartX + ', ${options.y})';
  } catch (e) {
    return 'Error: ' + e.message;
  }
})()
`;

    try {
      const result = figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      spinner.succeed('Image created from URL');
      if (result) console.log(chalk.gray(result.trim()));
    } catch (e) {
      spinner.fail('Failed to create image: ' + e.message);
    }
  });

// ============ SCREENSHOT URL ============

program
  .command('screenshot-url <url>')
  .alias('screenshot')
  .description('Screenshot a website and import into Figma as reference')
  .option('-w, --width <n>', 'Viewport width', '1280')
  .option('-h, --height <n>', 'Viewport height', '800')
  .option('--full', 'Capture full page (not just viewport)')
  .option('-n, --name <name>', 'Node name', 'Screenshot')
  .option('--scale <n>', 'Scale factor (1 or 2 for retina)', '2')
  .action(async (url, options) => {
    checkConnection();

    const spinner = ora('Taking screenshot of ' + url + '...').start();

    try {
      const tempFile = '/tmp/figma-cli-screenshot.png';

      // Build capture-website command
      let cmd = `npx --yes capture-website-cli "${url}" --output="${tempFile}" --width=${options.width} --height=${options.height} --scale-factor=${options.scale}`;
      if (options.full) cmd += ' --full-page';
      cmd += ' --overwrite';

      // Take screenshot
      execSync(cmd, { stdio: 'ignore', timeout: 60000 });

      if (!existsSync(tempFile)) {
        throw new Error('Screenshot failed');
      }

      spinner.text = 'Importing into Figma...';

      // Read as base64
      const buffer = readFileSync(tempFile);
      const base64 = buffer.toString('base64');
      const dataUrl = 'data:image/png;base64,' + base64;

      // Import into Figma with smart positioning
      const code = `
(async () => {
  try {
    // Smart positioning
    let smartX = 0;
    figma.currentPage.children.forEach(n => {
      smartX = Math.max(smartX, n.x + (n.width || 0));
    });
    smartX += 100;

    // Create image from base64
    const image = await figma.createImageAsync("${dataUrl}");
    const { width, height } = await image.getSizeAsync();

    // Create rectangle with image fill
    const rect = figma.createRectangle();
    rect.name = "${options.name} - ${url}";
    rect.resize(width, height);
    rect.x = smartX;
    rect.y = 0;
    rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];

    figma.currentPage.selection = [rect];
    figma.viewport.scrollAndZoomIntoView([rect]);

    return 'Screenshot imported: ' + width + 'x' + height;
  } catch (e) {
    return 'Error: ' + e.message;
  }
})()
`;

      const result = figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
      spinner.succeed('Screenshot imported into Figma');
      if (result) console.log(chalk.gray(result.trim()));

      // Cleanup
      try { unlinkSync(tempFile); } catch {}
    } catch (e) {
      spinner.fail('Failed: ' + e.message);
    }
  });

// ============ ANALYZE URL (Playwright) ============

program
  .command('analyze-url <url>')
  .description('Analyze a webpage with Playwright and extract exact CSS values')
  .option('-w, --width <n>', 'Viewport width', '1440')
  .option('-h, --height <n>', 'Viewport height', '900')
  .option('--screenshot', 'Also save a screenshot')
  .action(async (url, options) => {
    const spinner = ora('Analyzing ' + url + ' with Playwright...').start();

    try {
      // Create analysis script
      const script = `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: ${options.width}, height: ${options.height} } });

  await page.goto('${url}', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const data = await page.evaluate(() => {
    const rgbToHex = (rgb) => {
      if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return 'transparent';
      const match = rgb.match(/\\d+/g);
      if (!match || match.length < 3) return rgb;
      const [r, g, b] = match.map(Number);
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    };

    const getStyles = (el) => {
      const cs = window.getComputedStyle(el);
      return {
        color: rgbToHex(cs.color),
        bgColor: rgbToHex(cs.backgroundColor),
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontFamily: cs.fontFamily.split(',')[0].replace(/"/g, '').trim(),
        borderRadius: cs.borderRadius,
        border: cs.border,
        padding: cs.padding
      };
    };

    const results = {
      url: window.location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyBg: rgbToHex(window.getComputedStyle(document.body).backgroundColor),
      elements: []
    };

    document.querySelectorAll('h1, h2, h3, h4, button, [role="button"], input, label, [class*="btn"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 20 && rect.height > 10 && rect.top < 1200 && rect.top > -50) {
        results.elements.push({
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.placeholder || '').slice(0, 80).trim(),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          ...getStyles(el)
        });
      }
    });

    return results;
  });

  console.log(JSON.stringify(data, null, 2));
  ${options.screenshot ? "await page.screenshot({ path: '/tmp/analyze-screenshot.png' });" : ''}
  await browser.close();
})();
`;

      // Write and run script
      const scriptPath = '/tmp/figma-analyze-url.js';
      writeFileSync(scriptPath, script);

      const result = execSync(`cd /tmp && node figma-analyze-url.js`, {
        encoding: 'utf8',
        timeout: 90000,
        maxBuffer: 10 * 1024 * 1024
      });

      spinner.succeed('Page analyzed');
      console.log(result);

      if (options.screenshot) {
        console.log(chalk.gray('Screenshot saved: /tmp/analyze-screenshot.png'));
      }

      // Cleanup
      try { unlinkSync(scriptPath); } catch {}
    } catch (e) {
      spinner.fail('Analysis failed: ' + e.message);
    }
  });

// ============ RECREATE URL (Playwright + Figma) ============

program
  .command('recreate-url <url>')
  .alias('recreate')
  .description('Analyze a webpage and recreate it in Figma (desktop 1440px)')
  .option('-w, --width <n>', 'Viewport width', '1440')
  .option('-h, --height <n>', 'Viewport height', '900')
  .option('--name <name>', 'Frame name', 'Recreated Page')
  .action(async (url, options) => {
    checkConnection();

    const spinner = ora('Analyzing ' + url + ' with Playwright...').start();

    try {
      // Step 1: Analyze with Playwright
      const analyzeScript = `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: ${options.width}, height: ${options.height} } });

  await page.goto('${url}', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const data = await page.evaluate(() => {
    const rgbToHex = (rgb) => {
      if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return 'transparent';
      const match = rgb.match(/\\d+/g);
      if (!match || match.length < 3) return rgb;
      const [r, g, b] = match.map(Number);
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    };

    const getStyles = (el) => {
      const cs = window.getComputedStyle(el);
      return {
        color: rgbToHex(cs.color),
        bgColor: rgbToHex(cs.backgroundColor),
        fontSize: parseInt(cs.fontSize) || 16,
        fontWeight: parseInt(cs.fontWeight) || 400,
        fontFamily: cs.fontFamily.split(',')[0].replace(/"/g, '').trim(),
        borderRadius: parseInt(cs.borderRadius) || 0,
        borderWidth: parseInt(cs.borderWidth) || 0,
        borderColor: rgbToHex(cs.borderColor),
        paddingTop: parseInt(cs.paddingTop) || 0,
        paddingRight: parseInt(cs.paddingRight) || 0,
        paddingBottom: parseInt(cs.paddingBottom) || 0,
        paddingLeft: parseInt(cs.paddingLeft) || 0
      };
    };

    const results = {
      url: window.location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyBg: rgbToHex(window.getComputedStyle(document.body).backgroundColor),
      elements: []
    };

    // Get headings
    document.querySelectorAll('h1, h2, h3').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 20 && rect.height > 10 && rect.top < 1200 && rect.top > -50) {
        results.elements.push({
          type: 'heading',
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || '').slice(0, 200).trim(),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          ...getStyles(el)
        });
      }
    });

    // Get buttons
    document.querySelectorAll('button, [role="button"], input[type="submit"], a[class*="btn"], [class*="button"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 30 && rect.height > 20 && rect.top < 1200 && rect.top > -50) {
        results.elements.push({
          type: 'button',
          text: (el.innerText || el.value || '').slice(0, 80).trim(),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          ...getStyles(el)
        });
      }
    });

    // Get inputs
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 20 && rect.top < 1200 && rect.top > -50) {
        results.elements.push({
          type: 'input',
          placeholder: el.placeholder || '',
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          ...getStyles(el)
        });
      }
    });

    // Get paragraphs/labels
    document.querySelectorAll('p, label, span').forEach(el => {
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || '').trim();
      if (rect.width > 20 && rect.height > 10 && rect.top < 1200 && rect.top > -50 && text.length > 2 && text.length < 500) {
        results.elements.push({
          type: 'text',
          text: text.slice(0, 200),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          ...getStyles(el)
        });
      }
    });

    return results;
  });

  console.log(JSON.stringify(data));
  await browser.close();
})();
`;

      const scriptPath = '/tmp/figma-recreate-analyze.js';
      writeFileSync(scriptPath, analyzeScript);

      const analysisResult = execSync('cd /tmp && node figma-recreate-analyze.js', {
        encoding: 'utf8',
        timeout: 90000,
        maxBuffer: 10 * 1024 * 1024
      });

      const data = JSON.parse(analysisResult);
      spinner.text = 'Generating Figma code...';

      // Step 2: Generate Figma code
      const hexToRgb = (hex) => {
        if (!hex || hex === 'transparent') return '{ r: 1, g: 1, b: 1 }';
        const h = hex.replace('#', '');
        const r = (parseInt(h.slice(0, 2), 16) / 255).toFixed(3);
        const g = (parseInt(h.slice(2, 4), 16) / 255).toFixed(3);
        const b = (parseInt(h.slice(4, 6), 16) / 255).toFixed(3);
        return `{ r: ${r}, g: ${g}, b: ${b} }`;
      };

      // Normalize font family name (Playwright returns lowercase)
      const normalizeFontFamily = (family) => {
        if (!family) return 'Inter';
        const f = family.toLowerCase();
        if (f.includes('inter')) return 'Inter';
        if (f.includes('roboto')) return 'Roboto';
        if (f.includes('arial')) return 'Arial';
        if (f.includes('helvetica')) return 'Helvetica';
        if (f.includes('georgia')) return 'Georgia';
        if (f.includes('times')) return 'Times New Roman';
        if (f.includes('verdana')) return 'Verdana';
        if (f.includes('open sans')) return 'Open Sans';
        if (f.includes('lato')) return 'Lato';
        if (f.includes('montserrat')) return 'Montserrat';
        if (f.includes('poppins')) return 'Poppins';
        if (f.includes('source sans')) return 'Source Sans Pro';
        // Capitalize first letter of each word
        return family.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      };

      // Get font style based on weight (handles different font naming conventions)
      const getFontStyle = (weight, family) => {
        const w = weight || 400;
        const f = (family || '').toLowerCase();

        // Inter uses "Semi Bold" with space
        if (f.includes('inter')) {
          if (w >= 700) return 'Bold';
          if (w >= 600) return 'Semi Bold';
          if (w >= 500) return 'Medium';
          return 'Regular';
        }

        // Most other fonts use "SemiBold" without space
        if (w >= 700) return 'Bold';
        if (w >= 600) return 'SemiBold';
        if (w >= 500) return 'Medium';
        return 'Regular';
      };

      // Collect unique font family + style combinations
      const fonts = new Set();
      data.elements.forEach(el => {
        const family = normalizeFontFamily(el.fontFamily);
        const style = getFontStyle(el.fontWeight, el.fontFamily);
        fonts.add(JSON.stringify({ family, style }));
      });
      // Always include a fallback
      fonts.add(JSON.stringify({ family: 'Inter', style: 'Regular' }));

      // Build Figma script
      let figmaCode = `(async function() {
  // Font fallback map: requested font → available font
  const fontMap = new Map();
  const fallbackFont = { family: 'Inter', style: 'Regular' };

  // Load font with fallback chain
  const loadFont = async (family, style) => {
    const key = family + '|' + style;

    // Try exact match
    try {
      await figma.loadFontAsync({ family, style });
      fontMap.set(key, { family, style });
      return;
    } catch {}

    // Try Regular style
    try {
      await figma.loadFontAsync({ family, style: 'Regular' });
      fontMap.set(key, { family, style: 'Regular' });
      return;
    } catch {}

    // Fall back to Inter
    await figma.loadFontAsync(fallbackFont);
    fontMap.set(key, fallbackFont);
  };

  // Get available font (with fallback)
  const getFont = (family, style) => {
    const key = family + '|' + style;
    return fontMap.get(key) || fallbackFont;
  };

${[...fonts].map(f => {
  const { family, style } = JSON.parse(f);
  return `  await loadFont("${family}", "${style}");`;
}).join('\n')}

  // Smart positioning
  let smartX = 0;
  figma.currentPage.children.forEach(n => { smartX = Math.max(smartX, n.x + n.width); });
  smartX += 100;

  // Main desktop frame
  const main = figma.createFrame();
  main.name = "${options.name}";
  main.resize(${options.width}, ${options.height});
  main.fills = [{ type: "SOLID", color: ${hexToRgb(data.bodyBg)} }];
  main.x = smartX;
  main.y = 0;
  main.clipsContent = true;

`;

      // Add elements
      data.elements.forEach((el, i) => {
        const fontFamily = normalizeFontFamily(el.fontFamily);
        const fontStyle = getFontStyle(el.fontWeight, el.fontFamily);

        if (el.type === 'heading' || el.type === 'text') {
          const text = (el.text || '').replace(/"/g, '\\"').replace(/\n/g, '\\n');
          if (!text) return;
          figmaCode += `
  // ${el.type}: ${text.slice(0, 30)}
  const t${i} = figma.createText();
  t${i}.fontName = getFont("${fontFamily}", "${fontStyle}");
  t${i}.characters = "${text}";
  t${i}.fontSize = ${el.fontSize || 16};
  t${i}.fills = [{ type: "SOLID", color: ${hexToRgb(el.color)} }];
  t${i}.x = ${el.x};
  t${i}.y = ${el.y};
  main.appendChild(t${i});
`;
        } else if (el.type === 'button') {
          const text = (el.text || '').replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
          if (!text) return;
          figmaCode += `
  // Button: ${text.slice(0, 30)}
  const btn${i} = figma.createFrame();
  btn${i}.name = "${text.slice(0, 20)}";
  btn${i}.resize(${el.w}, ${el.h});
  btn${i}.x = ${el.x};
  btn${i}.y = ${el.y};
  btn${i}.cornerRadius = ${el.borderRadius || 0};
  btn${i}.fills = [{ type: "SOLID", color: ${hexToRgb(el.bgColor)} }];
  ${el.borderWidth > 0 ? `btn${i}.strokes = [{ type: "SOLID", color: ${hexToRgb(el.borderColor)} }]; btn${i}.strokeWeight = ${el.borderWidth};` : ''}
  btn${i}.layoutMode = "HORIZONTAL";
  btn${i}.primaryAxisAlignItems = "CENTER";
  btn${i}.counterAxisAlignItems = "CENTER";
  const btnTxt${i} = figma.createText();
  btnTxt${i}.fontName = getFont("${fontFamily}", "${fontStyle}");
  btnTxt${i}.characters = "${text}";
  btnTxt${i}.fontSize = ${el.fontSize || 14};
  btnTxt${i}.fills = [{ type: "SOLID", color: ${hexToRgb(el.color)} }];
  btn${i}.appendChild(btnTxt${i});
  main.appendChild(btn${i});
`;
        } else if (el.type === 'input') {
          const placeholder = (el.placeholder || 'Enter text...').replace(/"/g, '\\"');
          figmaCode += `
  // Input
  const input${i} = figma.createFrame();
  input${i}.name = "Input";
  input${i}.resize(${el.w}, ${el.h});
  input${i}.x = ${el.x};
  input${i}.y = ${el.y};
  input${i}.cornerRadius = ${el.borderRadius || 4};
  input${i}.fills = [{ type: "SOLID", color: ${hexToRgb(el.bgColor)} }];
  ${el.borderWidth > 0 ? `input${i}.strokes = [{ type: "SOLID", color: ${hexToRgb(el.borderColor)} }]; input${i}.strokeWeight = ${el.borderWidth};` : ''}
  input${i}.layoutMode = "HORIZONTAL";
  input${i}.counterAxisAlignItems = "CENTER";
  input${i}.paddingLeft = ${el.paddingLeft || 12};
  const ph${i} = figma.createText();
  ph${i}.fontName = getFont("${fontFamily}", "Regular");
  ph${i}.characters = "${placeholder}";
  ph${i}.fontSize = ${el.fontSize || 14};
  ph${i}.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
  input${i}.appendChild(ph${i});
  main.appendChild(input${i});
`;
        }
      });

      figmaCode += `
  figma.viewport.scrollAndZoomIntoView([main]);
  return "Recreated ${data.elements.length} elements from ${url}";
})()`;

      // Step 3: Execute via daemon (fast) or direct connection (fallback)
      spinner.text = 'Creating in Figma...';
      await fastEval(figmaCode);

      spinner.succeed('Page recreated in Figma');
      console.log(chalk.green('✓ ') + chalk.white(`Created ${data.elements.length} elements`));
      console.log(chalk.gray(`  Frame: "${options.name}" (${options.width}x${options.height})`));
      console.log(chalk.gray(`  Source: ${url}`));

      // Cleanup
      try { unlinkSync(scriptPath); } catch {}
    } catch (e) {
      spinner.fail('Recreation failed: ' + e.message);
      if (process.env.DEBUG) console.error(e);
    }
  });

// ============ REMOVE BACKGROUND ============

program
  .command('remove-bg [nodeId]')
  .alias('removebg')
  .description('Remove background from selected image (uses remove.bg API)')
  .option('--api-key <key>', 'Remove.bg API key')
  .action(async (nodeId, options) => {
    checkConnection();

    // Get API key from option, env var, or config
    const config = loadConfig();
    const apiKey = options.apiKey || process.env.REMOVEBG_API_KEY || config.removebgApiKey;

    if (!apiKey) {
      console.log(chalk.red('✗ Remove.bg API key required\n'));
      console.log(chalk.white.bold('How to get your API key (free, 50 images/month):\n'));
      console.log(chalk.gray('  1. Go to ') + chalk.cyan('https://www.remove.bg/api'));
      console.log(chalk.gray('  2. Click "Get API Key" and sign up'));
      console.log(chalk.gray('  3. Copy your API key from the dashboard\n'));
      console.log(chalk.white.bold('Then use one of these methods:\n'));
      console.log(chalk.cyan('  Option A: ') + chalk.gray('Save permanently'));
      console.log(chalk.white('    node src/index.js config set removebgApiKey YOUR_KEY\n'));
      console.log(chalk.cyan('  Option B: ') + chalk.gray('Use once'));
      console.log(chalk.white('    node src/index.js remove-bg --api-key YOUR_KEY\n'));
      console.log(chalk.cyan('  Option C: ') + chalk.gray('Environment variable'));
      console.log(chalk.white('    export REMOVEBG_API_KEY=YOUR_KEY'));
      return;
    }

    const spinner = ora('Exporting selected image...').start();

    try {
      const tempInput = '/tmp/figma-cli-removebg-input.png';

      // Export selected node as PNG
      let exportCmd = 'export png --scale 2 --output "' + tempInput + '"';
      if (nodeId) exportCmd += ' --node "' + nodeId + '"';
      const exportResult = figmaUse(exportCmd, { silent: true });

      if (!existsSync(tempInput)) {
        throw new Error('Export failed. Select an image or frame first.');
      }

      spinner.text = 'Removing background via remove.bg...';

      // Read image and send to Remove.bg API
      const imageBuffer = readFileSync(tempInput);
      const base64Image = imageBuffer.toString('base64');

      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_file_b64: base64Image,
          size: 'auto',
          format: 'png',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errorMsg = error.errors?.[0]?.title || 'API request failed';
        if (response.status === 402) {
          throw new Error('API credits exhausted. Get more at remove.bg/api');
        }
        if (response.status === 403) {
          throw new Error('Invalid API key. Check your key at remove.bg/api');
        }
        throw new Error(errorMsg);
      }

      // Get result as base64
      const resultBuffer = Buffer.from(await response.arrayBuffer());
      const resultBase64 = resultBuffer.toString('base64');
      const dataUrl = 'data:image/png;base64,' + resultBase64;

      spinner.text = 'Updating image in Figma...';

      // Replace the selected node's fill with the new image
      const code = `
(async () => {
  try {
    const node = figma.currentPage.selection[0];
    if (!node) return 'Error: No node selected';

    // Create new image from base64
    const image = await figma.createImageAsync("${dataUrl}");

    // Replace fills with new image
    if ('fills' in node) {
      node.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
      return 'Background removed from ' + node.name;
    } else {
      return 'Error: Selected node cannot have image fills';
    }
  } catch (e) {
    return 'Error: ' + e.message;
  }
})()
`;

      const result = figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });

      if (result && result.includes('Error:')) {
        spinner.fail(result.trim());
      } else {
        spinner.succeed('Background removed!');
        if (result) console.log(chalk.gray(result.trim()));
      }

      // Cleanup
      try { unlinkSync(tempInput); } catch {}
    } catch (e) {
      spinner.fail('Failed: ' + e.message);
    }
  });

// ============ CONFIG ============

const configCmd = program
  .command('config')
  .description('Manage configuration');

configCmd
  .command('set <key> <value>')
  .description('Set a config value (e.g., removebgApiKey)')
  .action((key, value) => {
    const config = loadConfig();
    config[key] = value;
    saveConfig(config);
    console.log(chalk.green('✓ Config saved: ') + chalk.gray(key + ' = ' + value.substring(0, 10) + '...'));
  });

configCmd
  .command('get <key>')
  .description('Get a config value')
  .action((key) => {
    const config = loadConfig();
    if (config[key]) {
      console.log(config[key]);
    } else {
      console.log(chalk.gray('Not set'));
    }
  });

create
  .command('rect [name]')
  .alias('rectangle')
  .description('Create a rectangle (auto-positions to avoid overlap)')
  .option('-w, --width <n>', 'Width', '100')
  .option('-h, --height <n>', 'Height', '100')
  .option('-x <n>', 'X position (auto if not set)')
  .option('-y <n>', 'Y position', '0')
  .option('--fill <color>', 'Fill color (hex or var:name)', '#D9D9D9')
  .option('--stroke <color>', 'Stroke color (hex or var:name)')
  .option('--radius <n>', 'Corner radius')
  .option('--opacity <n>', 'Opacity 0-1')
  .action(async (name, options) => {
    checkConnection();
    const rectName = name || 'Rectangle';
    const useSmartPos = options.x === undefined;
    const usesVars = isVarRef(options.fill) || (options.stroke && isVarRef(options.stroke));

    const fillCode = generateFillCode(options.fill, 'rect');
    const strokeCode = options.stroke ? generateStrokeCode(options.stroke, 'rect') : null;

    let code = `
(async () => {
${usesVars ? varLoadingCode() : ''}
${useSmartPos ? smartPosCode(100) : `const smartX = ${options.x};`}
const rect = figma.createRectangle();
rect.name = '${rectName}';
rect.x = smartX;
rect.y = ${options.y};
rect.resize(${options.width}, ${options.height});
${fillCode.code}
${options.radius ? `rect.cornerRadius = ${options.radius};` : ''}
${options.opacity ? `rect.opacity = ${options.opacity};` : ''}
${strokeCode ? strokeCode.code : ''}
figma.currentPage.selection = [rect];
return '${rectName} created at (' + smartX + ', ${options.y})';
})()
`;
    const result = await daemonExec('eval', { code });
    console.log(result);
  });

create
  .command('ellipse [name]')
  .alias('circle')
  .description('Create an ellipse/circle (auto-positions to avoid overlap)')
  .option('-w, --width <n>', 'Width (diameter)', '100')
  .option('-h, --height <n>', 'Height (same as width for circle)')
  .option('-x <n>', 'X position (auto if not set)')
  .option('-y <n>', 'Y position', '0')
  .option('--fill <color>', 'Fill color (hex or var:name)', '#D9D9D9')
  .option('--stroke <color>', 'Stroke color (hex or var:name)')
  .action(async (name, options) => {
    checkConnection();
    const ellipseName = name || 'Ellipse';
    const height = options.height || options.width;
    const useSmartPos = options.x === undefined;
    const usesVars = isVarRef(options.fill) || (options.stroke && isVarRef(options.stroke));

    const fillCode = generateFillCode(options.fill, 'ellipse');
    const strokeCode = options.stroke ? generateStrokeCode(options.stroke, 'ellipse') : null;

    let code = `
(async () => {
${usesVars ? varLoadingCode() : ''}
${useSmartPos ? smartPosCode(100) : `const smartX = ${options.x};`}
const ellipse = figma.createEllipse();
ellipse.name = '${ellipseName}';
ellipse.x = smartX;
ellipse.y = ${options.y};
ellipse.resize(${options.width}, ${height});
${fillCode.code}
${strokeCode ? strokeCode.code : ''}
figma.currentPage.selection = [ellipse];
return '${ellipseName} created at (' + smartX + ', ${options.y})';
})()
`;
    const result = await daemonExec('eval', { code });
    console.log(result);
  });

create
  .command('text <content>')
  .description('Create a text layer (smart positions by default)')
  .option('-x <n>', 'X position (auto if not set)')
  .option('-y <n>', 'Y position', '0')
  .option('-s, --size <n>', 'Font size', '16')
  .option('-c, --color <color>', 'Text color (hex or var:name)', '#000000')
  .option('-w, --weight <weight>', 'Font weight: regular, medium, semibold, bold', 'regular')
  .option('--font <family>', 'Font family', 'Inter')
  .option('--width <n>', 'Text box width (auto-width if not set)')
  .option('--spacing <n>', 'Gap from other elements', '100')
  .action(async (content, options) => {
    checkConnection();
    const weightMap = { regular: 'Regular', medium: 'Medium', semibold: 'Semi Bold', bold: 'Bold' };
    const fontStyle = weightMap[options.weight.toLowerCase()] || 'Regular';
    const useSmartPos = options.x === undefined;
    const usesVars = isVarRef(options.color);

    const fillCode = generateFillCode(options.color, 'text');

    let code = `
(async function() {
  ${usesVars ? varLoadingCode() : ''}
  ${useSmartPos ? smartPosCode(options.spacing) : `const smartX = ${options.x};`}
  await figma.loadFontAsync({ family: '${options.font}', style: '${fontStyle}' });
  const text = figma.createText();
  text.fontName = { family: '${options.font}', style: '${fontStyle}' };
  text.characters = '${content.replace(/'/g, "\\'")}';
  text.fontSize = ${options.size};
  ${fillCode.code}
  text.x = smartX;
  text.y = ${options.y};
  ${options.width ? `text.resize(${options.width}, text.height); text.textAutoResize = 'HEIGHT';` : ''}
  figma.currentPage.selection = [text];
  return 'Text created at (' + smartX + ', ${options.y})';
})()
`;
    const result = await daemonExec('eval', { code });
    console.log(result);
  });

create
  .command('line')
  .description('Create a line (smart positions by default)')
  .option('--x1 <n>', 'Start X (auto if not set)')
  .option('--y1 <n>', 'Start Y', '0')
  .option('--x2 <n>', 'End X (auto + length if x1 not set)')
  .option('--y2 <n>', 'End Y', '0')
  .option('-l, --length <n>', 'Line length', '100')
  .option('-c, --color <color>', 'Line color (hex or var:name)', '#000000')
  .option('-w, --weight <n>', 'Stroke weight', '1')
  .option('--spacing <n>', 'Gap from other elements', '100')
  .action(async (options) => {
    checkConnection();
    const useSmartPos = options.x1 === undefined;
    const lineLength = parseFloat(options.length);
    const usesVars = isVarRef(options.color);

    const strokeCode = generateStrokeCode(options.color, 'line', options.weight);

    let code = `
(async () => {
${usesVars ? varLoadingCode() : ''}
${useSmartPos ? smartPosCode(options.spacing) : `const smartX = ${options.x1};`}
const line = figma.createLine();
line.x = smartX;
line.y = ${options.y1};
line.resize(${useSmartPos ? lineLength : `Math.abs(${options.x2 || options.x1 + '+' + lineLength} - ${options.x1}) || ${lineLength}`}, 0);
${options.x2 && options.x1 ? `line.rotation = Math.atan2(${options.y2} - ${options.y1}, ${options.x2} - ${options.x1}) * 180 / Math.PI;` : ''}
${strokeCode.code}
figma.currentPage.selection = [line];
return 'Line created at (' + smartX + ', ${options.y1}) with length ${lineLength}';
})()
`;
    const result = await daemonExec('eval', { code });
    console.log(result);
  });

create
  .command('component [name]')
  .description('Convert selection to component')
  .action((name) => {
    checkConnection();
    const compName = name || 'Component';
    let code = `
const sel = figma.currentPage.selection;
if (sel.length === 0) 'No selection';
else if (sel.length === 1) {
  const comp = figma.createComponentFromNode(sel[0]);
  comp.name = '${compName}';
  figma.currentPage.selection = [comp];
  'Component created: ' + comp.name;
} else {
  const group = figma.group(sel, figma.currentPage);
  const comp = figma.createComponentFromNode(group);
  comp.name = '${compName}';
  figma.currentPage.selection = [comp];
  'Component created from ' + sel.length + ' elements: ' + comp.name;
}
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

create
  .command('group [name]')
  .description('Group current selection')
  .action((name) => {
    checkConnection();
    const groupName = name || 'Group';
    let code = `
const sel = figma.currentPage.selection;
if (sel.length < 2) 'Select 2+ elements to group';
else {
  const group = figma.group(sel, figma.currentPage);
  group.name = '${groupName}';
  figma.currentPage.selection = [group];
  'Grouped ' + sel.length + ' elements';
}
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

create
  .command('autolayout [name]')
  .alias('al')
  .description('Create an auto-layout frame (smart positions by default)')
  .option('-d, --direction <dir>', 'Direction: row, col', 'row')
  .option('-g, --gap <n>', 'Gap between items', '8')
  .option('-p, --padding <n>', 'Padding', '16')
  .option('-x <n>', 'X position (auto if not set)')
  .option('-y <n>', 'Y position', '0')
  .option('--fill <color>', 'Fill color (hex or var:name)')
  .option('--radius <n>', 'Corner radius')
  .option('--spacing <n>', 'Gap from other elements', '100')
  .action(async (name, options) => {
    checkConnection();
    const frameName = name || 'Auto Layout';
    const layoutMode = options.direction === 'col' ? 'VERTICAL' : 'HORIZONTAL';
    const useSmartPos = options.x === undefined;
    const usesVars = options.fill && isVarRef(options.fill);

    const fillCode = options.fill ? generateFillCode(options.fill, 'frame') : null;

    let code = `
(async () => {
${usesVars ? varLoadingCode() : ''}
${useSmartPos ? smartPosCode(options.spacing) : `const smartX = ${options.x};`}
const frame = figma.createFrame();
frame.name = '${frameName}';
frame.x = smartX;
frame.y = ${options.y};
frame.layoutMode = '${layoutMode}';
frame.primaryAxisSizingMode = 'AUTO';
frame.counterAxisSizingMode = 'AUTO';
frame.itemSpacing = ${options.gap};
frame.paddingTop = ${options.padding};
frame.paddingRight = ${options.padding};
frame.paddingBottom = ${options.padding};
frame.paddingLeft = ${options.padding};
${fillCode ? fillCode.code : 'frame.fills = [];'}
${options.radius ? `frame.cornerRadius = ${options.radius};` : ''}
figma.currentPage.selection = [frame];
return 'Auto-layout frame created at (' + smartX + ', ${options.y})';
})()
`;
    const result = await daemonExec('eval', { code });
    console.log(result);
  });

// ============ CANVAS ============

const canvas = program
  .command('canvas')
  .description('Canvas awareness and smart positioning');

canvas
  .command('info')
  .description('Show canvas info (bounds, element count, free space)')
  .action(() => {
    checkConnection();
    let code = `(function() {
const children = figma.currentPage.children;
if (children.length === 0) {
  return JSON.stringify({ empty: true, message: 'Canvas is empty', nextX: 0, nextY: 0 });
} else {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  children.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  });
  return JSON.stringify({
    elements: children.length,
    bounds: { x: Math.round(minX), y: Math.round(minY), width: Math.round(maxX - minX), height: Math.round(maxY - minY) },
    nextX: Math.round(maxX + 100),
    nextY: 0,
    frames: children.filter(n => n.type === 'FRAME').length,
    components: children.filter(n => n.type === 'COMPONENT').length
  }, null, 2);
}
})()`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

canvas
  .command('next')
  .description('Get next free position on canvas (no overlap)')
  .option('-g, --gap <n>', 'Gap from existing elements', '100')
  .option('-d, --direction <dir>', 'Direction: right, below', 'right')
  .action((options) => {
    checkConnection();
    let code = `
const children = figma.currentPage.children;
const gap = ${options.gap};
if (children.length === 0) {
  JSON.stringify({ x: 0, y: 0 });
} else {
  ${options.direction === 'below' ? `
  let maxY = -Infinity;
  children.forEach(n => { maxY = Math.max(maxY, n.y + n.height); });
  JSON.stringify({ x: 0, y: Math.round(maxY + gap) });
  ` : `
  let maxX = -Infinity;
  children.forEach(n => { maxX = Math.max(maxX, n.x + n.width); });
  JSON.stringify({ x: Math.round(maxX + gap), y: 0 });
  `}
}
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

// ============ BIND (Variables) ============

const bind = program
  .command('bind')
  .description('Bind variables to node properties');

bind
  .command('fill <varName>')
  .description('Bind color variable to fill')
  .option('-n, --node <id>', 'Node ID (uses selection if not set)')
  .action((varName, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;
    let code = `(async () => {
${nodeSelector}
const vars = await figma.variables.getLocalVariablesAsync();
const v = vars.find(v => v.name === '${varName}' || v.name.endsWith('/${varName}'));
if (!v) return 'Variable not found: ${varName}';
if (nodes.length === 0) return 'No node selected';
nodes.forEach(n => {
  if ('fills' in n && n.fills.length > 0) {
    const newFill = figma.variables.setBoundVariableForPaint(n.fills[0], 'color', v);
    n.fills = [newFill];
  }
});
return 'Bound ' + v.name + ' to fill on ' + nodes.length + ' elements';
})()`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

bind
  .command('stroke <varName>')
  .description('Bind color variable to stroke')
  .option('-n, --node <id>', 'Node ID')
  .action((varName, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;
    let code = `(async () => {
${nodeSelector}
const vars = await figma.variables.getLocalVariablesAsync();
const v = vars.find(v => v.name === '${varName}' || v.name.endsWith('/${varName}'));
if (!v) return 'Variable not found: ${varName}';
if (nodes.length === 0) return 'No node selected';
nodes.forEach(n => {
  if ('strokes' in n) {
    const stroke = n.strokes[0] || { type: 'SOLID', color: {r:0,g:0,b:0} };
    const newStroke = figma.variables.setBoundVariableForPaint(stroke, 'color', v);
    n.strokes = [newStroke];
  }
});
return 'Bound ' + v.name + ' to stroke on ' + nodes.length + ' elements';
})()`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

bind
  .command('radius <varName>')
  .description('Bind number variable to corner radius')
  .option('-n, --node <id>', 'Node ID')
  .action((varName, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;
    let code = `(async () => {
${nodeSelector}
const vars = await figma.variables.getLocalVariablesAsync();
const v = vars.find(v => v.name === '${varName}' || v.name.endsWith('/${varName}'));
if (!v) return 'Variable not found: ${varName}';
if (nodes.length === 0) return 'No node selected';
nodes.forEach(n => {
  if ('cornerRadius' in n) n.setBoundVariable('cornerRadius', v);
});
return 'Bound ' + v.name + ' to radius on ' + nodes.length + ' elements';
})()`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

bind
  .command('gap <varName>')
  .description('Bind number variable to auto-layout gap')
  .option('-n, --node <id>', 'Node ID')
  .action((varName, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;
    let code = `(async () => {
${nodeSelector}
const vars = await figma.variables.getLocalVariablesAsync();
const v = vars.find(v => v.name === '${varName}' || v.name.endsWith('/${varName}'));
if (!v) return 'Variable not found: ${varName}';
if (nodes.length === 0) return 'No node selected';
nodes.forEach(n => {
  if ('itemSpacing' in n) n.setBoundVariable('itemSpacing', v);
});
return 'Bound ' + v.name + ' to gap on ' + nodes.length + ' elements';
})()`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

bind
  .command('padding <varName>')
  .description('Bind number variable to padding')
  .option('-n, --node <id>', 'Node ID')
  .option('-s, --side <side>', 'Side: top, right, bottom, left, all', 'all')
  .action((varName, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;
    const sides = options.side === 'all'
      ? ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
      : [`padding${options.side.charAt(0).toUpperCase() + options.side.slice(1)}`];
    let code = `(async () => {
${nodeSelector}
const vars = await figma.variables.getLocalVariablesAsync();
const v = vars.find(v => v.name === '${varName}' || v.name.endsWith('/${varName}'));
if (!v) return 'Variable not found: ${varName}';
if (nodes.length === 0) return 'No node selected';
const sides = ${JSON.stringify(sides)};
nodes.forEach(n => {
  sides.forEach(side => { if (side in n) n.setBoundVariable(side, v); });
});
return 'Bound ' + v.name + ' to padding on ' + nodes.length + ' elements';
})()`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

bind
  .command('list')
  .description('List available variables for binding')
  .option('-t, --type <type>', 'Filter: COLOR, FLOAT')
  .action((options) => {
    checkConnection();
    let code = `(async () => {
const vars = await figma.variables.getLocalVariablesAsync();
const filtered = vars${options.type ? `.filter(v => v.resolvedType === '${options.type.toUpperCase()}')` : ''};
return filtered.map(v => v.resolvedType.padEnd(8) + ' ' + v.name).join('\\n') || 'No variables';
})()`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

// ============ SIZING ============

const sizing = program
  .command('sizing')
  .description('Control sizing in auto-layout');

sizing
  .command('hug')
  .description('Set to hug contents')
  .option('-a, --axis <axis>', 'Axis: both, h, v', 'both')
  .action((options) => {
    checkConnection();
    let code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => {
    ${options.axis === 'h' || options.axis === 'both' ? `if ('layoutSizingHorizontal' in n) n.layoutSizingHorizontal = 'HUG';` : ''}
    ${options.axis === 'v' || options.axis === 'both' ? `if ('layoutSizingVertical' in n) n.layoutSizingVertical = 'HUG';` : ''}
    if (n.layoutMode) { n.primaryAxisSizingMode = 'AUTO'; n.counterAxisSizingMode = 'AUTO'; }
  });
  'Set hug on ' + nodes.length + ' elements';
}
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

sizing
  .command('fill')
  .description('Set to fill container')
  .option('-a, --axis <axis>', 'Axis: both, h, v', 'both')
  .action((options) => {
    checkConnection();
    let code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => {
    ${options.axis === 'h' || options.axis === 'both' ? `if ('layoutSizingHorizontal' in n) n.layoutSizingHorizontal = 'FILL';` : ''}
    ${options.axis === 'v' || options.axis === 'both' ? `if ('layoutSizingVertical' in n) n.layoutSizingVertical = 'FILL';` : ''}
  });
  'Set fill on ' + nodes.length + ' elements';
}
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

sizing
  .command('fixed <width> [height]')
  .description('Set to fixed size')
  .action((width, height) => {
    checkConnection();
    const h = height || width;
    let code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => {
    if ('layoutSizingHorizontal' in n) n.layoutSizingHorizontal = 'FIXED';
    if ('layoutSizingVertical' in n) n.layoutSizingVertical = 'FIXED';
    if ('resize' in n) n.resize(${width}, ${h});
  });
  'Set fixed ${width}x${h} on ' + nodes.length + ' elements';
}
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

// ============ LAYOUT SHORTCUTS ============

program
  .command('padding <value> [r] [b] [l]')
  .alias('pad')
  .description('Set padding (CSS-style: 1-4 values)')
  .action((value, r, b, l) => {
    checkConnection();
    let top = value, right = r || value, bottom = b || value, left = l || r || value;
    if (!r) { right = value; bottom = value; left = value; }
    else if (!b) { bottom = value; left = r; }
    else if (!l) { left = r; }
    let code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => {
    if ('paddingTop' in n) {
      n.paddingTop = ${top}; n.paddingRight = ${right};
      n.paddingBottom = ${bottom}; n.paddingLeft = ${left};
    }
  });
  'Set padding on ' + nodes.length + ' elements';
}
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

program
  .command('gap <value>')
  .description('Set auto-layout gap')
  .action((value) => {
    checkConnection();
    let code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => { if ('itemSpacing' in n) n.itemSpacing = ${value}; });
  'Set gap ${value} on ' + nodes.length + ' elements';
}
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

program
  .command('align <alignment>')
  .description('Align items: start, center, end, stretch')
  .action((alignment) => {
    checkConnection();
    const map = { start: 'MIN', center: 'CENTER', end: 'MAX', stretch: 'STRETCH' };
    const val = map[alignment.toLowerCase()] || 'CENTER';
    let code = `
const nodes = figma.currentPage.selection;
if (nodes.length === 0) 'No selection';
else {
  nodes.forEach(n => {
    if ('primaryAxisAlignItems' in n) n.primaryAxisAlignItems = '${val}';
    if ('counterAxisAlignItems' in n) n.counterAxisAlignItems = '${val}';
  });
  'Aligned ' + nodes.length + ' elements to ${alignment}';
}
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

// ============ SELECT ============

program
  .command('select <nodeId>')
  .description('Select a node by ID')
  .action((nodeId) => {
    checkConnection();
    figmaUse(`select "${nodeId}"`);
  });

// ============ DELETE ============

program
  .command('delete [nodeId]')
  .alias('remove')
  .description('Delete node by ID or current selection')
  .action((nodeId) => {
    checkConnection();
    if (nodeId) {
      let code = `(async () => {
const node = await figma.getNodeByIdAsync('${nodeId}');
if (node) { node.remove(); return 'Deleted: ${nodeId}'; } else { return 'Node not found: ${nodeId}'; }
})()`;
      figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
    } else {
      let code = `
const sel = figma.currentPage.selection;
if (sel.length === 0) 'No selection';
else { const count = sel.length; sel.forEach(n => n.remove()); 'Deleted ' + count + ' elements'; }
`;
      figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
    }
  });

// ============ DUPLICATE ============

program
  .command('duplicate [nodeId]')
  .alias('dup')
  .description('Duplicate node by ID or current selection')
  .option('--offset <n>', 'Offset from original', '20')
  .action((nodeId, options) => {
    checkConnection();
    if (nodeId) {
      let code = `(async () => {
const node = await figma.getNodeByIdAsync('${nodeId}');
if (node) { const clone = node.clone(); clone.x += ${options.offset}; clone.y += ${options.offset}; figma.currentPage.selection = [clone]; return 'Duplicated: ' + clone.id; } else { return 'Node not found'; }
})()`;
      figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
    } else {
      let code = `
const sel = figma.currentPage.selection;
if (sel.length === 0) 'No selection';
else { const clones = sel.map(n => { const c = n.clone(); c.x += ${options.offset}; c.y += ${options.offset}; return c; }); figma.currentPage.selection = clones; 'Duplicated ' + clones.length + ' elements'; }
`;
      figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
    }
  });

// ============ SET ============

const set = program
  .command('set')
  .description('Set properties on selection or node');

set
  .command('fill <color>')
  .description('Set fill color (hex or var:name)')
  .option('-n, --node <id>', 'Node ID (uses selection if not set)')
  .action(async (color, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;

    let code;
    if (color.startsWith('var:')) {
      // Variable binding
      const varName = color.slice(4);
      code = `(async () => {
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        let variable = null;
        for (const col of collections) {
          for (const id of col.variableIds) {
            const v = await figma.variables.getVariableByIdAsync(id);
            if (v && v.name === '${varName}') { variable = v; break; }
          }
          if (variable) break;
        }
        if (!variable) return 'Variable ${varName} not found';
        ${nodeSelector}
        if (nodes.length === 0) return 'No node found';
        const boundFill = (v) => figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }, 'color', v);
        nodes.forEach(n => { if ('fills' in n) n.fills = [boundFill(variable)]; });
        return 'Bound ' + variable.name + ' to fill on ' + nodes.length + ' elements';
      })()`;
      const result = await daemonExec('eval', { code });
      console.log(chalk.green('✓ ' + (result || 'Done')));
    } else {
      // Hex color
      const { r, g, b } = hexToRgb(color);
      code = `(async () => {
        ${nodeSelector}
        if (nodes.length === 0) return 'No node found';
        nodes.forEach(n => { if ('fills' in n) n.fills = [{ type: 'SOLID', color: { r: ${r}, g: ${g}, b: ${b} } }]; });
        return 'Fill set on ' + nodes.length + ' elements';
      })()`;
      figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
    }
  });

set
  .command('stroke <color>')
  .description('Set stroke color (hex or var:name)')
  .option('-n, --node <id>', 'Node ID')
  .option('-w, --weight <n>', 'Stroke weight', '1')
  .action(async (color, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;

    let code;
    if (color.startsWith('var:')) {
      // Variable binding
      const varName = color.slice(4);
      code = `(async () => {
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        let variable = null;
        for (const col of collections) {
          for (const id of col.variableIds) {
            const v = await figma.variables.getVariableByIdAsync(id);
            if (v && v.name === '${varName}') { variable = v; break; }
          }
          if (variable) break;
        }
        if (!variable) return 'Variable ${varName} not found';
        ${nodeSelector}
        if (nodes.length === 0) return 'No node found';
        const boundFill = (v) => figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }, 'color', v);
        nodes.forEach(n => { if ('strokes' in n) { n.strokes = [boundFill(variable)]; n.strokeWeight = ${options.weight}; } });
        return 'Bound ' + variable.name + ' to stroke on ' + nodes.length + ' elements';
      })()`;
      const result = await daemonExec('eval', { code });
      console.log(chalk.green('✓ ' + (result || 'Done')));
    } else {
      // Hex color
      const { r, g, b } = hexToRgb(color);
      code = `(async () => {
        ${nodeSelector}
        if (nodes.length === 0) return 'No node found';
        nodes.forEach(n => { if ('strokes' in n) { n.strokes = [{ type: 'SOLID', color: { r: ${r}, g: ${g}, b: ${b} } }]; n.strokeWeight = ${options.weight}; } });
        return 'Stroke set on ' + nodes.length + ' elements';
      })()`;
      figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
    }
  });

set
  .command('radius <value>')
  .description('Set corner radius')
  .option('-n, --node <id>', 'Node ID')
  .action((value, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;
    let code = `
${nodeSelector}
if (nodes.length === 0) 'No node found';
else { nodes.forEach(n => { if ('cornerRadius' in n) n.cornerRadius = ${value}; }); 'Radius set on ' + nodes.length + ' elements'; }
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

set
  .command('size <width> <height>')
  .description('Set size')
  .option('-n, --node <id>', 'Node ID')
  .action((width, height, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;
    let code = `
${nodeSelector}
if (nodes.length === 0) 'No node found';
else { nodes.forEach(n => { if ('resize' in n) n.resize(${width}, ${height}); }); 'Size set on ' + nodes.length + ' elements'; }
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

set
  .command('pos <x> <y>')
  .alias('position')
  .description('Set position')
  .option('-n, --node <id>', 'Node ID')
  .action((x, y, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;
    let code = `
${nodeSelector}
if (nodes.length === 0) 'No node found';
else { nodes.forEach(n => { n.x = ${x}; n.y = ${y}; }); 'Position set on ' + nodes.length + ' elements'; }
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

set
  .command('opacity <value>')
  .description('Set opacity (0-1)')
  .option('-n, --node <id>', 'Node ID')
  .action((value, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;
    let code = `
${nodeSelector}
if (nodes.length === 0) 'No node found';
else { nodes.forEach(n => { if ('opacity' in n) n.opacity = ${value}; }); 'Opacity set on ' + nodes.length + ' elements'; }
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

set
  .command('name <name>')
  .description('Rename node')
  .option('-n, --node <id>', 'Node ID')
  .action((name, options) => {
    checkConnection();
    const nodeSelector = options.node
      ? `const node = await figma.getNodeByIdAsync('${options.node}'); const nodes = node ? [node] : [];`
      : `const nodes = figma.currentPage.selection;`;
    let code = `
${nodeSelector}
if (nodes.length === 0) 'No node found';
else { nodes.forEach(n => { n.name = '${name}'; }); 'Renamed ' + nodes.length + ' elements to ${name}'; }
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

set
  .command('autolayout <direction>')
  .alias('al')
  .description('Apply auto-layout to selection (row/col)')
  .option('-g, --gap <n>', 'Gap between items', '8')
  .option('-p, --padding <n>', 'Padding')
  .action((direction, options) => {
    checkConnection();
    const layoutMode = direction === 'col' || direction === 'vertical' ? 'VERTICAL' : 'HORIZONTAL';
    let code = `
const sel = figma.currentPage.selection;
if (sel.length === 0) 'No selection';
else {
  sel.forEach(n => {
    if (n.type === 'FRAME' || n.type === 'COMPONENT') {
      n.layoutMode = '${layoutMode}';
      n.primaryAxisSizingMode = 'AUTO';
      n.counterAxisSizingMode = 'AUTO';
      n.itemSpacing = ${options.gap};
      ${options.padding ? `n.paddingTop = n.paddingRight = n.paddingBottom = n.paddingLeft = ${options.padding};` : ''}
    }
  });
  'Auto-layout applied to ' + sel.length + ' frames';
}
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

// ============ ARRANGE ============

program
  .command('arrange')
  .description('Arrange frames on canvas')
  .option('-g, --gap <n>', 'Gap between frames', '100')
  .option('-c, --cols <n>', 'Number of columns (0 = single row)', '0')
  .action((options) => {
    checkConnection();
    let code = `
const frames = figma.currentPage.children.filter(n => n.type === 'FRAME' || n.type === 'COMPONENT');
if (frames.length === 0) 'No frames to arrange';
else {
  frames.sort((a, b) => a.name.localeCompare(b.name));
  let x = 0, y = 0, rowHeight = 0, col = 0;
  const gap = ${options.gap};
  const cols = ${options.cols};
  frames.forEach((f, i) => {
    f.x = x;
    f.y = y;
    rowHeight = Math.max(rowHeight, f.height);
    if (cols > 0 && ++col >= cols) {
      col = 0;
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    } else {
      x += f.width + gap;
    }
  });
  'Arranged ' + frames.length + ' frames';
}
`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

// ============ GET ============

program
  .command('get [nodeId]')
  .description('Get properties of node or selection')
  .action((nodeId) => {
    checkConnection();
    const nodeSelector = nodeId
      ? `const node = await figma.getNodeByIdAsync('${nodeId}');`
      : `const node = figma.currentPage.selection[0];`;
    let code = `(async () => {
${nodeSelector}
if (!node) return 'No node found';
return JSON.stringify({
  id: node.id,
  name: node.name,
  type: node.type,
  x: node.x,
  y: node.y,
  width: node.width,
  height: node.height,
  visible: node.visible,
  locked: node.locked,
  opacity: node.opacity,
  rotation: node.rotation,
  cornerRadius: node.cornerRadius,
  layoutMode: node.layoutMode,
  fills: node.fills?.length,
  strokes: node.strokes?.length,
  children: node.children?.length
}, null, 2);
})()`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

// ============ FIND ============

program
  .command('find <name>')
  .description('Find nodes by name (partial match)')
  .option('-t, --type <type>', 'Filter by type (FRAME, TEXT, RECTANGLE, etc.)')
  .option('-l, --limit <n>', 'Limit results', '20')
  .action((name, options) => {
    checkConnection();
    let code = `(function() {
const results = [];
function search(node) {
  if (node.name && node.name.toLowerCase().includes('${name.toLowerCase()}')) {
    ${options.type ? `if (node.type === '${options.type.toUpperCase()}')` : ''}
    results.push({ id: node.id, name: node.name, type: node.type });
  }
  if (node.children && results.length < ${options.limit}) {
    node.children.forEach(search);
  }
}
search(figma.currentPage);
return results.length === 0 ? 'No nodes found matching "${name}"' : results.slice(0, ${options.limit}).map(r => r.id + ' [' + r.type + '] ' + r.name).join('\\n');
})()`;
    figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: false });
  });

// ============ RENDER ============

// Helper: Get next free X position for smart positioning (horizontal)
function getNextFreeX(gap = 100) {
  try {
    const result = figmaEvalSync(`(function() {
      let maxX = 0;
      figma.currentPage.children.forEach(n => {
        maxX = Math.max(maxX, n.x + n.width);
      });
      return maxX;
    })()`);
    return (result || 0) + gap;
  } catch {
    return 0;
  }
}

// Helper: Get next free Y position for smart positioning (vertical)
function getNextFreeY(gap = 100) {
  try {
    const result = figmaEvalSync(`(function() {
      let maxY = 0;
      figma.currentPage.children.forEach(n => {
        maxY = Math.max(maxY, n.y + n.height);
      });
      return maxY;
    })()`);
    return (result || 0) + gap;
  } catch {
    return 0;
  }
}

// Helper: Extract properties that figma-use doesn't handle correctly
// Returns array of fixes to apply after render
function extractPostProcessFixes(jsx) {
  const fixes = [];

  // Match ALL Frame elements with wrapGap (counterAxisSpacing) - including nested
  const wrapGapRegex = /<Frame[^>]*\bwrapGap=\{(\d+)\}[^>]*>/g;
  let wrapMatch;
  while ((wrapMatch = wrapGapRegex.exec(jsx)) !== null) {
    const tag = wrapMatch[0];
    const nameMatch = tag.match(/\bname=["']([^"']+)["']/);
    fixes.push({
      type: 'wrapGap',
      name: nameMatch ? nameMatch[1] : null,
      value: parseInt(wrapMatch[1])
    });
  }

  // Match absolute positioned children with x/y
  const absRegex = /<Frame[^>]*\bposition=["']absolute["'][^>]*>/g;
  let match;
  while ((match = absRegex.exec(jsx)) !== null) {
    const tag = match[0];
    const nameMatch = tag.match(/\bname=["']([^"']+)["']/);
    const xMatch = tag.match(/\bx=\{(\d+)\}/);
    const yMatch = tag.match(/\by=\{(\d+)\}/);

    if (nameMatch && (xMatch || yMatch)) {
      fixes.push({
        type: 'absolutePosition',
        name: nameMatch[1],
        x: xMatch ? parseInt(xMatch[1]) : null,
        y: yMatch ? parseInt(yMatch[1]) : null
      });
    }
  }

  return fixes;
}

// Helper: Apply post-process fixes to rendered node
async function applyPostProcessFixes(nodeId, fixes) {
  const code = `(async function() {
    const root = await figma.getNodeByIdAsync('${nodeId}');
    if (!root) return { error: 'Node not found' };

    const results = [];

    // Helper to find node by name recursively
    const findByName = (node, name) => {
      if (node.name === name) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findByName(child, name);
          if (found) return found;
        }
      }
      return null;
    };

    // Helper to find all nodes with layoutWrap
    const findAllWrap = (node, results = []) => {
      if (node.layoutWrap === 'WRAP') results.push(node);
      if (node.children) {
        for (const child of node.children) {
          findAllWrap(child, results);
        }
      }
      return results;
    };

    ${fixes.map((fix, i) => {
      if (fix.type === 'wrapGap') {
        if (fix.name) {
          // Named element - find by name
          return `
            // Fix wrapGap for "${fix.name}"
            const wrapNode${i} = findByName(root, '${fix.name}');
            if (wrapNode${i} && wrapNode${i}.layoutWrap === 'WRAP') {
              wrapNode${i}.counterAxisSpacing = ${fix.value};
              results.push({ type: 'wrapGap', name: '${fix.name}', value: ${fix.value}, applied: true });
            }
          `;
        } else {
          // No name - apply to first wrap element (root or first found)
          return `
            // Fix wrapGap on first wrap element
            const wrapNodes${i} = findAllWrap(root);
            if (wrapNodes${i}.length > 0) {
              wrapNodes${i}[0].counterAxisSpacing = ${fix.value};
              results.push({ type: 'wrapGap', value: ${fix.value}, applied: true });
            }
          `;
        }
      } else if (fix.type === 'absolutePosition') {
        return `
          // Fix absolute position for "${fix.name}"
          const absNode${i} = findByName(root, '${fix.name}');
          if (absNode${i} && absNode${i}.layoutPositioning === 'ABSOLUTE') {
            ${fix.x !== null ? `absNode${i}.x = ${fix.x};` : ''}
            ${fix.y !== null ? `absNode${i}.y = ${fix.y};` : ''}
            results.push({ type: 'absolutePosition', name: '${fix.name}', x: ${fix.x}, y: ${fix.y}, applied: true });
          }
        `;
      }
      return '';
    }).join('\n')}

    return { fixes: results };
  })()`;

  try {
    if (isDaemonRunning()) {
      await daemonExec('eval', { code });
    } else {
      figmaEvalSync(code);
    }
  } catch (e) {
    // Silent fail - fixes are best-effort
  }
}

// Fast JSX parser for simple frames (daemon-based, 4x faster)
function parseSimpleJsx(jsx) {
  // Only handles single Frame element, no nesting
  const frameMatch = jsx.match(/^<Frame\s+([^>]+)\s*\/?>(?:<\/Frame>)?$/);
  if (!frameMatch) return null;

  const propsStr = frameMatch[1];
  const props = {};

  // Parse props: name="X" or name={X} or name='X'
  const propRegex = /(\w+)=(?:\{([^}]+)\}|"([^"]+)"|'([^']+)')/g;
  let match;
  while ((match = propRegex.exec(propsStr)) !== null) {
    const key = match[1];
    const value = match[2] || match[3] || match[4];
    props[key] = value;
  }

  return props;
}

function generateFigmaCode(props, x, y) {
  const name = props.name || 'Frame';
  const w = parseInt(props.w || props.width || 100);
  const h = parseInt(props.h || props.height || 100);
  const bg = props.bg || props.fill;
  const rounded = parseInt(props.rounded || props.cornerRadius || 0);
  const opacity = props.opacity ? parseFloat(props.opacity) : null;

  let code = `(function() {
    const f = figma.createFrame();
    f.name = '${name}';
    f.resize(${w}, ${h});
    f.x = ${x};
    f.y = ${y};`;

  if (rounded > 0) code += `\n    f.cornerRadius = ${rounded};`;
  if (opacity !== null) code += `\n    f.opacity = ${opacity};`;

  if (bg) {
    // Parse hex color
    const hex = bg.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    code += `\n    f.fills = [{type:'SOLID', color:{r:${r.toFixed(3)},g:${g.toFixed(3)},b:${b.toFixed(3)}}}];`;
  }

  code += `\n    return { id: f.id, name: f.name };
  })()`;

  return code;
}

program
  .command('render <jsx>')
  .description('Render JSX to Figma (uses figma-use render)')
  .option('--parent <id>', 'Parent node ID')
  .option('-x <n>', 'X position')
  .option('-y <n>', 'Y position')
  .option('--no-smart-position', 'Disable auto-positioning')
  .option('--fast', 'Use fast daemon-based rendering (simple frames only)')
  .action(async (jsx, options) => {
    await checkConnection();
    try {
      // Calculate smart position if not specified
      let posX = options.x;
      let posY = options.y !== undefined ? options.y : 0;

      if (!options.parent && options.x === undefined && options.smartPosition !== false) {
        posX = getNextFreeX();
      }

      // Check if JSX uses variable syntax (var:name) - use our own renderer
      if (jsx.includes('var:')) {
        const { FigmaClient } = await import('./figma-client.js');
        const client = new FigmaClient();
        const code = client.parseJSX(jsx);
        const result = await daemonExec('eval', { code });
        if (result && result.id) {
          console.log(chalk.green('✓ Rendered: ' + result.id));
          if (result.name) console.log(chalk.gray('  name: ' + result.name));
          return;
        }
      }

      // Try fast path for simple frames
      if (options.fast || (!jsx.includes('><') && !jsx.includes('</Frame><'))) {
        const simpleProps = parseSimpleJsx(jsx.trim());
        if (simpleProps && isDaemonRunning()) {
          const code = generateFigmaCode(simpleProps, posX || 0, posY);
          const result = await daemonExec('eval', { code });
          if (result && result.id) {
            console.log(chalk.green('✓ Rendered: ' + result.id));
            if (result.name) console.log(chalk.gray('  name: ' + result.name));
            return;
          }
        }
      }

      // Extract props that figma-use doesn't handle correctly
      const postProcessFixes = extractPostProcessFixes(jsx);

      // Use figma-use render directly - it has full JSX support
      let cmd = 'figma-use render --stdin --json';
      if (options.parent) cmd += ` --parent "${options.parent}"`;
      if (posX !== undefined) cmd += ` --x ${posX}`;
      cmd += ` --y ${posY}`;

      const output = execSync(cmd, {
        input: jsx,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000
      });

      const result = JSON.parse(output.trim());
      console.log(chalk.green('✓ Rendered: ' + result.id));
      if (result.name) console.log(chalk.gray('  name: ' + result.name));

      // Post-process to fix properties figma-use doesn't set correctly
      if (postProcessFixes.length > 0) {
        await applyPostProcessFixes(result.id, postProcessFixes);
      }
    } catch (e) {
      console.log(chalk.red('✗ Render failed: ' + (e.stderr || e.message)));
    }
  });

program
  .command('render-batch')
  .description('Render multiple JSX frames in a single fast operation')
  .argument('<jsxArray>', 'JSON array of JSX strings, e.g. \'["<Frame>...</Frame>","<Frame>...</Frame>"]\'')
  .option('-g, --gap <n>', 'Gap between frames', '40')
  .option('-d, --direction <dir>', 'Layout direction: row (horizontal) or col (vertical)', 'row')
  .action(async (jsxArrayStr, options) => {
    await checkConnection();
    try {
      const jsxArray = JSON.parse(jsxArrayStr);
      if (!Array.isArray(jsxArray)) {
        throw new Error('Argument must be a JSON array of JSX strings');
      }

      const gap = parseInt(options.gap) || 40;
      const vertical = options.direction === 'col' || options.direction === 'column' || options.direction === 'vertical';
      const startX = vertical ? 100 : getNextFreeX(gap);
      const startY = vertical ? getNextFreeY(gap) : 100;

      // Parse all JSX to code blocks
      const { FigmaClient } = await import('./figma-client.js');
      const parser = new FigmaClient();

      // Parse each JSX and wrap to capture result
      const codeBlocks = jsxArray.map(jsx => {
        const code = parser.parseJSX(jsx);
        // Wrap the IIFE to capture result, replace smart positioning
        return code
          .replace(/let smartX[\s\S]*?smartX = Math\.round\(maxRight \+ 100\);\s*\}\s*/, '')
          .replace(/frame\.x = smartX;/, 'frame.x = currentX;')
          .replace(/frame\.y = 0;/, 'frame.y = currentY;');
      });

      // Build single eval that creates all frames
      const batchCode = `(async () => {
        await figma.loadFontAsync({family:"Inter",style:"Regular"});
        await figma.loadFontAsync({family:"Inter",style:"Medium"});
        await figma.loadFontAsync({family:"Inter",style:"Semi Bold"});
        await figma.loadFontAsync({family:"Inter",style:"Bold"});

        const results = [];
        let currentX = ${startX}, currentY = ${startY};
        const gap = ${gap};
        const vertical = ${vertical};

        ${codeBlocks.map((code, i) => `
        // Frame ${i + 1}
        {
          const frameResult = await (async function() {
            ${code.replace(/^\s*\(async function\(\) \{/, '').replace(/\}\)\(\)\s*$/, '')}
          })();
          if (frameResult) {
            const frame = await figma.getNodeByIdAsync(frameResult.id);
            if (frame) {
              frame.x = currentX;
              frame.y = currentY;
              results.push({ id: frame.id, name: frame.name });
              if (vertical) currentY += frame.height + gap;
              else currentX += frame.width + gap;
            }
          }
        }
        `).join('\n')}

        return results;
      })()`;

      const results = await fastEval(batchCode);

      if (Array.isArray(results)) {
        results.forEach(r => {
          console.log(chalk.green('✓ Rendered: ' + r.id + (r.name ? ' (' + r.name + ')' : '')));
        });
        console.log(chalk.cyan(`\n${results.length} frames created`));
      }
    } catch (e) {
      console.log(chalk.red('✗ Batch render failed: ' + e.message));
    }
  });

// ============ EXPORT ============

const exp = program
  .command('export')
  .description('Export from Figma');

exp
  .command('screenshot')
  .description('Take a screenshot')
  .option('-o, --output <file>', 'Output file', 'screenshot.png')
  .action((options) => {
    checkConnection();
    figmaUse(`export screenshot --output "${options.output}"`);
  });

exp
  .command('node <nodeId>')
  .description('Export a node by ID as PNG')
  .option('-o, --output <file>', 'Output file', 'node-export.png')
  .option('-s, --scale <number>', 'Export scale', '2')
  .option('-f, --format <format>', 'Format: png, svg, pdf, jpg', 'png')
  .action((nodeId, options) => {
    checkConnection();
    const format = options.format.toUpperCase();
    const scale = parseFloat(options.scale);
    const code = `(async () => {
const node = await figma.getNodeByIdAsync('${nodeId}');
if (!node) return { error: 'Node not found: ${nodeId}' };
if (!('exportAsync' in node)) return { error: 'Node cannot be exported' };
const bytes = await node.exportAsync({ format: '${format}', constraint: { type: 'SCALE', value: ${scale} } });
return {
  name: node.name,
  id: node.id,
  width: node.width,
  height: node.height,
  bytes: Array.from(bytes)
};
})()`;
    const result = figmaEvalSync(code);
    if (result.error) {
      console.error(chalk.red('✗'), result.error);
      process.exit(1);
    }
    const buffer = Buffer.from(result.bytes);
    const outputFile = options.output === 'node-export.png' && format !== 'PNG'
      ? `node-export.${format.toLowerCase()}`
      : options.output;
    writeFileSync(outputFile, buffer);
    console.log(chalk.green('✓'), `Exported ${result.name} (${result.width}x${result.height}) to ${outputFile}`);
  });

exp
  .command('css')
  .description('Export variables as CSS custom properties')
  .action(() => {
    checkConnection();
    const code = `(async () => {
const vars = await figma.variables.getLocalVariablesAsync();
const css = vars.map(v => {
  const val = Object.values(v.valuesByMode)[0];
  if (v.resolvedType === 'COLOR') {
    const hex = '#' + [val.r, val.g, val.b].map(n => Math.round(n*255).toString(16).padStart(2,'0')).join('');
    return '  --' + v.name.replace(/\\//g, '-') + ': ' + hex + ';';
  }
  return '  --' + v.name.replace(/\\//g, '-') + ': ' + val + (v.resolvedType === 'FLOAT' ? 'px' : '') + ';';
}).join('\\n');
return ':root {\\n' + css + '\\n}';
})()`;
    const result = figmaUse(`eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { silent: true });
    console.log(result);
  });

// ============ EVAL ============

program
  .command('eval [code]')
  .description('Execute JavaScript in Figma plugin context')
  .option('-f, --file <path>', 'Run code from file instead of argument')
  .action(async (code, options) => {
    checkConnection();
    let jsCode = code;

    // If --file option provided, read code from file
    if (options.file) {
      if (!existsSync(options.file)) {
        console.log(chalk.red('✗ File not found: ' + options.file));
        return;
      }
      jsCode = readFileSync(options.file, 'utf8');
    }

    if (!jsCode) {
      console.log(chalk.red('✗ No code provided. Use: eval "code" or eval --file /path/to/script.js'));
      return;
    }

    // Use async daemon for file-based execution (more reliable for long scripts)
    if (options.file && isDaemonRunning()) {
      try {
        const result = await daemonExec('eval', { code: jsCode });
        if (result !== undefined && result !== null) {
          console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
        }
        return;
      } catch (e) {
        // Fall through to sync path
      }
    }

    // Sync path for inline code or fallback
    try {
      const result = figmaEvalSync(jsCode);
      if (result !== undefined && result !== null) {
        console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
      }
    } catch (error) {
      console.log(chalk.red('✗ ' + error.message));
    }
  });

// Run command - alias for eval --file (uses async for better performance)
program
  .command('run <file>')
  .description('Run JavaScript file in Figma (alias for eval --file)')
  .action(async (file) => {
    checkConnection();
    if (!existsSync(file)) {
      console.log(chalk.red('✗ File not found: ' + file));
      return;
    }
    const code = readFileSync(file, 'utf8');
    try {
      // Use async daemon path for better performance with long scripts
      if (isDaemonRunning()) {
        const result = await daemonExec('eval', { code });
        if (result !== undefined) {
          console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
        }
      } else {
        // Fallback to sync path
        figmaUse(`eval "${code.replace(/"/g, '\\"')}"`);
      }
    } catch (e) {
      console.log(chalk.red('✗ ' + e.message));
    }
  });

// ============ PASSTHROUGH ============

program
  .command('raw <command...>')
  .description('Run raw figma-use command')
  .action((command) => {
    checkConnection();
    figmaUse(command.join(' '));
  });

// ============ DESIGN ANALYSIS (figma-use) ============

program
  .command('lint')
  .description('Lint design for issues (figma-use)')
  .option('--fix', 'Auto-fix issues where possible')
  .option('--rule <rule>', 'Run specific rule (can be repeated)', (val, prev) => prev ? [...prev, val] : [val])
  .option('--preset <preset>', 'Preset: recommended, strict, accessibility, design-system')
  .option('--json', 'Output as JSON')
  .action((options) => {
    checkConnection();
    let cmd = 'npx figma-use lint';
    if (options.fix) cmd += ' --fix';
    if (options.rule) options.rule.forEach(r => cmd += ` --rule ${r}`);
    if (options.preset) cmd += ` --preset ${options.preset}`;
    if (options.json) cmd += ' --json';
    runFigmaUse(cmd);
  });

const analyze = program
  .command('analyze')
  .description('Analyze design (colors, typography, spacing, clusters)');

analyze
  .command('colors')
  .description('Analyze color usage')
  .option('--json', 'Output as JSON')
  .action((options) => {
    checkConnection();
    let cmd = 'npx figma-use analyze colors';
    if (options.json) cmd += ' --json';
    runFigmaUse(cmd);
  });

analyze
  .command('typography')
  .alias('type')
  .description('Analyze typography usage')
  .option('--json', 'Output as JSON')
  .action((options) => {
    checkConnection();
    let cmd = 'npx figma-use analyze typography';
    if (options.json) cmd += ' --json';
    runFigmaUse(cmd);
  });

analyze
  .command('spacing')
  .description('Analyze spacing (gap/padding) usage')
  .option('--json', 'Output as JSON')
  .action((options) => {
    checkConnection();
    let cmd = 'npx figma-use analyze spacing';
    if (options.json) cmd += ' --json';
    runFigmaUse(cmd);
  });

analyze
  .command('clusters')
  .description('Find repeated patterns (potential components)')
  .option('--json', 'Output as JSON')
  .action((options) => {
    checkConnection();
    let cmd = 'npx figma-use analyze clusters';
    if (options.json) cmd += ' --json';
    runFigmaUse(cmd);
  });

// ============ NODE OPERATIONS (figma-use) ============

const node = program
  .command('node')
  .description('Node operations (tree, bindings, to-component)');

node
  .command('tree [nodeId]')
  .description('Show node tree structure')
  .option('-d, --depth <n>', 'Max depth', '3')
  .action((nodeId, options) => {
    checkConnection();
    let cmd = 'npx figma-use node tree';
    if (nodeId) cmd += ` "${nodeId}"`;
    cmd += ` --depth ${options.depth}`;
    runFigmaUse(cmd);
  });

node
  .command('bindings [nodeId]')
  .description('Show variable bindings for node')
  .action((nodeId) => {
    checkConnection();
    let cmd = 'npx figma-use node bindings';
    if (nodeId) cmd += ` "${nodeId}"`;
    runFigmaUse(cmd);
  });

node
  .command('to-component <nodeIds...>')
  .description('Convert frames to components')
  .action((nodeIds) => {
    checkConnection();
    const cmd = `npx figma-use node to-component "${nodeIds.join(' ')}"`;
    runFigmaUse(cmd);
  });

node
  .command('delete <nodeIds...>')
  .description('Delete nodes by ID')
  .action((nodeIds) => {
    checkConnection();
    const cmd = `npx figma-use node delete "${nodeIds.join(' ')}"`;
    runFigmaUse(cmd);
  });

// ============ SLOT OPERATIONS ============

const slot = program
  .command('slot')
  .description('Slot operations (create, list, add, reset, clear)');

slot
  .command('create <componentId> <frameId> <name>')
  .description('Convert a frame inside a component to a slot')
  .option('--description <text>', 'Slot description')
  .action(async (componentId, frameId, name, options) => {
    checkConnection();
    const code = `
(function() {
  const comp = figma.getNodeById(${JSON.stringify(componentId)});
  if (!comp || comp.type !== 'COMPONENT') return JSON.stringify({ error: 'Component not found' });
  const frame = figma.getNodeById(${JSON.stringify(frameId)});
  if (!frame) return JSON.stringify({ error: 'Frame not found' });

  function isDescendant(node, ancestor) {
    let current = node.parent;
    while (current) {
      if (current.id === ancestor.id) return true;
      current = current.parent;
    }
    return false;
  }
  if (frame.parent?.id !== comp.id && !isDescendant(frame, comp)) return JSON.stringify({ error: 'Frame is not inside the component' });

  const propName = ${JSON.stringify(name)};
  comp.addComponentProperty(propName, 'CHILDREN', '');

  const props = comp.componentPropertyDefinitions;
  let slotKey = null;
  for (const [key, def] of Object.entries(props)) {
    if (def.type === 'CHILDREN' && key.startsWith(propName)) {
      slotKey = key;
      break;
    }
  }

  if (slotKey) {
    frame.componentPropertyReferences = { ...frame.componentPropertyReferences, children: slotKey };
  }

  return JSON.stringify({ success: true, slotProperty: slotKey || propName });
})()`;
    const raw = await daemonExec('eval', { code });
    const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (result?.error) {
      console.log(chalk.red('\n\u2717 ' + result.error + '\n'));
    } else {
      console.log(chalk.green('\n\u2713 Slot "' + name + '" created'));
      console.log(chalk.gray('  Component: ' + componentId));
      console.log(chalk.gray('  Slot frame: ' + frameId));
      console.log(chalk.gray('  Property: ' + (result?.slotProperty || name) + '\n'));
    }
  });

slot
  .command('list <nodeId>')
  .description('List slot properties on a component or instance')
  .action(async (nodeId) => {
    checkConnection();
    const code = `
(function() {
  const node = figma.getNodeById(${JSON.stringify(nodeId)});
  if (!node) return JSON.stringify({ error: 'Node not found' });

  const props = node.type === 'COMPONENT'
    ? node.componentPropertyDefinitions
    : (node.type === 'INSTANCE' ? node.componentProperties : null);

  if (!props) return JSON.stringify({ error: 'Node is not a component or instance' });

  const slots = [];
  for (const [key, def] of Object.entries(props)) {
    if (def.type === 'CHILDREN') {
      slots.push({
        key: key,
        name: key.split('#')[0],
        type: 'CHILDREN',
        preferredValues: def.preferredValues || []
      });
    }
  }
  return JSON.stringify({ name: node.name, slots });
})()`;
    const raw = await daemonExec('eval', { code });
    const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (result?.error) {
      console.log(chalk.red('\n\u2717 ' + result.error + '\n'));
    } else if (result?.slots?.length === 0) {
      console.log(chalk.yellow('\n  No slots found on ' + (result?.name || nodeId) + '\n'));
    } else {
      console.log(chalk.cyan('\n  Slots on ' + (result?.name || nodeId) + ':'));
      for (const s of result.slots) {
        console.log(chalk.white('    \u2022 ' + s.name) + chalk.gray(' (' + s.key + ')'));
        if (s.preferredValues?.length > 0) {
          console.log(chalk.gray('      Preferred: ' + s.preferredValues.map(v => v.key || v).join(', ')));
        }
      }
      console.log();
    }
  });

slot
  .command('add <instanceId> <slotFrameId> <contentNodeId>')
  .description('Add content to a slot in an instance')
  .action(async (instanceId, slotFrameId, contentNodeId) => {
    checkConnection();
    const code = `
(function() {
  const instance = figma.getNodeById(${JSON.stringify(instanceId)});
  if (!instance || instance.type !== 'INSTANCE') return JSON.stringify({ error: 'Instance not found' });
  const slot = figma.getNodeById(${JSON.stringify(slotFrameId)});
  if (!slot) return JSON.stringify({ error: 'Slot frame not found' });
  const content = figma.getNodeById(${JSON.stringify(contentNodeId)});
  if (!content) return JSON.stringify({ error: 'Content node not found' });

  slot.appendChild(content);
  return JSON.stringify({ success: true });
})()`;
    const raw = await daemonExec('eval', { code });
    const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (result?.error) {
      console.log(chalk.red('\n\u2717 ' + result.error + '\n'));
    } else {
      console.log(chalk.green('\n\u2713 Content added to slot'));
      console.log(chalk.gray('  Instance: ' + instanceId));
      console.log(chalk.gray('  Slot: ' + slotFrameId + '\n'));
    }
  });

slot
  .command('reset <instanceId> <slotFrameId>')
  .description('Reset a slot to default content')
  .action(async (instanceId, slotFrameId) => {
    checkConnection();
    const code = `
(function() {
  const instance = figma.getNodeById(${JSON.stringify(instanceId)});
  if (!instance || instance.type !== 'INSTANCE') return JSON.stringify({ error: 'Instance not found' });
  const slot = figma.getNodeById(${JSON.stringify(slotFrameId)});
  if (!slot) return JSON.stringify({ error: 'Slot frame not found' });

  if (slot.resetOverrides) slot.resetOverrides();
  return JSON.stringify({ success: true });
})()`;
    const raw = await daemonExec('eval', { code });
    const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (result?.error) {
      console.log(chalk.red('\n\u2717 ' + result.error + '\n'));
    } else {
      console.log(chalk.green('\n\u2713 Slot reset to default\n'));
    }
  });

slot
  .command('clear <instanceId> <slotFrameId>')
  .description('Clear all content from a slot')
  .action(async (instanceId, slotFrameId) => {
    checkConnection();
    const code = `
(function() {
  const instance = figma.getNodeById(${JSON.stringify(instanceId)});
  if (!instance || instance.type !== 'INSTANCE') return JSON.stringify({ error: 'Instance not found' });
  const slot = figma.getNodeById(${JSON.stringify(slotFrameId)});
  if (!slot) return JSON.stringify({ error: 'Slot frame not found' });

  while (slot.children && slot.children.length > 0) {
    slot.children[0].remove();
  }
  return JSON.stringify({ success: true });
})()`;
    const raw = await daemonExec('eval', { code });
    const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (result?.error) {
      console.log(chalk.red('\n\u2717 ' + result.error + '\n'));
    } else {
      console.log(chalk.green('\n\u2713 Slot cleared\n'));
    }
  });

// ============ EXPORT (figma-use) ============

program
  .command('export-jsx [nodeId]')
  .description('Export node as JSX/React code')
  .option('-o, --output <file>', 'Output file (otherwise stdout)')
  .option('--pretty', 'Format output')
  .option('--match-icons', 'Match vectors to Iconify icons')
  .action((nodeId, options) => {
    checkConnection();
    let cmd = 'npx figma-use export jsx';
    if (nodeId) cmd += ` "${nodeId}"`;
    if (options.pretty) cmd += ' --pretty';
    if (options.matchIcons) cmd += ' --match-icons';
    if (options.output) {
      cmd += ` > "${options.output}"`;
      runFigmaUse(cmd, { stdio: 'inherit' });
    } else {
      runFigmaUse(cmd);
    }
  });

program
  .command('export-storybook [nodeId]')
  .description('Export components as Storybook stories')
  .option('-o, --output <file>', 'Output file (otherwise stdout)')
  .action((nodeId, options) => {
    checkConnection();
    let cmd = 'npx figma-use export storybook';
    if (nodeId) cmd += ` "${nodeId}"`;
    if (options.output) {
      cmd += ` > "${options.output}"`;
      runFigmaUse(cmd, { stdio: 'inherit' });
    } else {
      runFigmaUse(cmd);
    }
  });

// ============ FIGJAM ============

const figjam = program
  .command('figjam')
  .alias('fj')
  .description('FigJam commands (sticky notes, shapes, connectors)');

// Helper: Get FigJam client
async function getFigJamClient(pageTitle) {
  const client = new FigJamClient();
  try {
    const pages = await FigJamClient.listPages();
    if (pages.length === 0) {
      console.log(chalk.red('\n✗ No FigJam pages open\n'));
      console.log(chalk.gray('  Open a FigJam file in Figma Desktop first.\n'));
      process.exit(1);
    }

    const targetPage = pageTitle || pages[0].title;
    await client.connect(targetPage);
    return client;
  } catch (error) {
    console.log(chalk.red('\n✗ ' + error.message + '\n'));
    process.exit(1);
  }
}

figjam
  .command('list')
  .description('List open FigJam pages')
  .action(async () => {
    try {
      const pages = await FigJamClient.listPages();
      if (pages.length === 0) {
        console.log(chalk.yellow('\n  No FigJam pages open\n'));
        return;
      }
      console.log(chalk.cyan('\n  Open FigJam Pages:\n'));
      pages.forEach((p, i) => {
        console.log(chalk.white(`  ${i + 1}. ${p.title}`));
      });
      console.log();
    } catch (error) {
      console.log(chalk.red('\n✗ Could not connect to Figma\n'));
      console.log(chalk.gray('  Make sure Figma is running with: outsystems-figma-cli connect\n'));
    }
  });

figjam
  .command('info')
  .description('Show current FigJam page info')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (options) => {
    const client = await getFigJamClient(options.page);
    try {
      const info = await client.getPageInfo();
      console.log(chalk.cyan('\n  FigJam Page Info:\n'));
      console.log(chalk.white(`  Name: ${info.name}`));
      console.log(chalk.white(`  ID: ${info.id}`));
      console.log(chalk.white(`  Elements: ${info.childCount}`));
      console.log();
    } finally {
      client.close();
    }
  });

figjam
  .command('nodes')
  .description('List nodes on current FigJam page')
  .option('-p, --page <title>', 'Page title (partial match)')
  .option('-l, --limit <n>', 'Limit number of nodes', '20')
  .action(async (options) => {
    const client = await getFigJamClient(options.page);
    try {
      const nodes = await client.listNodes(parseInt(options.limit));
      if (nodes.length === 0) {
        console.log(chalk.yellow('\n  No elements on this page\n'));
        return;
      }
      console.log(chalk.cyan('\n  FigJam Elements:\n'));
      nodes.forEach(n => {
        const type = n.type.padEnd(16);
        const name = (n.name || '(unnamed)').substring(0, 30);
        console.log(chalk.gray(`  ${n.id.padEnd(8)}`), chalk.white(type), chalk.gray(name), chalk.gray(`(${n.x}, ${n.y})`));
      });
      console.log();
    } finally {
      client.close();
    }
  });

figjam
  .command('sticky <text>')
  .description('Create a sticky note')
  .option('-p, --page <title>', 'Page title (partial match)')
  .option('-x <n>', 'X position', '0')
  .option('-y <n>', 'Y position', '0')
  .option('-c, --color <hex>', 'Background color')
  .action(async (text, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Creating sticky note...').start();
    try {
      const result = await client.createSticky(text, parseFloat(options.x), parseFloat(options.y), options.color);
      spinner.succeed(`Sticky created: ${result.id} at (${result.x}, ${result.y})`);
    } catch (error) {
      spinner.fail('Failed to create sticky: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('shape <text>')
  .description('Create a shape with text')
  .option('-p, --page <title>', 'Page title (partial match)')
  .option('-x <n>', 'X position', '0')
  .option('-y <n>', 'Y position', '0')
  .option('-w, --width <n>', 'Width', '200')
  .option('-h, --height <n>', 'Height', '100')
  .option('-t, --type <type>', 'Shape type (ROUNDED_RECTANGLE, RECTANGLE, ELLIPSE, DIAMOND)', 'ROUNDED_RECTANGLE')
  .action(async (text, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Creating shape...').start();
    try {
      const result = await client.createShape(
        text,
        parseFloat(options.x),
        parseFloat(options.y),
        parseFloat(options.width),
        parseFloat(options.height),
        options.type
      );
      spinner.succeed(`Shape created: ${result.id} at (${result.x}, ${result.y})`);
    } catch (error) {
      spinner.fail('Failed to create shape: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('text <content>')
  .description('Create a text node')
  .option('-p, --page <title>', 'Page title (partial match)')
  .option('-x <n>', 'X position', '0')
  .option('-y <n>', 'Y position', '0')
  .option('-s, --size <n>', 'Font size', '16')
  .action(async (content, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Creating text...').start();
    try {
      const result = await client.createText(content, parseFloat(options.x), parseFloat(options.y), parseFloat(options.size));
      spinner.succeed(`Text created: ${result.id} at (${result.x}, ${result.y})`);
    } catch (error) {
      spinner.fail('Failed to create text: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('connect <startId> <endId>')
  .description('Create a connector between two nodes')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (startId, endId, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Creating connector...').start();
    try {
      const result = await client.createConnector(startId, endId);
      if (result.error) {
        spinner.fail(result.error);
      } else {
        spinner.succeed(`Connector created: ${result.id}`);
      }
    } catch (error) {
      spinner.fail('Failed to create connector: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('delete <nodeId>')
  .description('Delete a node by ID')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (nodeId, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Deleting node...').start();
    try {
      const result = await client.deleteNode(nodeId);
      if (result.deleted) {
        spinner.succeed(`Node ${nodeId} deleted`);
      } else {
        spinner.fail(result.error || 'Node not found');
      }
    } catch (error) {
      spinner.fail('Failed to delete node: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('move <nodeId> <x> <y>')
  .description('Move a node to a new position')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (nodeId, x, y, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Moving node...').start();
    try {
      const result = await client.moveNode(nodeId, parseFloat(x), parseFloat(y));
      if (result.error) {
        spinner.fail(result.error);
      } else {
        spinner.succeed(`Node ${result.id} moved to (${result.x}, ${result.y})`);
      }
    } catch (error) {
      spinner.fail('Failed to move node: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('update <nodeId> <text>')
  .description('Update text content of a node')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (nodeId, text, options) => {
    const client = await getFigJamClient(options.page);
    const spinner = ora('Updating text...').start();
    try {
      const result = await client.updateText(nodeId, text);
      if (result.error) {
        spinner.fail(result.error);
      } else {
        spinner.succeed(`Node ${result.id} text updated`);
      }
    } catch (error) {
      spinner.fail('Failed to update text: ' + error.message);
    } finally {
      client.close();
    }
  });

figjam
  .command('eval <code>')
  .description('Execute JavaScript in FigJam context')
  .option('-p, --page <title>', 'Page title (partial match)')
  .action(async (code, options) => {
    const client = await getFigJamClient(options.page);
    try {
      const result = await client.eval(code);
      if (result !== undefined) {
        console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
      }
    } catch (error) {
      console.log(chalk.red('Error: ' + error.message));
    } finally {
      client.close();
    }
  });

// List open Figma design files (used by fig-start script)
program
  .command('files')
  .description('List open Figma design files as JSON')
  .action(async () => {
    try {
      const pages = await FigmaClient.listPages();
      // Filter to actual design/board files only (exclude blobs, webpack, feed, tabs)
      const designFiles = pages.filter(p =>
        p.url && (p.url.includes('/design/') || p.url.includes('/board/'))
      );
      console.log(JSON.stringify(designFiles));
    } catch (error) {
      console.error(JSON.stringify({ error: error.message }));
      process.exit(1);
    }
  });

program.parse();
