import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, resolve } from '../trailer/config';
import { trailerParts } from '../trailer/parts';
import { buildBom, bomToCsv } from '../trailer/bom';
import { estimateQuote, quoteToCsv } from '../trailer/pricing';
import { describeProse } from '../trailer/summary';
import { exerciseDataTexts } from './exercise';
import { LANGUAGES, locale, untranslated } from './index';
import { TRANSLATIONS } from './translations';

/** Alle Quelldateien außer Tests und der Übersetzungstabelle. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') && entry.name !== 'translations.ts' ? [path] : [];
  });
}

/** Textstücke, die an t(), msg() oder setMessage() übergeben werden, einschließlich der Zweige von Bedingungen. */
function textsIn(source: string): string[] {
  const found: string[] = [];
  const call = /(?<![\w.])(?:t|L\.t|msg|setMessage)\(/g;
  for (let match = call.exec(source); match; match = call.exec(source)) {
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    for (; i < source.length && depth > 0; i++) {
      const ch = source[i];
      if (ch === "'" || ch === '"' || ch === '`') {
        for (i++; i < source.length && source[i] !== ch; i++) if (source[i] === '\\') i++;
      } else if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    // Nur der Text selbst, nicht die Werte der Platzhalter dahinter.
    const first = source.slice(start, i - 1).split(/,\s*\{/)[0];
    for (const literal of first.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) found.push(literal[1] ?? literal[2]);
  }
  for (const literal of source.matchAll(/\btext: '((?:[^'\\]|\\.)*)'/g)) found.push(literal[1]);
  return found;
}

/** Kennungen wie 'wallType' oder 'de' sind keine Texte. */
const isText = (s: string) => s.length > 0 && !/^[a-z][A-Za-z0-9]*$/.test(s);
const FILE_WORDS = ['anhaenger', 'angebot', 'stueckliste', 'konfiguration', 'innen', 'links', 'rechts'];

describe('Übersetzungen', () => {
  it('decken jeden Text ab, der im Code an die Übersetzung übergeben wird', () => {
    const missing = new Set<string>();
    let found = 0;
    for (const file of sourceFiles(join(__dirname, '..'))) {
      for (const text of textsIn(readFileSync(file, 'utf8'))) {
        if (!isText(text) && !FILE_WORDS.includes(text)) continue;
        found++;
        if (!(text in TRANSLATIONS)) missing.add(`${text}  (${file.split('/src/')[1]})`);
      }
    }
    // Die Suche muss die Texte der Oberfläche auch wirklich finden.
    expect(found).toBeGreaterThan(250);
    expect([...missing]).toEqual([]);
  });

  it('decken alle Texte ab, die aus Daten entstehen: Optionen, Bauteile, Werkstoffe, Hinweise', () => {
    untranslated.clear();
    exerciseDataTexts(locale('en'));
    exerciseDataTexts(locale('sk'));
    expect([...untranslated]).toEqual([]);
  });

  it('sind vollständig und verwenden dieselben Platzhalter wie der Ausgangstext', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [key, entry] of Object.entries(TRANSLATIONS)) {
      for (const lang of ['en', 'sk'] as const) {
        expect(entry[lang].trim(), `${lang}: ${key}`).not.toBe('');
        expect(placeholders(entry[lang]), `${lang}: ${key}`).toEqual(placeholders(key));
      }
    }
  });
});

describe('Sprachumschaltung', () => {
  const { config, derived } = resolve({ ...DEFAULT_CONFIG, brake: 'air', deck: 'hardwood' });
  const parts = trailerParts(config, derived).parts;

  it('lässt Deutsch unverändert und formatiert Zahlen je Sprache', () => {
    expect(locale('de').t('Stückliste')).toBe('Stückliste');
    expect(locale('en').t('Stückliste')).toBe('Parts list');
    expect(locale('sk').t('Stückliste')).toBe('Kusovník');
    expect(locale('de').mm(6000)).toBe('6.000 mm');
    expect(locale('en').mm(6000)).toBe('6,000 mm');
    expect(locale('sk').mm(6000).replace(/\s/g, ' ')).toBe('6 000 mm');
    expect(LANGUAGES.map((l) => l.name)).toEqual(['Deutsch', 'English', 'Slovenčina']);
  });

  it('übersetzt Platzhalterwerte, lässt mit raw markierte Texte aber unberührt', () => {
    const en = locale('en');
    expect(en.t('Bremse: {brake}', { brake: 'Druckluftbremse' })).toBe('Brake: Air brake');
    expect(en.t('„{name}“ gespeichert.', { name: { raw: 'Ohne' } })).toBe('“Ohne” saved.');
    expect(en.partName('Rad Vollgummi Ø 500, spurfrei')).toBe('Wheel, solid rubber Ø 500, non-marking');
    expect(locale('sk').partName('Kugeldrehkranz Ø 1200')).toBe('Guľkový otočný veniec Ø 1200');
  });

  it('gibt Stückliste und Angebot in der gewählten Sprache aus', () => {
    for (const [lang, bomWord, quoteWord, deutsch] of [
      ['en', 'Designation', 'Net price (estimate)', 'Benennung'],
      ['sk', 'Názov', 'Cena bez DPH (odhad)', 'Benennung'],
    ] as const) {
      const L = locale(lang);
      const csv = bomToCsv(buildBom(parts, L), L);
      expect(csv).toContain(bomWord);
      expect(csv).not.toContain(deutsch);
      expect(csv).not.toMatch(/Stahl|Rad Vollgummi|Rahmen|Wand /);
      const quote = quoteToCsv(estimateQuote(config, parts), L);
      expect(quote).toContain(quoteWord);
      expect(quote).not.toMatch(/Fertigung|Lackierung|Stunden/);
      expect(describeProse(config, derived, L)).not.toMatch(/Nutzlast|Bremse|Lackierung|Fahrwerk/);
    }
    // Gleiche Bauteile werden in jeder Sprache gleich zusammengefasst.
    expect(buildBom(parts, locale('sk')).rows.length).toBe(buildBom(parts, locale('de')).rows.length);
  });
});
