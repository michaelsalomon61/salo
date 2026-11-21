import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, resolve } from '../trailer/config';
import { decodeShare, encodeShare, shareUrl } from './share';

describe('Konfiguration als Link', () => {
  const config = {
    ...DEFAULT_CONFIG,
    payloadT: 36,
    body: 'lowbed' as const,
    steering: 'ackermann2' as const,
    couplingHeightMm: 650,
    wallHeightMm: 600 as const,
    notes: 'Für Halle 3 – Übergabe „Süd“, Maße ≤ 2,5 m ✓',
  };

  it('gibt die Konfiguration samt Namen unverändert wieder', () => {
    const shared = decodeShare(`#${encodeShare(config, 'Tieflader Süd')}`);
    expect(shared).toEqual({ config, name: 'Tieflader Süd' });
  });

  it('enthält nur Abweichungen vom Standard und bleibt dadurch kurz', () => {
    expect(encodeShare(DEFAULT_CONFIG, null).length).toBeLessThan(40);
    expect(decodeShare(encodeShare(DEFAULT_CONFIG, null))).toEqual({ config: DEFAULT_CONFIG, name: null });
    expect(encodeShare(config, 'Tieflader Süd').length).toBeLessThan(400);
  });

  it('besteht nur aus Zeichen, die in Links unverändert bleiben', () => {
    expect(encodeShare(config, 'Tieflader Süd')).toMatch(/^konfig=[A-Za-z0-9_-]+$/);
  });

  it('bildet einen vollständigen Link und ersetzt einen vorhandenen Anhang', () => {
    const url = shareUrl(config, null, 'https://example.org/salo/#konfig=alt');
    expect(url.startsWith('https://example.org/salo/#konfig=')).toBe(true);
    expect(url.split('#')).toHaveLength(2);
    expect(decodeShare(new URL(url).hash)!.config).toEqual(config);
  });

  it('ignoriert Links ohne oder mit beschädigter Konfiguration', () => {
    for (const hash of ['', '#', '#anderes=1', '#konfig=', '#konfig=!!!', '#konfig=abc', `#konfig=${btoa('[1,2]')}`, `#konfig=${btoa('{"v":1}')}`]) {
      expect(decodeShare(hash), hash).toBeNull();
    }
  });

  it('liefert auch aus manipulierten Links eine baubare Konfiguration', () => {
    const tampered = `#konfig=${btoa(JSON.stringify({ v: 1, c: { payloadT: 9999, deck: 'gold', axles: 'viele', lengthMm: -5, fremd: 1 } }))}`;
    const shared = decodeShare(tampered)!;
    expect(shared.config.deck).toBe(DEFAULT_CONFIG.deck);
    expect(shared.config.axles).toBe(DEFAULT_CONFIG.axles);
    const { config: built } = resolve(shared.config);
    expect(built.payloadT).toBeLessThanOrEqual(48);
    expect(built.lengthMm).toBeGreaterThanOrEqual(2000);
  });
});
