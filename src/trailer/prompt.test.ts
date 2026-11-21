import { describe, expect, it } from 'vitest';
import { locale, untranslated } from '../i18n';
import { buildBom } from './bom';
import { DEFAULT_CONFIG, resolve, type TrailerConfig } from './config';
import { trailerParts } from './parts';
import { buildImagePrompt } from './prompt';

function promptFor(overrides: Partial<TrailerConfig>, lang: 'de' | 'en' | 'sk' = 'de') {
  const L = locale(lang);
  const { config, derived } = resolve({ ...DEFAULT_CONFIG, ...overrides });
  const description = trailerParts(config, derived);
  const bom = buildBom(description.parts, L);
  return { config, derived, text: buildImagePrompt(config, derived, description, bom.totalKg, bom.pieceCount, L) };
}

describe('KI-Bildprompt', () => {
  it('nennt Maße, Räder, Farbe und Traglast der Konfiguration', () => {
    const { config, derived, text } = promptFor({});
    const L = locale('de');
    expect(text).toContain(L.mm(config.lengthMm));
    expect(text).toContain(L.mm(config.widthMm));
    expect(text).toContain(L.mm(config.deckHeightMm));
    expect(text).toContain(`Insgesamt ${derived.wheelCount} Räder`);
    expect(text).toContain(`„${config.payloadT} t“`);
    expect(text).toMatch(/RAL \d{4} .* \(etwa #[0-9a-f]{6}\)/i);
    expect(text).toContain('FAHRZEUG');
    expect(text).toContain('NICHT ZEIGEN');
    // Keine offenen Platzhalter.
    expect(text).not.toMatch(/\{[a-z]+\}/i);
  });

  it('beschreibt Sonderaufbau, Lenkung und Deichselstellung', () => {
    expect(promptFor({ body: 'lowbed' }).text).toContain('Tieflader:');
    expect(promptFor({ body: 'longload' }).text).toContain('Langmaterialanhänger:');
    expect(promptFor({}).text).not.toContain('Tieflader:');
    expect(promptFor({ drawbarUp: true }).text).toContain('senkrecht hochgeklappt');
    expect(promptFor({ drawbarUp: false }).text).toContain('waagerecht nach vorn');
    expect(promptFor({ steering: 'turntable' }).text).toContain('Drehschemel');
    expect(promptFor({ steering: 'ackermann2' }).text).toContain('Achsschenkel');
  });

  it('ändert sich mit der Konfiguration', () => {
    expect(promptFor({ payloadT: 40 }).text).not.toBe(promptFor({}).text);
    expect(promptFor({ colorId: 'ral5010' }).text).not.toBe(promptFor({ colorId: 'ral3020' }).text);
  });

  it('ist in Englisch und Slowakisch vollständig übersetzt', () => {
    untranslated.clear();
    const variants: Partial<TrailerConfig>[] = [{}, { body: 'lowbed' }, { body: 'longload' }, { tyre: 'polyurethane' }, { tyre: 'pneumatic', nonMarking: true }, { drawbarUp: true }];
    for (const lang of ['en', 'sk'] as const) {
      for (const v of variants) {
        const { text } = promptFor(v, lang);
        expect(text).not.toMatch(/\{[a-z]+\}/i);
        expect(text).not.toContain('Ladefläche');
        expect(text).not.toContain('Deichsel');
      }
    }
    expect([...untranslated]).toEqual([]);
    expect(promptFor({}, 'en').text).toContain('VEHICLE');
    expect(promptFor({}, 'sk').text).toContain('VOZIDLO');
  });
});
