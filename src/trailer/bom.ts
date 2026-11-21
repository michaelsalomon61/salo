/** Stückliste: fasst gleiche Bauteile zusammen und bildet die Summen. */
import { locale, type Locale } from '../i18n';
import { GROUPS, partMassKg, type Group, type Part } from './parts';

export interface BomRow {
  pos: number;
  group: Group;
  /** Benennung in der Ausgangssprache; für die Anzeige mit Locale.partName übersetzen. */
  name: string;
  quantity: number;
  /** Abmessungen in Millimetern, in der Schreibweise der gewählten Sprache. */
  dimensions: string;
  material: string;
  unitKg: number;
  totalKg: number;
  /** Eines der zusammengefassten Bauteile, als Vorlage für das Vorschaubild. */
  part: Part;
}

export interface Bom {
  rows: BomRow[];
  /** Anzahl aller Einzelteile. */
  pieceCount: number;
  totalKg: number;
  groups: { group: Group; pieceCount: number; totalKg: number }[];
}

function dimensions(p: Part, L: Locale): string {
  const mm = (metres: number) => L.nf(Math.round(metres * 1000));
  switch (p.kind) {
    case 'box': {
      const [length, b, a] = [...p.size].sort((m, n) => n - m);
      const base = `${mm(length)} × ${mm(b)} × ${mm(a)}`;
      return p.wall ? `${base}, ${L.t('Wand')} ${mm(p.wall)}` : base;
    }
    case 'cylinder':
      return p.innerRadius
        ? `Ø ${mm(p.radius * 2)} / ${mm(p.innerRadius * 2)} × ${mm(p.length)}`
        : `Ø ${mm(p.radius * 2)} × ${mm(p.length)}`;
    case 'wheel':
      return `Ø ${mm(p.radius * 2)} × ${mm(p.width)}`;
    case 'ring':
      return `Ø ${mm((p.radius - p.tube) * 2)} ${L.t('innen')}, ${L.t('Rundstahl')} Ø ${mm(p.tube * 2)}`;
  }
}

export function buildBom(parts: Part[], L: Locale = locale('de')): Bom {
  // Zusammengefasst wird unabhängig von der Anzeigesprache.
  const neutral = locale('de');
  const byKey = new Map<string, BomRow>();
  for (const p of parts) {
    // Einzelteile einer Zukaufbaugruppe stehen nicht eigens in der Liste.
    if (p.detail) continue;
    const key = `${p.group}|${p.name}|${dimensions(p, neutral)}|${p.material}`;
    const row = byKey.get(key);
    if (row) {
      row.quantity += 1;
    } else {
      byKey.set(key, {
        pos: 0,
        group: p.group,
        name: p.name,
        quantity: 1,
        dimensions: dimensions(p, L),
        material: p.material,
        unitKg: Math.round(partMassKg(p) * 10) / 10,
        totalKg: 0,
        part: p,
      });
    }
  }

  // Nach Baugruppe sortiert; gleich benannte Teile mit abweichenden Maßen stehen beieinander.
  const firstSeen = new Map<string, number>();
  [...byKey.values()].forEach((row, i) => {
    if (!firstSeen.has(row.name)) firstSeen.set(row.name, i);
  });
  const rows = [...byKey.values()].sort(
    (a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || firstSeen.get(a.name)! - firstSeen.get(b.name)!,
  );
  rows.forEach((row, i) => {
    row.pos = i + 1;
    row.totalKg = Math.round(row.unitKg * row.quantity * 10) / 10;
  });

  const groups = GROUPS.map((group) => {
    const own = rows.filter((r) => r.group === group);
    return {
      group,
      pieceCount: own.reduce((sum, r) => sum + r.quantity, 0),
      totalKg: own.reduce((sum, r) => sum + r.totalKg, 0),
    };
  }).filter((g) => g.pieceCount > 0);

  return {
    rows,
    pieceCount: rows.reduce((sum, r) => sum + r.quantity, 0),
    totalKg: Math.round(rows.reduce((sum, r) => sum + r.totalKg, 0)),
    groups,
  };
}

/** Stückliste als CSV für Excel (Semikolon, Dezimalkomma). */
export function bomToCsv(bom: Bom, L: Locale = locale('de')): string {
  const { t } = L;
  const num = (v: number) => v.toFixed(1).replace('.', ',');
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    [t('Pos.'), t('Baugruppe'), t('Benennung'), t('Menge (Stk.)'), t('Abmessungen (mm)'), t('Werkstoff'), t('Einzelgewicht (kg)'), t('Gesamtgewicht (kg)')],
    ...bom.rows.map((r) => [r.pos, t(r.group), L.partName(r.name), r.quantity, r.dimensions, t(r.material), num(r.unitKg), num(r.totalKg)]),
    ['', '', t('Summe'), bom.pieceCount, '', '', '', num(bom.totalKg)],
  ];
  return lines.map((line) => line.map(cell).join(';')).join('\r\n');
}
