/**
 * Bauteilbeschreibung des Anhängers.
 *
 * Diese Liste ist die gemeinsame Quelle für das 3D-Modell, die Stückliste und
 * den STEP-Export. Sie enthält nur Zahlen und Texte, keine
 * 3D-Objekte. Maße in Metern, Massen in Kilogramm.
 *
 * Koordinaten: x in Fahrtrichtung (Deichsel bei +x), y nach oben, z nach rechts.
 */
import { axleLayout, wheelMassKg, type Derived, type TrailerConfig } from './config';

export type Vec3 = [number, number, number];

/** Oberfläche, mit der ein Bauteil dargestellt wird. */
export type Look = 'paint' | 'steel' | 'tyre' | 'checker' | 'wood' | 'rubber';

/**
 * Bezugssystem eines Bauteils: der Aufbau, der lenkbare Drehschemel
 * (dreht um y) oder die klappbare Deichsel (dreht um z am Gelenk).
 */
export type Frame = 'chassis' | 'bogie' | 'drawbar';

export const GROUPS = ['Ladefläche', 'Rahmen', 'Fahrwerk', 'Drehschemel', 'Deichsel'] as const;
export type Group = (typeof GROUPS)[number];

interface PartBase {
  /** Benennung in der Stückliste. */
  name: string;
  group: Group;
  material: string;
  /** Dichte in kg/m³. */
  density: number;
  look: Look;
  frame: Frame;
  /** Mittelpunkt im Bezugssystem. */
  pos: Vec3;
  /** Feste Masse für Zukaufteile; sonst wird aus Volumen und Dichte gerechnet. */
  massKg?: number;
}

export interface BoxPart extends PartBase {
  kind: 'box';
  size: Vec3;
  /** Drehung um die Hochachse in Radiant. */
  rotY?: number;
  /** Wandstärke, wenn das Teil ein Hohlprofil entlang seiner längsten Kante ist. */
  wall?: number;
  /** Laufende Nummer gleichartiger Teile, z. B. für die Maserung einzelner Bohlen. */
  variant?: number;
}

export interface CylinderPart extends PartBase {
  kind: 'cylinder';
  radius: number;
  length: number;
  axis: 'x' | 'y' | 'z';
  /** Innenradius, wenn das Teil ein Ring ist. */
  innerRadius?: number;
}

/** Vollgummirad mit Felge und Nabe, Achse entlang z. */
export interface WheelPart extends PartBase {
  kind: 'wheel';
  radius: number;
  width: number;
}

/** Ringöse (Torus) mit senkrechter Achse. */
export interface RingPart extends PartBase {
  kind: 'ring';
  radius: number;
  tube: number;
}

export type Part = BoxPart | CylinderPart | WheelPart | RingPart;

export interface TrailerParts {
  parts: Part[];
  /** Drehpunkt des Drehschemels im Aufbau. */
  bogieOrigin: Vec3;
  /** Gelenk der Deichsel im Drehschemel. */
  drawbarOrigin: Vec3;
  /** Länge der Deichsel vom Gelenk bis zur Spitze der Zugöse. */
  drawbarLength: number;
  /** Lage der Traglastangabe auf dem rechten Außenträger. */
  label: { x: number; y: number; z: number; height: number };
}

const STEEL = { material: 'Stahl S355', density: 7850 };
const MM = 0.001;

/** Winkel der hochgeklappten Deichsel in Radiant. */
export const DRAWBAR_UP = 1.36;

/** Gelenkwinkel für Deichsel und Drehschemel aus der Konfiguration. */
export function jointAngles(config: TrailerConfig) {
  return {
    drawbar: config.drawbarUp ? DRAWBAR_UP : 0,
    // Rechts ist +z; ein Einschlag nach rechts dreht den Drehschemel daher um -y.
    steering: (-config.steeringDeg * Math.PI) / 180,
  };
}

export function trailerParts(config: TrailerConfig, d: Derived): TrailerParts {
  const L = config.lengthMm * MM;
  const W = config.widthMm * MM;
  const H = config.deckHeightMm * MM;
  const frameH = d.frameHeightMm * MM;
  const D = d.wheelDiameterMm * MM;
  const R = D / 2;
  const wheelW = d.wheelWidthMm * MM;
  const layout = axleLayout(config, d);
  const parts: Part[] = [];

  const box = (
    frame: Frame,
    group: Group,
    name: string,
    size: Vec3,
    pos: Vec3,
    extra: Partial<BoxPart> = {},
  ) => parts.push({ kind: 'box', frame, group, name, size, pos, look: 'paint', ...STEEL, ...extra });
  const rod = (
    frame: Frame,
    group: Group,
    name: string,
    radius: number,
    length: number,
    axis: CylinderPart['axis'],
    pos: Vec3,
    extra: Partial<CylinderPart> = {},
  ) => parts.push({ kind: 'cylinder', frame, group, name, radius, length, axis, pos, look: 'steel', ...STEEL, ...extra });

  // ── Ladefläche ───────────────────────────────────────────────────────────
  const plateT = config.payloadT <= 10 ? 0.006 : config.payloadT <= 25 ? 0.008 : 0.01;
  let deckT = plateT;
  if (config.deck === 'steel') {
    box('chassis', 'Ladefläche', 'Deckblech', [L, plateT, W], [0, H - plateT / 2, 0]);
  } else if (config.deck === 'checker') {
    box('chassis', 'Ladefläche', 'Riffelblech', [L, plateT, W], [0, H - plateT / 2, 0], { look: 'checker' });
  } else if (config.deck === 'rubber') {
    const mat = 0.01;
    deckT = plateT + mat;
    box('chassis', 'Ladefläche', 'Deckblech', [L, plateT, W], [0, H - mat - plateT / 2, 0]);
    box('chassis', 'Ladefläche', 'Gummiauflage', [L - 0.02, mat, W - 0.02], [0, H - mat / 2, 0], {
      look: 'rubber',
      material: 'Gummi, gerippt',
      density: 1250,
    });
  } else {
    deckT = 0.045;
    const count = Math.max(1, Math.round(W / 0.2));
    const pitch = W / count;
    for (let i = 0; i < count; i++) {
      box('chassis', 'Ladefläche', 'Hartholzbohle', [L, deckT, pitch - 0.003], [0, H - deckT / 2, -W / 2 + (i + 0.5) * pitch], {
        look: 'wood',
        material: 'Hartholz',
        density: 750,
        variant: i,
      });
    }
  }

  // ── Rahmen ───────────────────────────────────────────────────────────────
  const yBottom = H - frameH;
  const webH = frameH - deckT;
  const webY = yBottom + webH / 2;
  const pocket = 0.07;
  const pockets = Math.max(2, Math.round(L / 1.1));

  for (const side of [1, -1]) {
    // Außenträger als nach außen offenes U-Profil mit Rippen.
    box('chassis', 'Rahmen', 'Außenträger Stegblech', [L - 0.024, webH, 0.012], [0, webY, side * (W / 2 - pocket)]);
    box('chassis', 'Rahmen', 'Außenträger Untergurt', [L, 0.014, pocket + 0.006], [0, yBottom + 0.007, side * (W / 2 - pocket / 2 - 0.003)]);
    for (let i = 1; i < pockets; i++) {
      box('chassis', 'Rahmen', 'Rippe', [0.012, webH - 0.014, pocket - 0.006], [-L / 2 + (i * L) / pockets, webY + 0.007, side * (W / 2 - pocket / 2)]);
    }
    box('chassis', 'Rahmen', 'Längsträger', [L - 0.05, webH - 0.02, 0.09], [0, webY + 0.01, side * W * 0.2], { wall: 0.008 });
  }
  for (const end of [1, -1]) {
    box('chassis', 'Rahmen', 'Stirnblech', [0.012, webH, W], [end * (L / 2 - 0.006), webY, 0]);
  }
  const crossCount = Math.max(2, Math.round(L / 0.9));
  const crossH = webH * 0.7;
  const crossW = W - 2 * pocket - 0.02;
  for (let i = 1; i < crossCount; i++) {
    box('chassis', 'Rahmen', 'Querträger', [0.07, crossH, crossW], [-L / 2 + (i * L) / crossCount, H - deckT - crossH / 2, 0], { wall: 0.005 });
  }

  // ── Fahrwerk ─────────────────────────────────────────────────────────────
  const axleR = Math.max(0.03, R * 0.16);
  const wheelName = `Vollgummirad Ø ${d.wheelDiameterMm}`;
  const wheel = (frame: Frame, x: number, z: number) =>
    parts.push({
      kind: 'wheel',
      frame,
      group: 'Fahrwerk',
      name: wheelName,
      material: 'Vollgummi auf Stahlfelge',
      density: 0,
      massKg: wheelMassKg(d.wheelDiameterMm),
      look: 'tyre',
      radius: R,
      width: wheelW,
      pos: [x, R, z],
    });

  /** Eine Achslinie; mountY ist die Unterkante des Trägers, an dem sie hängt. */
  const axleLine = (frame: Frame, x: number, mountY: number) => {
    const hangerH = mountY - (R - 0.06);
    const hangerY = mountY - hangerH / 2;
    if (d.axleType === 'pendel') {
      for (const side of [1, -1]) {
        // Pendelachse: zwei Räder, mittig am Träger pendelnd gelagert.
        const zc = side * (W / 2 - 0.03 - wheelW - 0.05);
        wheel(frame, x, zc + (wheelW / 2 + 0.05));
        wheel(frame, x, zc - (wheelW / 2 + 0.05));
        rod(frame, 'Fahrwerk', 'Pendelachse Achskörper', axleR, 2 * wheelW + 0.12, 'z', [x, R, zc]);
        box(frame, 'Fahrwerk', 'Pendelbock', [0.17, hangerH, 0.08], [x, hangerY, zc], { wall: 0.01 });
        box(frame, 'Fahrwerk', 'Anschraubplatte', [0.3, 0.02, 0.22], [x, mountY - 0.01, zc]);
        rod(frame, 'Fahrwerk', 'Pendelbolzen', 0.028, 0.24, 'x', [x, mountY - 0.07, zc]);
      }
    } else {
      const zWheel = W / 2 - 0.03 - wheelW / 2;
      wheel(frame, x, zWheel);
      wheel(frame, x, -zWheel);
      rod(frame, 'Fahrwerk', 'Starrachse Achskörper', axleR, 2 * zWheel + wheelW * 0.2, 'z', [x, R, 0]);
      for (const side of [1, -1]) {
        box(frame, 'Fahrwerk', 'Achshalter', [0.15, hangerH, 0.07], [x, hangerY, side * (zWheel - wheelW / 2 - 0.1)], { wall: 0.008 });
      }
    }
  };

  // Hinterachsen hängen an Querträgern direkt unter dem Rahmen.
  for (const xMm of layout.rearAxlesMm) {
    box('chassis', 'Rahmen', 'Achsquerträger', [0.2, 0.08, crossW], [xMm * MM, yBottom + 0.04, 0], { wall: 0.01 });
    axleLine('chassis', xMm * MM, yBottom);
  }

  // ── Drehschemel mit Vorderachsen ─────────────────────────────────────────
  const frontX = layout.frontCenterMm * MM;
  const subH = 0.08;
  const subY = yBottom - 0.05 - subH / 2;
  const subLen = (d.frontAxles - 1) * d.axleSpacingMm * MM + 0.5;
  const subW = W - 0.3;
  const ringR = Math.min(W / 2 - 0.12, 0.6);
  rod('bogie', 'Drehschemel', `Kugeldrehkranz Ø ${Math.round(ringR * 2000)}`, ringR, 0.05, 'y', [0, yBottom - 0.025, 0], {
    innerRadius: ringR - 0.09,
  });
  box('bogie', 'Drehschemel', 'Drehschemelrahmen', [subLen, subH, subW], [0, subY, 0], { wall: 0.012 });
  for (const xMm of layout.frontAxlesMm) {
    axleLine('bogie', xMm * MM - frontX, subY - subH / 2);
  }

  // Die Aufnahme reicht bis vor die Ladefläche, damit die Deichsel frei hochklappen kann.
  const hingeX = L / 2 + 0.12 - frontX;
  const tongueW = Math.min(0.7, subW);
  box('bogie', 'Drehschemel', 'Deichselaufnahme', [hingeX - subLen / 2 + 0.02, subH, tongueW], [(hingeX + subLen / 2) / 2, subY, 0], { wall: 0.01 });

  // ── Deichsel ─────────────────────────────────────────────────────────────
  const drawbarLength = Math.min(1.1 + 0.012 * config.payloadT, 1.7);
  const z0 = tongueW / 2 - 0.05;
  const armEndX = drawbarLength * 0.8;
  const armEndZ = 0.035;
  for (const side of [1, -1]) {
    const dz = side * (armEndZ - z0);
    box('drawbar', 'Deichsel', 'Zugholm', [Math.hypot(armEndX, dz), 0.07, 0.05], [armEndX / 2, 0, (side * (z0 + armEndZ)) / 2], {
      rotY: Math.atan2(-dz, armEndX),
      wall: 0.005,
    });
  }
  for (const t of [0.3, 0.6]) {
    const zAt = z0 + (armEndZ - z0) * t;
    box('drawbar', 'Deichsel', 'Querstrebe', [0.05, 0.05, 2 * zAt], [armEndX * t, 0, 0], { wall: 0.004 });
  }
  box('drawbar', 'Deichsel', 'Kopfstück', [drawbarLength - armEndX + 0.04, 0.07, 0.12], [(drawbarLength + armEndX) / 2, 0, 0], { wall: 0.008 });
  rod('drawbar', 'Deichsel', 'Gelenkbolzen', 0.024, tongueW + 0.06, 'z', [0, 0, 0]);
  parts.push({
    kind: 'ring',
    frame: 'drawbar',
    group: 'Deichsel',
    name: 'Zugöse',
    look: 'paint',
    ...STEEL,
    radius: 0.058,
    tube: 0.021,
    pos: [drawbarLength + 0.07, 0, 0],
  });

  return {
    parts,
    bogieOrigin: [frontX, 0, 0],
    drawbarOrigin: [hingeX, subY, 0],
    drawbarLength: drawbarLength + 0.15,
    label: {
      x: -L / 2 + (Math.floor(pockets / 2) + 0.5) * (L / pockets),
      y: webY,
      z: W / 2 - pocket + 0.008,
      height: Math.min(webH * 0.5, 0.13),
    },
  };
}

/** Masse eines Bauteils in Kilogramm. */
export function partMassKg(p: Part): number {
  if (p.massKg !== undefined) return p.massKg;
  return partVolumeM3(p) * p.density;
}

function partVolumeM3(p: Part): number {
  switch (p.kind) {
    case 'box': {
      const [a, b, length] = [...p.size].sort((m, n) => m - n);
      const w = p.wall;
      const section = w && a > 2 * w && b > 2 * w ? a * b - (a - 2 * w) * (b - 2 * w) : a * b;
      return section * length;
    }
    case 'cylinder':
      return Math.PI * (p.radius ** 2 - (p.innerRadius ?? 0) ** 2) * p.length;
    case 'ring':
      return 2 * Math.PI ** 2 * p.radius * p.tube ** 2;
    case 'wheel':
      return Math.PI * p.radius ** 2 * p.width;
  }
}
