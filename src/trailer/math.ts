/** Kleine Rechenhelfer für Regelwerk und Auslegung. */
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const roundTo = (v: number, step: number) => Math.round(v / step) * step;
/** Rundet auf das nächste Vielfache auf; winzige Rechenfehler lösen kein Aufrunden aus. */
export const ceilTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;
