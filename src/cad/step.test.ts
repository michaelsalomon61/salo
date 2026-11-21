import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import * as replicad from 'replicad';
import opencascade from 'replicad-opencascadejs';
import { DEFAULT_CONFIG, resolve } from '../trailer/config';
import { trailerParts } from '../trailer/parts';
import { buildStepBlob, buildStepParts } from './step';

const require = createRequire(import.meta.url);

describe('STEP-Export', () => {
  beforeAll(async () => {
    const wasm = require.resolve('replicad-opencascadejs/wasm');
    replicad.setOC(await opencascade({ locateFile: () => wasm }));
  }, 60_000);

  it('enthält jedes Bauteil als Körper in Millimetern mit z nach oben', async () => {
    const { config, derived } = resolve(DEFAULT_CONFIG);
    const parts = trailerParts(config, derived).parts;
    const solids = buildStepParts(replicad, config, derived);
    expect(solids).toHaveLength(parts.length);

    // Die Ladefläche liegt oben auf Ladehöhe und reicht über die volle Länge und Breite.
    const deck = solids.find((s) => s.name.startsWith('Deckblech'))!;
    const [min, max] = deck.shape.boundingBox.bounds;
    expect(max[0] - min[0]).toBeCloseTo(config.lengthMm, 0);
    expect(max[1] - min[1]).toBeCloseTo(config.widthMm, 0);
    expect(max[2]).toBeCloseTo(config.deckHeightMm, 0);

    // Räder stehen auf dem Boden.
    const wheel = solids.find((s) => s.name.startsWith('Vollgummirad'))!;
    expect(wheel.shape.boundingBox.bounds[0][2]).toBeCloseTo(0, 0);

    const text = await buildStepBlob(replicad, config, derived).text();
    expect(text.startsWith('ISO-10303-21;')).toBe(true);
    expect(text.match(/MANIFOLD_SOLID_BREP/g)).toHaveLength(parts.length);
    expect(text).toContain("'Deckblech 1'");
  }, 120_000);
});
