#!/usr/bin/env node
/**
 * Prüft die gebaute Seite im Browser: Schritte, Felder, Werkzeugleiste,
 * Speichern, Ergebnisseite, Ausgaben, Sprachen und schmale Fenster.
 *
 * Aufruf nach `npm run build`:  node scripts/check-browser.cjs [--quick]
 * --quick lässt den STEP-Export aus (er lädt den CAD-Kern und dauert am längsten).
 *
 * Braucht Playwright mit Chromium. In Cloud-Sitzungen von Claude Code ist es
 * vorinstalliert; es ist bewusst keine Abhängigkeit des Projekts.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright fehlt. Installieren mit: npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}

const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const quick = process.argv.includes('--quick');
const failures = [];
let checks = 0;
const check = (name, ok, detail = '') => {
  checks++;
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
};
const same = (name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), `erwartet ${JSON.stringify(expected)}, erhalten ${JSON.stringify(actual)}`);

async function startPreview() {
  const root = path.join(__dirname, '..');
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', detached: true });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return server;
    } catch {
      // Der Server ist noch nicht bereit.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Die Vorschau startet nicht. Wurde `npm run build` ausgeführt?');
}

async function main() {
  const server = await startPreview();
  // Software-Rendering, damit WebGL auch ohne Grafikkarte läuft.
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const open = async (width, height, hash = '') => {
    const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(URL + hash);
    await page.waitForSelector('canvas');
    await page.selectOption('#language', 'de');
    await page.waitForTimeout(700);
    return page;
  };
  const text = (page, selector) => page.locator(selector).first().innerText();
  const fields = (page) => page.evaluate(() => [...document.querySelectorAll('.step input, .step textarea, .step [role=radiogroup]')].map((el) => el.id || el.getAttribute('aria-label')).join(' '));
  const openGroups = (page) => page.evaluate(() => document.querySelectorAll('.step details').forEach((d) => (d.open = true)));
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const press = async (page, selector, key, times) => {
    await page.locator(selector).focus();
    for (let i = 0; i < times; i++) await page.keyboard.press(key);
    await page.waitForTimeout(350);
  };

  try {
    // ── Breites Fenster: der ganze Ablauf ──
    let page = await open(1440, 900);
    same('Start im ersten Schritt', await text(page, '.panel-head h2'), 'Aufgabe');
    await openGroups(page);
    same('Felder Aufgabe', await fields(page), 'payload load-type load-length load-width load-height site ground speed slope public-roads obstacle aisle curve hours distance tow-weight coupling-height tow-force train notes');

    const priceBefore = await text(page, '.bar-price b');
    await press(page, '#payload', 'ArrowRight', 16);
    check('Nutzlast ändert den Richtpreis', (await text(page, '.bar-price b')) !== priceBefore);
    check('Kopfzeile der Bühne nennt die Nutzlast', (await text(page, '.stage-head h1')).startsWith('40 t'));
    check('Regelwerk meldet Anpassungen', (await page.locator('#open-hints').count()) === 1);
    await page.click('#open-hints');
    check('Hinweisliste nennt die Achsen', (await text(page, '.hints')).includes('mindestens 4 Achsen'));
    await page.keyboard.press('Escape');
    await press(page, '#payload', 'ArrowLeft', 16);

    await page.click('#step-next');
    same('Weiter führt zum Fahrzeug', [await text(page, '.panel-head h2'), await page.evaluate(() => location.hash)], ['Fahrzeug', '#/fahrzeug']);
    same('Felder Plattform', await (await openGroups(page), fields(page)), 'body length width deck-height axles roof');
    await page.click('#roof-tarp');
    same('Felder mit Dach', await fields(page), 'body length width deck-height axles roof roof-shape roof-clear roof-sides');
    await page.click('#roof-none');
    await page.click('#body-lowbed');
    await page.waitForTimeout(300);
    same('Felder Tieflader', await fields(page), 'body length width deck-height axles bed-height rear-wheels ramp');
    check('Klappe hinten gesperrt bei innen laufenden Rädern', await page.locator('#ramp-rear').isDisabled());
    await page.click('#body-longload');
    await page.waitForTimeout(300);
    same('Felder Langmaterial', await fields(page), 'body length width deck-height axles min-length max-length raster');
    await page.click('#body-platform');

    await page.click('#step-running');
    same('Felder Fahrwerk', await fields(page), 'steering-type tyre non-marking suspension brake parking-brake');
    check('Karten nennen Werte aus den Stammdaten', (await text(page, '#steering-type')).includes('bis 60°') && (await text(page, '#tyre')).includes('bis 16 km/h'));
    await page.click('#tyre-pneumatic');
    await page.click('#step-body');
    same('Felder Aufbau', await fields(page), 'deck wall-type lashing Lackierung tow-eye drawbar-spring rear-coupling lighting chocks');
    await page.click('#deck-pine');
    await page.click('#wall-type-folding');
    same('Felder mit Bordwänden', await fields(page), 'deck edge wall-type wall-material wall-height lashing Lackierung tow-eye drawbar-spring rear-coupling lighting chocks');
    await page.click('#color-ral5010');

    await page.goBack();
    same('Zurück im Browser wechselt den Schritt', [await text(page, '.panel-head h2'), await page.evaluate(() => location.hash)], ['Fahrwerk', '#/fahrwerk']);
    await page.reload();
    await page.waitForSelector('canvas');
    await page.waitForTimeout(500);
    same('Neuladen behält Schritt und Eingaben', [await text(page, '.panel-head h2'), await page.locator('#tyre-pneumatic').getAttribute('aria-checked')], ['Fahrwerk', 'true']);

    // Werkzeugleiste an der 3D-Ansicht
    await page.click('#toggle-dimensions');
    same('Maße ausgeblendet', await page.locator('#toggle-dimensions').getAttribute('aria-pressed'), 'false');
    await page.click('#show-load');
    same('Ladung eingeblendet', await page.locator('#show-load').getAttribute('aria-pressed'), 'true');
    for (const view of ['side', 'top', 'iso']) await page.click(`#view-${view}`);
    await press(page, '#steering', 'ArrowRight', 20);
    same('Lenkeinschlag', await text(page, '.tool-slider output'), '20° rechts');
    await page.click('#drawbar-up');
    check('Hochgeklappte Deichsel sperrt die Lenkung', await page.locator('#steering').isDisabled());
    await page.click('#drawbar-up');

    // Speichern über das Menü
    await page.click('#config-menu');
    await page.click('#save-as');
    await page.fill('#save-name', 'Prüfung');
    await page.click('#save-submit');
    await page.waitForTimeout(300);
    if (await page.locator('.dialog').count()) await page.keyboard.press('Escape');
    same('Gespeichert unter Namen', [await text(page, '.doc-name'), await text(page, '.doc-status'), await page.locator('#quick-save').count()], ['Prüfung', 'Gespeichert', 0]);
    await press(page, '#steering', 'ArrowLeft', 20);
    same('Änderung bietet Speichern an', await page.locator('#quick-save').count(), 1);

    // Ergebnisseite
    await page.click('#step-result');
    await page.waitForSelector('.quote-picture', { timeout: 15000 }).catch(() => {});
    check('Angebot zeigt ein Bild der Konfiguration', (await page.locator('.quote-picture').count()) === 1);
    check('Fußleiste entfällt auf der Ergebnisseite', (await page.locator('.bar').count()) === 0);
    check('Kacheln nennen die Kennwerte', (await text(page, '.tiles')).includes('Eigengewicht'));
    for (const tab of ['bom', 'data', 'hints', 'quote']) {
      await page.click(`#tab-${tab}`);
      await page.waitForTimeout(tab === 'bom' ? 900 : 200);
      check(`Reiter ${tab} hat Inhalt`, (await text(page, '.result-content')).trim().length > 40);
      if (tab === 'bom') {
        check('Stückliste zeigt Bauteilbilder', (await page.locator('.result-content img.thumb').count()) > 10);
        same('Stückliste passt in die Spalte', await page.locator('.table-scroll').evaluate((el) => el.scrollWidth - el.clientWidth), 0);
      }
      if (tab === 'data') {
        const data = (await text(page, '.result-content')).replace(/\n+/g, ' ');
        for (const needle of ['Bereifung Luft', 'Belag Kiefernholz', 'Lackierung RAL 5010 Enzianblau']) check(`Technische Daten: ${needle}`, data.includes(needle));
      }
      if (tab !== 'hints') {
        const [file] = await Promise.all([page.waitForEvent('download'), page.click('#result-csv')]);
        check(`CSV für ${tab}`, file.suggestedFilename().endsWith('.csv'));
      }
    }
    await page.click('#tab-bom');
    await page.evaluate(() => {
      window.print = () => (window.printedTab = document.querySelector('.tabs [aria-selected=true]').id);
    });
    await page.click('#result-print');
    same('Drucken wechselt zum Angebot', await page.evaluate(() => window.printedTab), 'tab-quote');
    for (const [id, title] of [['open-mail', 'STEP-Modell per E-Mail'], ['result-share', 'Link teilen'], ['open-prompt', 'KI-Bildprompt']]) {
      await page.click(`#${id}`);
      await page.waitForSelector('.dialog');
      same(`Fenster ${id}`, await text(page, '.dialog h1'), title);
      await page.mouse.click(8, 8);
      await page.waitForTimeout(150);
      same(`Klick daneben schließt ${id}`, await page.locator('.dialog').count(), 0);
    }
    if (!quick) {
      const [step] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('#save-step')]);
      check('STEP-Modell wird gespeichert', step.suggestedFilename().endsWith('.step'));
    }

    // Teilen-Link öffnet dieselbe Konfiguration
    await page.click('#open-share');
    const link = await page.inputValue('#share-url');
    await page.keyboard.press('Escape');
    const other = await page.context().newPage();
    await other.goto(link);
    await other.waitForSelector('canvas');
    await other.waitForTimeout(500);
    check('Teilen-Link überträgt die Konfiguration', (await text(other, '.stage-head p')).includes('Luft'));
    await other.close();

    // Sprachen
    await page.selectOption('#language', 'en');
    same('Englische Schritte', (await text(page, '.steps')).replace(/\s+/g, ' '), 'Task Vehicle Running gear Body 5 Result');
    await page.selectOption('#language', 'sk');
    check('Slowakische Schritte', (await text(page, '.steps')).includes('Výsledok'));
    await page.selectOption('#language', 'de');

    // Neu beginnen
    await page.click('#config-menu');
    await page.click('#open-reset');
    await page.click('#reset-delete-saved');
    await page.click('#reset-confirm');
    await page.waitForTimeout(500);
    same('Neu beginnen', [await text(page, '.panel-head h2'), await text(page, '.doc-name'), await page.inputValue('#payload'), await page.locator('#tyre-solid').count()], ['Aufgabe', 'Nicht gespeichert', '24', 0]);
    await page.context().close();

    // ── Mittlere und schmale Fenster: nichts ragt über den Rand ──
    for (const [name, width, height] of [['mittel', 1100, 800], ['Telefon', 390, 844], ['kleines Telefon', 360, 640]]) {
      page = await open(width, height);
      await press(page, '#speed', 'ArrowRight', 14); // löst Hinweise aus
      for (const step of ['task', 'vehicle', 'running', 'body', 'result']) {
        await page.click(`#step-${step}`);
        await page.waitForTimeout(250);
        same(`${name}: Schritt ${step} ohne Überlauf`, await overflow(page), 0);
      }
      await page.click('#step-task');
      await page.click('#pose-menu');
      const box = await page.locator('.popover-panel').boundingBox();
      check(`${name}: Lenkungsfeld im Fenster`, box.x >= 0 && box.x + box.width <= width && box.y >= 0);
      await page.keyboard.press('Escape');
      await page.click('#view-next');
      await page.context().close();
    }

    same('Keine Fehler in der Konsole', errors, []);
  } finally {
    await browser.close();
    try {
      process.kill(-server.pid);
    } catch {
      // Der Server war schon beendet.
    }
  }

  if (failures.length) {
    console.error(`${failures.length} von ${checks} Prüfungen fehlgeschlagen:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Alle ${checks} Prüfungen im Browser bestanden.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
