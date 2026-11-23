import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, OPTIONS, type TrailerConfig } from './config';
import { resolve } from './rules';
import { trailerParts } from './parts';
import { estimateQuote, partPriceEur, quoteToCsv } from './pricing';

function quote(overrides: Partial<TrailerConfig> = {}) {
  const { config, derived } = resolve({ ...DEFAULT_CONFIG, ...overrides });
  const { parts } = trailerParts(config, derived);
  return { config, parts, quote: estimateQuote(config, parts) };
}

describe('Preisschätzung', () => {
  it('rechnet die Summen nachvollziehbar zusammen', () => {
    const q = quote().quote;
    expect(q.costEur).toBe(q.lines.reduce((sum, l) => sum + l.eur, 0));
    expect(q.netEur).toBe(q.costEur + q.overheadEur);
    expect(q.netEur % 10).toBe(0);
    expect(q.grossEur).toBe(q.netEur + q.vatEur);
    expect(q.vatEur).toBe(Math.round(q.netEur * 0.19));
    expect(q.lowEur).toBeLessThan(q.netEur);
    expect(q.highEur).toBeGreaterThan(q.netEur);
    // Aufschlag von rund 20 % auf die Selbstkosten.
    expect(q.overheadEur / q.costEur).toBeGreaterThan(0.19);
    expect(q.overheadEur / q.costEur).toBeLessThan(0.21);
  });

  it('liegt für die Standardkonfiguration in einer plausiblen Größenordnung', () => {
    const q = quote().quote;
    expect(q.netEur).toBeGreaterThan(15_000);
    expect(q.netEur).toBeLessThan(45_000);
  });

  it('bepreist jedes Bauteil jeder Option mit einem positiven Betrag', () => {
    for (const [key, options] of Object.entries(OPTIONS)) {
      for (const option of options) {
        const { parts, quote: q } = quote({ [key]: option.id, wallType: key === 'wallType' ? option.id : 'folding', deck: key === 'deck' ? option.id : 'plywood', rearWheels: 'outside', ramp: 'rear' } as Partial<TrailerConfig>);
        for (const p of parts) {
          if (!p.detail) expect(partPriceEur(p), `${p.name} (${key}=${option.id})`).toBeGreaterThan(0);
        }
        expect(Number.isFinite(q.netEur)).toBe(true);
      }
    }
  });

  it('steigt mit Nutzlast, Größe und Ausstattung', () => {
    const base = quote().quote.netEur;
    expect(quote({ payloadT: 40 }).quote.netEur).toBeGreaterThan(base);
    expect(quote({ lengthMm: 9000 }).quote.netEur).toBeGreaterThan(base);
    expect(quote({ brake: 'air', lighting: 'stvzo', wallType: 'folding', rearCoupling: 'automatic' }).quote.netEur).toBeGreaterThan(base);
    expect(quote({ roof: 'tarp', roofSides: 'curtain' }).quote.netEur).toBeGreaterThan(base);
    expect(quote({ steering: 'allWheel' }).quote.netEur).toBeGreaterThan(base);
    expect(quote({ payloadT: 6, lengthMm: 3000, widthMm: 1500 }).quote.netEur).toBeLessThan(base);
  });

  it('gibt die Aufstellung als CSV mit allen Positionen aus', () => {
    const q = quote({ brake: 'air' }).quote;
    const csv = quoteToCsv(q);
    for (const line of q.lines) expect(csv).toContain(line.label.text);
    expect(csv).toContain('Nettopreis (Schätzung)');
    expect(csv.split('\r\n')).toHaveLength(q.lines.length + 5);
  });
});
