import type { Derived, TrailerConfig } from '../trailer/config';
import { buildStepBlob } from './step';

let kernel: Promise<typeof import('replicad')> | null = null;

/** Lädt den CAD-Kern (rund 23 MB) beim ersten Export und hält ihn danach vor. */
function loadKernel() {
  kernel ??= (async () => {
    const [{ default: opencascade }, { default: wasmUrl }, replicad] = await Promise.all([
      import('replicad-opencascadejs'),
      import('replicad-opencascadejs/wasm?url'),
      import('replicad'),
    ]);
    const oc = await opencascade({ locateFile: () => wasmUrl });
    replicad.setOC(oc);
    return replicad;
  })();
  kernel.catch(() => {
    kernel = null;
  });
  return kernel;
}

export async function exportStep(config: TrailerConfig, derived: Derived): Promise<Blob> {
  return buildStepBlob(await loadKernel(), config, derived);
}
