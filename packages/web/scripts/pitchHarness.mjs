// §8.5 headless-Chrome verification harness for the pitch-judging feature
// (see docs/pitch-detection-spec.md §8.5 and docs/native-pitch-spec.md §7).
//
// Self-contained: builds the web package, serves dist/ on a free port via
// vite preview, launches headless Chrome with an oscillator-backed
// getUserMedia and a stubbed Math.random (every generated note becomes
// G3 = 196 Hz, so targets are deterministic), drives the app over CDP, and
// cleans up after itself. No npm dependencies beyond the repo's Node version.
//
// Run on demand — it is deliberately not part of `npm test` (it takes ~40 s
// wall-clock and synchronizes to real 60 BPM beats):
//
//   npm run verify:pitch -w @musicalflashcards/web
//
// Env:
//   CHROME_PATH  Chrome binary (default: the standard macOS install path)
//   APP_URL      test an already-running server instead of building + serving
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const GREEN = '#15803d'; // correct
const RED = '#dc2626'; // wrong / restViolated
const AMBER = '#d97706'; // wrongOctave
const GRAY = '#9ca3af'; // missed
const BLUE = '#2563eb'; // practice cursor

const INJECTED = `(() => {
  Math.random = () => 0; // every generated note = range low (G3, 196 Hz)
  let ctx = null, osc = null, gain = null, dest = null;
  const ensure = () => {
    if (ctx !== null) return;
    ctx = new AudioContext({ sampleRate: 48000 });
    osc = new OscillatorNode(ctx, { frequency: 196 });
    gain = new GainNode(ctx, { gain: 0 });
    dest = ctx.createMediaStreamDestination();
    osc.connect(gain); gain.connect(dest);
    osc.start();
  };
  window.__test = {
    setFreq: (f) => { ensure(); osc.frequency.value = f; },
    setGain: (g) => { ensure(); gain.gain.value = g; },
  };
  navigator.mediaDevices.getUserMedia = async () => {
    ensure();
    await ctx.resume();
    return dest.stream;
  };
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const results = [];
const pass = (label) => { results.push([true, label]); console.log(`  PASS  ${label}`); };
const fail = (label, detail) => {
  results.push([false, label]);
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
};

// --- build + serve -----------------------------------------------------------
const runBuild = () =>
  new Promise((resolve, reject) => {
    const build = spawn('npm', ['run', 'build'], { cwd: WEB_ROOT, stdio: 'inherit' });
    build.on('error', reject);
    build.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`npm run build exited with ${code}`)),
    );
  });

// vite's bin is spawned directly (not via npm run) so that killing the child
// actually stops the server rather than orphaning a grandchild
const spawnPreview = (port) => {
  const requireFromWeb = createRequire(join(WEB_ROOT, 'package.json'));
  const viteBin = join(dirname(requireFromWeb.resolve('vite/package.json')), 'bin', 'vite.js');
  return spawn(
    process.execPath,
    [viteBin, 'preview', '--port', String(port), '--strictPort'],
    { cwd: WEB_ROOT, stdio: 'ignore' },
  );
};

const waitForServer = async (url) => {
  for (let i = 0; i < 75; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  throw new Error(`preview server never came up at ${url}`);
};

// --- minimal CDP client --------------------------------------------------------
let ws;
let msgId = 0;
const pending = new Map();

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const connect = async (debugPort) => {
  let targets;
  for (let i = 0; i < 50; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      break;
    } catch {
      await sleep(200);
    }
  }
  if (!targets) throw new Error('could not reach Chrome remote-debugging endpoint');
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
};

const evalJS = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(`page exception: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  }
  return r.result.value;
};

const waitFor = async (expr, timeoutMs, label, intervalMs = 40) => {
  const t0 = Date.now();
  for (;;) {
    const v = await evalJS(expr);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for: ${label}`);
    await sleep(intervalMs);
  }
};

// --- page expressions ------------------------------------------------------------
const BEAT = `(document.querySelector('#visual-metronome .show-beat')?.textContent ?? '').trim()`;
const count = (color) => `document.querySelectorAll('#output svg [fill="${color}"]').length`;
const has = (color) => `${count(color)} > 0`;
const READOUT = `(document.querySelector('.live-readout')?.textContent ?? '')`;

const waitForBeat = (n, timeoutMs = 5000) =>
  waitFor(`${BEAT} === '${n}'`, timeoutMs, `beat ${n}`, 25);

const setGain = (g) => evalJS(`window.__test.setGain(${g})`);
const setFreq = (f) => evalJS(`window.__test.setFreq(${f})`);

// --- the checks --------------------------------------------------------------------
const run = async (appUrl) => {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: INJECTED });
  await send('Page.navigate', { url: appUrl });
  await waitFor(`!!document.querySelector('#listen-toggle')`, 10000, 'app mounted');

  // Listen toggle on
  await evalJS(`document.querySelector('#listen-toggle').click()`);
  await waitFor(
    `document.querySelector('#listen-toggle').classList.contains('listening')`,
    5000,
    'listening state',
  );
  pass('Listen toggle enters listening state (fake mic granted)');

  // live readout: silent = em dash, 196 Hz = G3
  await waitFor(`${READOUT} === '—'`, 2000, 'readout em dash');
  await setGain(0.25);
  await waitFor(`${READOUT} === 'G3'`, 3000, 'readout G3');
  pass('Live readout shows G3 at 196 Hz (em dash while silent)');
  await setGain(0);
  await waitFor(`${READOUT} === '—'`, 2000, 'readout back to em dash');

  // sync to a fresh bar so the readout strike's verdicts are gone
  await waitForBeat(1);
  await waitForBeat(2);

  // tempo: correct goes green during its own beat (note window = beat 4)
  await waitForBeat(4);
  await setGain(0.25);
  await waitFor(has(GREEN), 900, 'green during beat 4', 25);
  const beatAtGreen = await evalJS(BEAT);
  if (beatAtGreen === '4') pass('Tempo: correct note turns green during its own beat');
  else fail('Tempo: correct note turns green during its own beat', `beat was ${beatAtGreen}`);
  await waitForBeat(1);
  await setGain(0);

  // tempo: strike during a rest -> rest glyph red; then silent note window ->
  // gray "missed" persisting through the wrap holdover
  await waitForBeat(2);
  await setGain(0.25);
  await waitFor(has(RED), 900, 'red rest during beat 2/3', 25);
  const beatAtRed = await evalJS(BEAT);
  if (beatAtRed === '2' || beatAtRed === '3') pass('Tempo: strike during a rest marks the rest red');
  else fail('Tempo: strike during a rest marks the rest red', `beat was ${beatAtRed}`);
  await setGain(0);
  await waitForBeat(4);
  await waitForBeat(1); // silent through the note window; now in the holdover
  await waitFor(has(GRAY), 450, 'gray missed during holdover', 20);
  pass('Tempo: missed note is gray, persisting through the wrap holdover');

  // tempo: wrong octave (G4 = 392 Hz) -> amber
  await waitForBeat(2);
  await waitForBeat(4);
  await setFreq(392);
  await setGain(0.25);
  await waitFor(has(AMBER), 900, 'amber during beat 4', 25);
  pass('Tempo: wrong octave marks the note amber');
  await waitForBeat(1);
  await setGain(0);
  await setFreq(196);

  // mic hint after two fully silent bars; cleared by a qualifying strike
  await waitFor(`!!document.querySelector('.mic-hint')`, 15000, 'mic hint', 200);
  pass('Tempo: two silent bars raise the mic hint');
  await setGain(0.25);
  await waitFor(`!document.querySelector('.mic-hint')`, 3000, 'mic hint cleared');
  pass('Tempo: a qualifying strike clears the mic hint');
  await setGain(0);

  // practice mode: metronome hidden, cursor walk across 3 identical targets,
  // each needing a fresh articulation
  await evalJS(`document.querySelector('input[name="input-mode"][value="practice"]').click()`);
  await evalJS(`document.querySelector('input[name="input-rests"][value="1"]').click()`);
  await waitFor(`!document.querySelector('#visual-metronome')`, 2000, 'metronome hidden');
  await waitFor(has(BLUE), 2000, 'practice cursor visible');
  pass('Practice: metronome hidden, cursor highlights the first note');

  // the articulation envelope re-arms only on a processed silent frame, so
  // give it a real quiet gap after the mic-hint strike before striking again
  await sleep(350);

  let prevGreens = 0;
  for (let i = 1; i <= 3; i++) {
    await setGain(0.25);
    await waitFor(`${count(GREEN)} > ${prevGreens}`, 3000, `green count after strike ${i}`, 25);
    prevGreens = await evalJS(count(GREEN));
    await setGain(0);
    await sleep(320); // clear gap so the next identical target needs a re-strike
  }
  pass('Practice: cursor walks all three identical targets on re-strikes');

  await waitFor(`${count(GREEN)} === 0 && ${has(BLUE)}`, 3000, 'bar regenerated after completion');
  pass('Practice: bar regenerates after completion, cursor back to the first note');

  // practice prompt when Listen is off; toggle releases the mic
  await evalJS(`document.querySelector('#listen-toggle').click()`);
  await waitFor(`!!document.querySelector('.practice-prompt')`, 2000, 'practice prompt');
  await waitFor(
    `!document.querySelector('#listen-toggle').classList.contains('listening')`,
    2000,
    'listening off',
  );
  pass('Practice: Listen off shows the practice prompt');
};

// --- main -----------------------------------------------------------------------------
if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME} — set CHROME_PATH to your Chrome binary`);
  process.exit(1);
}

let preview = null;
let chrome = null;
const profileDir = mkdtempSync(join(tmpdir(), 'pitch-harness-'));

try {
  let appUrl = process.env.APP_URL;
  if (!appUrl) {
    await runBuild();
    const previewPort = await freePort();
    preview = spawnPreview(previewPort);
    appUrl = `http://localhost:${previewPort}/`;
    await waitForServer(appUrl);
  }

  const debugPort = await freePort();
  chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--autoplay-policy=no-user-gesture-required',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  await connect(debugPort);
  await run(appUrl);
} catch (err) {
  fail('harness aborted', err.message);
} finally {
  if (chrome !== null) {
    // wait for Chrome to actually exit before deleting its profile dir
    const exited = new Promise((r) => chrome.once('exit', r));
    chrome.kill();
    await Promise.race([exited, sleep(3000)]);
  }
  preview?.kill();
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
