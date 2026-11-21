/**
 * Bauteilbeschreibung des Anhängers.
 *
 * Diese Liste ist die gemeinsame Quelle für das 3D-Modell, die Stückliste und
 * den STEP-Export. Sie enthält nur Zahlen und Texte, keine 3D-Objekte. Maße in
 * Metern, Massen in Kilogramm.
 *
 * Koordinaten: x in Fahrtrichtung (Deichsel bei +x), y nach oben, z nach rechts.
 */
import {
  STEERING,
  axleLayout,
  hasBoardDeck,
  moduleLengthMm,
  optionName,
  wheelHouseMm,
  wheelMassKg,
  type Derived,
  type TrailerConfig,
  type Tyre,
} from './config';

export type Vec3 = [number, number, number];

/** Oberfläche, mit der ein Bauteil dargestellt wird. */
export type Look =
  | 'paint'
  | 'steel'
  | 'galvanized'
  | 'checker'
  | 'hardwood'
  | 'pine'
  | 'plywood'
  | 'rubber'
  | 'aluminium'
  | 'mesh'
  | 'tarp'
  | 'yellow'
  | 'lampRed'
  | 'lampAmber'
  | 'lampWhite';

/**
 * Bewegliches Bezugssystem: liegt mit seinem Ursprung im übergeordneten System
 * und dreht um eine Achse. `angle` ist die Stellung laut Konfiguration; der
 * STEP-Export nimmt stattdessen die Grundstellung (0).
 */
export interface FrameDef {
  parent: string | null;
  origin: Vec3;
  axis: 'y' | 'z';
  angle: number;
}

export const GROUPS = ['Ladefläche', 'Rahmen', 'Bordwände', 'Dachaufbau', 'Fahrwerk', 'Lenkung', 'Bremse', 'Deichsel', 'Ausstattung'] as const;
export type Group = (typeof GROUPS)[number];

interface PartBase {
  /** Benennung in der Stückliste. */
  name: string;
  group: Group;
  material: string;
  /** Dichte in kg/m³. */
  density: number;
  look: Look;
  /** Name des Bezugssystems, siehe TrailerParts.frames. */
  frame: string;
  /** Mittelpunkt im Bezugssystem. */
  pos: Vec3;
  /** Feste Masse für Zukaufteile; sonst wird aus Volumen und Dichte gerechnet. */
  massKg?: number;
  /** Teil einer Baugruppe, die schon als eigene Position in der Stückliste steht. */
  detail?: boolean;
}

export interface BoxPart extends PartBase {
  kind: 'box';
  size: Vec3;
  /** Drehung um die Hochachse in Radiant. */
  rotY?: number;
  /** Neigung um die Längsachse in Radiant, z. B. für ein Pultdach. */
  rotX?: number;
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

/** Rad mit Felge und Nabe, Achse entlang z. */
export interface WheelPart extends PartBase {
  kind: 'wheel';
  radius: number;
  width: number;
  tyre: Tyre;
  nonMarking: boolean;
}

/** Ringöse (Torus); die Achse steht senkrecht zur Ringebene. */
export interface RingPart extends PartBase {
  kind: 'ring';
  radius: number;
  tube: number;
  axis: 'y' | 'z';
}

export type Part = BoxPart | CylinderPart | WheelPart | RingPart;

export interface TrailerParts {
  parts: Part[];
  /** Bezugssysteme; 'chassis' ist der feste Aufbau. */
  frames: Record<string, FrameDef>;
  /** Wie weit die Deichsel vor die Ladefläche ragt. */
  reach: number;
  /** Größte Höhe über dem Boden, mit Bordwänden, Rungen oder Dach. */
  height: number;
  /** Lage der Traglastangabe auf dem rechten Außenträger. */
  label: { x: number; y: number; z: number; height: number };
  /** Auflageebene für die Darstellung der Last. */
  loadSurfaceY: number;
  /** Nutzbare Länge und Breite des Tiefbetts in Metern, nur beim Tieflader. */
  bed?: { length: number; width: number };
}

const STEEL = { material: 'Stahl S355', density: 7850 };

/** Reifenform je Bereifungsart: Felgenradius und Schulterrundung, bezogen auf Radius bzw. Breite. */
export const TYRE_SHAPE: Record<Tyre, { rim: number; shoulder: number }> = {
  solid: { rim: 0.6, shoulder: 0.07 },
  superElastic: { rim: 0.56, shoulder: 0.22 },
  pneumatic: { rim: 0.5, shoulder: 0.38 },
  polyurethane: { rim: 0.88, shoulder: 0.08 },
};
const MM = 0.001;

/** Winkel der hochgeklappten Deichsel in Radiant. */
export const DRAWBAR_UP = 1.36;

type Extra<T> = Partial<Omit<T, 'kind'>>;

/** Ein Abschnitt des Aufbaus: Ladefläche mit Rahmen zwischen x0 und x1. */
interface Section {
  x0: number;
  x1: number;
  cx: number;
  length: number;
  width: number;
  top: number;
  yBottom: number;
  webH: number;
  webY: number;
  /** Breite der Querträger zwischen den Außenträgern. */
  crossW: number;
  pockets: number;
  pocketCenter: (i: number) => number;
}

export function trailerParts(config: TrailerConfig, d: Derived): TrailerParts {
  const L = config.lengthMm * MM;
  const W = config.widthMm * MM;
  const H = config.deckHeightMm * MM;
  const frameH = d.frameHeightMm * MM;
  const D = d.wheelDiameterMm * MM;
  const R = D / 2;
  const wheelW = d.wheelWidthMm * MM;
  const springH = d.springHeightMm * MM;
  const spacing = d.axleSpacingMm * MM;
  const layout = axleLayout(config, d);
  const frontX = layout.frontCenterMm * MM;
  const rearX = layout.rearCenterMm * MM;
  const frontGroup = (d.frontAxles - 1) * spacing + D;
  const rearGroup = (d.rearAxles - 1) * spacing + D;
  const parts: Part[] = [];
  const frames: Record<string, FrameDef> = {
    chassis: { parent: null, origin: [0, 0, 0], axis: 'y', angle: 0 },
  };

  const box = (frame: string, group: Group, name: string, size: Vec3, pos: Vec3, extra: Extra<BoxPart> = {}) =>
    parts.push({ kind: 'box', frame, group, name, size, pos, look: 'paint', ...STEEL, ...extra });
  const rod = (
    frame: string,
    group: Group,
    name: string,
    radius: number,
    length: number,
    axis: CylinderPart['axis'],
    pos: Vec3,
    extra: Extra<CylinderPart> = {},
  ) => parts.push({ kind: 'cylinder', frame, group, name, radius, length, axis, pos, look: 'steel', ...STEEL, ...extra });
  /** Zukaufteil mit fester Masse. */
  const bought = (massKg: number, material: string) => ({ massKg, material, density: 0 });
  /** Weiteres Einzelteil einer Baugruppe, das in der Stückliste nicht eigens zählt. */
  const DETAIL = { detail: true } as const;
  const round1 = (v: number) => Math.round(v * 10) / 10;

  // ── Aufbau: Ladefläche und Rahmen je Abschnitt ───────────────────────────
  const plateT = config.payloadT <= 10 ? 0.006 : config.payloadT <= 25 ? 0.008 : 0.01;
  const deckT = {
    steel: plateT,
    checker: plateT,
    rubber: plateT + 0.01,
    hardwood: 0.045,
    pine: 0.04,
    plywood: 0.027,
    none: 0,
  }[config.deck];
  const pocket = 0.07;

  const section = (x0: number, x1: number, top: number, height: number, width: number, edgeProtected = false): Section => {
    const length = x1 - x0;
    const cx = (x0 + x1) / 2;
    const edge = edgeProtected && config.edgeProtection !== 'none' && hasBoardDeck(config.deck) ? 0.04 : 0;
    const deckL = length - 2 * edge;
    const deckW = width - 2 * edge;

    if (config.deck === 'steel') {
      box('chassis', 'Ladefläche', 'Deckblech', [length, plateT, width], [cx, top - plateT / 2, 0]);
    } else if (config.deck === 'checker') {
      box('chassis', 'Ladefläche', 'Riffelblech', [length, plateT, width], [cx, top - plateT / 2, 0], { look: 'checker' });
    } else if (config.deck === 'rubber') {
      box('chassis', 'Ladefläche', 'Deckblech', [length, plateT, width], [cx, top - 0.01 - plateT / 2, 0]);
      box('chassis', 'Ladefläche', 'Gummiauflage', [length - 0.02, 0.01, width - 0.02], [cx, top - 0.005, 0], {
        look: 'rubber',
        material: 'Gummi, gerippt',
        density: 1250,
      });
    } else if (config.deck === 'hardwood' || config.deck === 'pine') {
      // Die Bohlen liegen quer zur Fahrtrichtung.
      const hard = config.deck === 'hardwood';
      const count = Math.max(1, Math.round(deckL / 0.2));
      const pitch = deckL / count;
      for (let i = 0; i < count; i++) {
        box('chassis', 'Ladefläche', hard ? 'Hartholzbohle' : 'Kiefernbohle', [pitch - 0.003, deckT, deckW], [cx - deckL / 2 + (i + 0.5) * pitch, top - deckT / 2, 0], {
          look: config.deck,
          material: hard ? 'Hartholz' : 'Kiefer',
          density: hard ? 750 : 520,
          variant: i,
        });
      }
    } else if (config.deck === 'plywood') {
      // Plattenformat höchstens 2.500 × 1.250 mm.
      const nx = Math.ceil(deckL / 2.5);
      const nz = Math.ceil(deckW / 1.25);
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          box('chassis', 'Ladefläche', 'Siebdruckplatte', [deckL / nx - 0.003, deckT, deckW / nz - 0.003], [cx - deckL / 2 + ((i + 0.5) * deckL) / nx, top - deckT / 2, -deckW / 2 + ((j + 0.5) * deckW) / nz], {
            look: 'plywood',
            material: 'Birke, phenolharzbeschichtet',
            density: 700,
          });
        }
      }
    }

    if (edge) {
      const raised = config.edgeProtection === 'raised';
      const h = deckT + (raised ? 0.015 : 0);
      const y = top - deckT + h / 2;
      const name = raised ? 'Abgleitsicherung' : 'Kantenschutzwinkel';
      for (const side of [1, -1]) {
        box('chassis', 'Ladefläche', name, [length, h, edge], [cx, y, side * (width / 2 - edge / 2)], { massKg: round1(length * 2.4) });
        box('chassis', 'Ladefläche', name, [edge, h, deckW], [cx + side * (length / 2 - edge / 2), y, 0], { massKg: round1(deckW * 2.4) });
      }
    }

    const yBottom = top - height;
    const webH = height - deckT;
    const webY = yBottom + webH / 2;
    const pockets = Math.max(2, Math.round(length / 1.1));
    for (const side of [1, -1]) {
      // Außenträger als nach außen offenes U-Profil mit Rippen.
      box('chassis', 'Rahmen', 'Außenträger Stegblech', [length - 0.024, webH, 0.012], [cx, webY, side * (width / 2 - pocket)]);
      box('chassis', 'Rahmen', 'Außenträger Untergurt', [length, 0.014, pocket + 0.006], [cx, yBottom + 0.007, side * (width / 2 - pocket / 2 - 0.003)]);
      for (let i = 1; i < pockets; i++) {
        box('chassis', 'Rahmen', 'Rippe', [0.012, webH - 0.014, pocket - 0.006], [x0 + (i * length) / pockets, webY + 0.007, side * (width / 2 - pocket / 2)]);
      }
      // Die Längsträger reichen von Stirnblech zu Stirnblech.
      box('chassis', 'Rahmen', 'Längsträger', [length - 0.024, webH - 0.02, 0.09], [cx, webY + 0.01, side * width * 0.2], { wall: 0.008 });
    }
    for (const end of [1, -1]) {
      box('chassis', 'Rahmen', 'Stirnblech', [0.012, webH, width], [cx + end * (length / 2 - 0.006), webY, 0]);
    }
    const crossCount = Math.max(2, Math.round(length / 0.9));
    const crossH = webH * 0.7;
    // Querträger reichen von Stegblech zu Stegblech der Außenträger.
    const crossW = width - 2 * pocket - 0.012;
    for (let i = 1; i < crossCount; i++) {
      box('chassis', 'Rahmen', 'Querträger', [0.07, crossH, crossW], [x0 + (i * length) / crossCount, top - deckT - crossH / 2, 0], { wall: 0.005 });
    }

    return { x0, x1, cx, length, width, top, yBottom, webH, webY, crossW, pockets, pocketCenter: (i) => x0 + ((i + 0.5) * length) / pockets };
  };

  // Abschnitte über den Achsgruppen (front, rear) und der Abschnitt, an dessen Seiten Ausstattung sitzt (side).
  let front: Section;
  let rear: Section;
  let side: Section;
  let loadSurfaceY = H;
  let height = H;
  let bed: TrailerParts['bed'];
  /** Tieflader außen laufend: Mitte der Radkästen neben dem Tiefbett. */
  let stubZ: number | undefined;
  /** Stellen, an denen Zubehör auf statt unter dem Aufbau sitzt, weil darunter kein Platz ist. */
  let onDeck: { x: number; y: number; z: number } | undefined;

  if (config.body === 'lowbed') {
    const bedH = config.bedHeightMm * MM;
    const bedFrameH = Math.max(0.1, Math.min(frameH * 0.8, bedH - 0.08));
    const xA = frontX - frontGroup / 2 - 0.35;
    front = section(xA, L / 2, H, frameH, W);
    const gooseneck = (x: number, width: number) =>
      box('chassis', 'Rahmen', 'Kröpfungsblech', [0.016, H - deckT - (bedH - bedFrameH), width], [x, (H - deckT + bedH - bedFrameH) / 2, 0]);

    if (config.rearWheels === 'inside') {
      // Hinterräder unter einem Podest: das Tiefbett liegt zwischen den Achsgruppen.
      const xB = rearX + rearGroup / 2 + 0.3;
      rear = section(-L / 2, xB, H, frameH, W);
      side = section(xB, xA, bedH, bedFrameH, W);
      gooseneck(xA, W);
      gooseneck(xB, W);
      bed = { length: xA - xB, width: W };
    } else {
      // Hinterräder neben dem Tiefbett: es reicht bis zum Heck, die Räder laufen in Radkästen.
      const house = wheelHouseMm(d) * MM;
      const bedW = W - 2 * house;
      side = rear = section(-L / 2, xA, bedH, bedFrameH, bedW);
      gooseneck(xA, bedW);
      stubZ = bedW / 2 + house / 2;
      const houseL = rearGroup + 0.3;
      const coverY = D + springH + 0.15;
      for (const s of [1, -1]) {
        box('chassis', 'Rahmen', 'Radkastenabdeckung', [houseL, 0.008, house], [rearX, coverY + 0.004, s * stubZ]);
        box('chassis', 'Rahmen', 'Radkastenwand', [houseL, coverY - (bedH - bedFrameH), 0.012], [rearX, (coverY + bedH - bedFrameH) / 2, s * (bedW / 2 + 0.006)]);
      }
      bed = { length: xA + L / 2, width: bedW };
    }

    const rampLength = Math.max(0.8, Math.min(2.2, bedH * 3.5));
    if (config.ramp === 'rear') {
      box('chassis', 'Ausstattung', 'Auffahrklappe', [0.04, rampLength, side.width - 0.06], [-L / 2 - 0.02, bedH + rampLength / 2 - 0.02, 0], { wall: 0.004 });
      for (const s of [1, -1]) {
        rod('chassis', 'Ausstattung', 'Klappenscharnier', 0.018, 0.14, 'z', [-L / 2 - 0.02, bedH - 0.012, s * (side.width / 2 - 0.2)], { look: 'galvanized', ...bought(1.2, 'Stahl verzinkt') });
      }
    } else if (config.ramp === 'side') {
      // Seitliche Klappe im freien Teil des Tiefbetts vor den Hinterrädern.
      const freeStart = config.rearWheels === 'inside' ? side.x0 : rearX + rearGroup / 2 + 0.2;
      const width = Math.max(0.6, Math.min(2, xA - freeStart - 0.3));
      const cx = (freeStart + xA) / 2;
      box('chassis', 'Ausstattung', 'Auffahrklappe', [width, rampLength, 0.04], [cx, bedH + rampLength / 2 - 0.02, side.width / 2 + 0.02], { wall: 0.004 });
      for (const s of [1, -1]) {
        rod('chassis', 'Ausstattung', 'Klappenscharnier', 0.018, 0.14, 'x', [cx + s * (width / 2 - 0.2), bedH - 0.012, side.width / 2 + 0.02], { look: 'galvanized', ...bought(1.2, 'Stahl verzinkt') });
      }
    }
    if (config.ramp !== 'none') height = Math.max(height, bedH + rampLength);
    loadSurfaceY = bedH;
    onDeck = { x: xA - 0.3, y: bedH, z: side.width * 0.2 };
  } else if (config.body === 'longload') {
    // Zwei Fahrgestellmodule mit Rungenschemel, verbunden durch ein ausziehbares Langrohr.
    const module = moduleLengthMm(d) * MM;
    front = section(L / 2 - module, L / 2, H, frameH, W);
    side = rear = section(-L / 2, -L / 2 + module, H, frameH, W);
    const tubeY = H - deckT - frameH / 2;
    const gapMin = config.minLengthMm * MM - 2 * module;
    const outer = gapMin + 0.2;
    const inner = (config.maxLengthMm - config.minLengthMm) * MM + 0.9;
    box('chassis', 'Rahmen', 'Langrohr außen', [outer, 0.18, 0.18], [rear.x1 - 0.3 + outer / 2, tubeY, 0], { wall: 0.008 });
    box('chassis', 'Rahmen', 'Langrohr innen', [inner, 0.15, 0.15], [front.x0 + 0.3 - inner / 2, tubeY, 0], { wall: 0.008 });
    rod('chassis', 'Rahmen', 'Absteckbolzen', 0.02, 0.26, 'y', [rear.x1 - 0.3 + outer - 0.12, tubeY, 0], { look: 'galvanized' });
    for (const s of [front, rear]) {
      box('chassis', 'Ladefläche', 'Rungenschemel', [0.18, 0.14, W], [s.cx, H + 0.07, 0], { wall: 0.008 });
      for (const z of [1, -1]) {
        box('chassis', 'Ladefläche', 'Runge', [0.07, 0.7, 0.07], [s.cx, H + 0.49, z * (W / 2 - 0.035)], { wall: 0.005 });
      }
    }
    loadSurfaceY = H + 0.14;
    height = H + 0.84;
    onDeck = { x: rear.cx - 0.35, y: H, z: W * 0.2 };
  } else {
    front = rear = side = section(-L / 2, L / 2, H, frameH, W, true);
  }

  // ── Dachaufbau (nur Plattform) ───────────────────────────────────────────
  const wallH = config.wallType === 'none' ? 0 : config.wallHeightMm * MM;
  const roofed = config.roof !== 'none';
  if (roofed) {
    const post = 0.07;
    const clear = config.roofClearMm * MM;
    // Pultdach: zur rechten Seite hin abfallend.
    const rise = config.roofShape === 'mono' ? Math.round(W * 8) / 100 : 0;
    const pitch = Math.atan(rise / W);
    const eave = (z: number) => H + clear + rise * (0.5 - z / W);
    const mid = H + clear + rise / 2;
    const slope = Math.hypot(W, rise);
    const bays = Math.max(1, Math.ceil((L - post) / 3));
    for (let i = 0; i <= bays; i++) {
      for (const s of [1, -1]) {
        const z = s * (W / 2 - post / 2);
        box('chassis', 'Dachaufbau', 'Dachpfosten', [post, eave(z) - H, post], [-L / 2 + post / 2 + (i * (L - post)) / bays, (H + eave(z)) / 2, z], { wall: 0.004 });
      }
    }
    for (const s of [1, -1]) {
      const z = s * (W / 2 - post / 2);
      box('chassis', 'Dachaufbau', 'Dachlängsholm', [L, 0.06, post], [0, eave(z) + 0.03, z], { wall: 0.004 });
    }
    const bows = Math.max(2, Math.round(L / 1.2));
    for (let i = 0; i <= bows; i++) {
      box('chassis', 'Dachaufbau', 'Dachspriegel', [0.04, 0.04, slope - post], [-L / 2 + 0.03 + (i * (L - 0.06)) / bows, mid + 0.04, 0], { rotX: pitch, wall: 0.003 });
    }
    const area = (L + 0.06) * (slope + 0.06);
    if (config.roof === 'tarp') {
      box('chassis', 'Dachaufbau', 'Dachplane', [L + 0.06, 0.004, slope + 0.06], [0, mid + 0.062, 0], { rotX: pitch, look: 'tarp', ...bought(round1(area * 0.7), 'PVC-Plane 680 g/m²') });
    } else {
      box('chassis', 'Dachaufbau', 'Dachblech', [L + 0.06, 0.004, slope + 0.06], [0, mid + 0.062, 0], { rotX: pitch, look: 'galvanized', ...bought(round1(area * 8.5), 'Stahl-Trapezblech verzinkt') });
    }

    if (config.roofSides !== 'open') {
      const low = H + wallH;
      const mesh = config.roofSides === 'mesh';
      const closure = (name: string, size: Vec3, pos: Vec3) =>
        box('chassis', 'Dachaufbau', name, size, pos, mesh
          ? { look: 'mesh', ...bought(round1(Math.max(size[0], size[2]) * size[1] * 6), 'Stahl, Drahtgitter 50 × 50') }
          : { look: 'tarp', ...bought(round1(Math.max(size[0], size[2]) * size[1] * 0.7), 'PVC-Plane 680 g/m²') });
      for (const s of [1, -1]) {
        // Planen und Gitter liegen außen an den Pfosten an.
        const z = s * (W / 2 + 0.002);
        const top = eave(s * W / 2);
        const sideName = mesh ? 'Schutzgitter seitlich' : config.roofSides === 'curtain' ? 'Vorhangplane' : 'Seitenplane';
        closure(sideName, [L - 0.02, top - low, 0.004], [0, (top + low) / 2, z]);
        if (config.roofSides === 'curtain') {
          box('chassis', 'Dachaufbau', 'Vorhangschiene', [L, 0.03, 0.03], [0, top - 0.015, z + s * 0.017], { look: 'aluminium', material: 'Aluminium', density: 2700, wall: 0.003 });
        }
        closure(mesh ? 'Schutzgitter Stirnseite' : 'Stirnplane', [0.004, mid - low, W - 0.02], [s * (L / 2 + 0.002), (mid + low) / 2, 0]);
      }
    }
    height = eave(-W / 2) + 0.1;
  }

  // ── Bordwände (nur Plattform) ────────────────────────────────────────────
  if (wallH) {
    const post = 0.06;
    const panelT = { wood: 0.03, aluminium: 0.025, mesh: 0.02 }[config.wallMaterial];
    const yWall = H + wallH / 2;
    const panelName = `Bordwand ${optionName('wallMaterial', config.wallMaterial)}`;

    const panel = (length: number, pos: Vec3, alongX: boolean) => {
      const size: Vec3 = alongX ? [length, wallH, panelT] : [panelT, wallH, length];
      if (config.wallMaterial === 'wood') {
        box('chassis', 'Bordwände', panelName, size, pos, { look: 'pine', material: 'Kiefer', density: 520 });
      } else if (config.wallMaterial === 'aluminium') {
        box('chassis', 'Bordwände', panelName, size, pos, { look: 'aluminium', material: 'Aluminium-Hohlkammerprofil', density: 2700, wall: 0.002 });
      } else {
        // Gitterfüllung im Rahmen aus Vierkantrohr; der Rahmen zählt zur Füllung.
        const thin: Vec3 = alongX ? [length - 0.04, wallH - 0.04, 0.004] : [0.004, wallH - 0.04, length - 0.04];
        box('chassis', 'Bordwände', panelName, thin, pos, { look: 'mesh', ...bought(round1(length * wallH * 9), 'Stahl, Drahtgitter 50 × 50') });
        for (const v of [1, -1]) {
          const bar: Vec3 = alongX ? [length, 0.02, 0.02] : [0.02, 0.02, length];
          box('chassis', 'Bordwände', 'Gitterrahmen', bar, [pos[0], yWall + v * (wallH / 2 - 0.01), pos[2]], DETAIL);
          const upright: Vec3 = [0.02, wallH - 0.04, 0.02];
          box('chassis', 'Bordwände', 'Gitterrahmen', upright, alongX ? [pos[0] + v * (length / 2 - 0.01), yWall, pos[2]] : [pos[0], yWall, pos[2] + v * (length / 2 - 0.01)], DETAIL);
        }
      }
      if (config.wallType === 'folding') {
        for (const v of [1, -1]) {
          const at = v * (length / 2 - 0.2);
          const hingePos: Vec3 = alongX ? [pos[0] + at, H + 0.012, pos[2]] : [pos[0], H + 0.012, pos[2] + at];
          rod('chassis', 'Bordwände', 'Scharnier', 0.012, 0.12, alongX ? 'x' : 'z', hingePos, { look: 'galvanized', ...bought(0.4, 'Stahl verzinkt') });
          const latchPos: Vec3 = alongX ? [pos[0] + v * (length / 2 - 0.03), H + wallH - 0.08, pos[2]] : [pos[0], H + wallH - 0.08, pos[2] + v * (length / 2 - 0.03)];
          const latch: Vec3 = alongX ? [0.05, 0.1, panelT + 0.016] : [panelT + 0.016, 0.1, 0.05];
          box('chassis', 'Bordwände', 'Bordwandverschluss', latch, latchPos, { look: 'galvanized', ...bought(0.6, 'Stahl verzinkt') });
        }
      }
    };

    const segX = Math.max(1, Math.ceil((L - post) / 2));
    const segZ = W > 2.6 ? 2 : 1;
    const spanX = (L - post) / segX;
    const spanZ = (W - post) / segZ;
    const postX = (i: number) => -L / 2 + post / 2 + i * spanX;
    const postZ = (j: number) => -W / 2 + post / 2 + j * spanZ;
    const stake = config.wallType === 'plug' ? 0.12 : 0;

    const addPost = (x: number, z: number, corner: boolean) => {
      // Mit Dachaufbau übernehmen die Dachpfosten die Ecken.
      if (corner && roofed) return;
      box('chassis', 'Bordwände', corner ? 'Eckrunge' : 'Mittelrunge', [post, wallH + 0.02 + stake, post], [x, H + (wallH + 0.02 - stake) / 2, z], { wall: 0.004 });
      if (stake && Math.abs(Math.abs(z) - (W / 2 - post / 2)) < 1e-6) {
        // Steckrungen sitzen in Taschen am Außenträger.
        box('chassis', 'Bordwände', 'Rungentasche', [post + 0.02, 0.14, pocket - 0.008], [x, H - deckT - 0.07, Math.sign(z) * (W / 2 - pocket / 2)], { wall: 0.005 });
      }
    };
    for (let i = 0; i <= segX; i++) {
      for (const s of [1, -1]) addPost(postX(i), s * (W / 2 - post / 2), i === 0 || i === segX);
    }
    for (let j = 1; j < segZ; j++) {
      for (const end of [1, -1]) addPost(end * (L / 2 - post / 2), postZ(j), false);
    }
    for (let i = 0; i < segX; i++) {
      for (const s of [1, -1]) panel(spanX - post, [(postX(i) + postX(i + 1)) / 2, yWall, s * (W / 2 - post / 2)], true);
    }
    for (let j = 0; j < segZ; j++) {
      for (const end of [1, -1]) panel(spanZ - post, [end * (L / 2 - post / 2), yWall, (postZ(j) + postZ(j + 1)) / 2], false);
    }
    height = Math.max(height, H + wallH + 0.02);
  }

  // ── Lenkgeometrie ────────────────────────────────────────────────────────
  const mode = STEERING[config.steering];
  // Alle gelenkten Räder rollen um einen gemeinsamen Punkt. Er liegt auf Höhe der
  // Hinterachsen, wenn nur vorn gelenkt wird, sonst mittig zwischen den Achsgruppen.
  const turnX = mode.rear === 'fixed' ? rearX : (frontX + rearX) / 2;
  const steerRad = (config.steeringDeg * Math.PI) / 180;
  let turnRadius = steerRad === 0 ? Infinity : (frontX - turnX) / Math.tan(steerRad);
  // Einzeln gelenkte Räder brauchen einen Drehpunkt außerhalb der Spur.
  if (mode.front === 'knuckle' && Math.abs(turnRadius) < W / 2 + 0.3) turnRadius = Math.sign(turnRadius) * (W / 2 + 0.3);
  /**
   * Drehwinkel eines gelenkten Teils an der Stelle (x, z) um die Hochachse.
   * Rechts ist +z; ein Einschlag nach rechts dreht daher um -y.
   */
  const steerAngleAt = (x: number, z: number) =>
    Number.isFinite(turnRadius) ? -Math.atan((x - turnX) / (turnRadius - z)) : 0;
  let knuckles = 0;

  // ── Räder, Achsen, Federung, Bremsen ─────────────────────────────────────
  const axleR = Math.max(0.03, R * 0.16);
  const tyreName = optionName('tyre', config.tyre);
  const wheelName = `Rad ${tyreName} Ø ${d.wheelDiameterMm}${config.nonMarking ? ', spurfrei' : ''}`;
  const wheel = (frame: string, x: number, z: number) =>
    parts.push({
      kind: 'wheel',
      frame,
      group: 'Fahrwerk',
      name: wheelName,
      material: `${tyreName} auf Stahlfelge`,
      density: 0,
      massKg: wheelMassKg(d.wheelDiameterMm, config.tyre),
      look: 'steel',
      radius: R,
      width: wheelW,
      tyre: config.tyre,
      nonMarking: config.nonMarking,
      pos: [x, R, z],
    });

  const brakeName = config.brake === 'electric' ? 'Elektromagnetbremse' : 'Trommelbremse';
  const brakeUnit = (frame: string, x: number, z: number, inward: number) => {
    rod(frame, 'Bremse', brakeName, R * 0.42, 0.05, 'z', [x, R, z], bought(Math.round(12 * (D / 0.5) ** 2), 'Grauguss / Stahl'));
    if (config.brake === 'air') {
      rod(frame, 'Bremse', 'Membranbremszylinder', 0.07, 0.13, 'x', [x - R * 0.42 - 0.02, R + 0.02, z + inward * 0.06], bought(4.5, 'Stahl / Gummi'));
    } else if (config.brake === 'hydraulic') {
      rod(frame, 'Bremse', 'Radbremszylinder', 0.03, 0.1, 'x', [x - R * 0.42 - 0.02, R + 0.02, z + inward * 0.04], bought(1.2, 'Grauguss'));
    }
  };

  /** Höhe der Spurstange: bei Pendelachsen oben unter dem Träger, bei Starrachsen auf Achshöhe zwischen den Achsschenkeln. */
  const tieRodY = (mountY: number) => (d.axleType === 'pendel' ? mountY - 0.09 : R);
  /**
   * Lage der Spurstange in Fahrtrichtung, bezogen auf die Achse: bei Pendelachsen dahinter,
   * bei Starrachsen davor, damit die Schubstange zur Deichsel die Achse nicht kreuzt.
   */
  const tieRodDx = d.axleType === 'pendel' ? -0.2 : 0.2;

  /**
   * Eine Achslinie. mountY ist die Unterkante des Trägers, an dem sie hängt;
   * eine Federung sitzt zwischen Träger und Achshalter. Bei steered lenkt jede
   * Pendelachse bzw. jedes Rad um einen eigenen Zapfen (nur am festen Aufbau).
   * Mit stub hängen die Räder je Seite einzeln bei z = ±stub, ohne durchgehende Achse.
   */
  const axleLine = (frame: string, x: number, mountY: number, braked: boolean, steered = false, stub?: number) => {
    // Eigenes Bezugssystem für ein gelenktes Teil, mit Ursprung auf dem Boden unter dem Zapfen.
    const knuckle = (z: number) => {
      const name = `knuckle${knuckles++}`;
      frames[name] = { parent: frame, origin: [x, 0, z], axis: 'y', angle: steerAngleAt(x, z) };
      return name;
    };
    const spring = (f: string, fx: number, z: number, y: number) => {
      if (config.suspension === 'rubber') {
        box(f, 'Fahrwerk', 'Gummifederelement', [0.2, springH, 0.12], [fx, y - springH / 2, z], { look: 'rubber', ...bought(4, 'Gummi-Metall') });
      } else if (config.suspension === 'leaf') {
        const length = Math.min(0.8, spacing - 0.04);
        // Die Federböcke hängen an einer Platte, die am Achsträger darüber verschraubt ist.
        box(f, 'Fahrwerk', 'Federträgerplatte', [length, 0.02, 0.1], [fx, y - 0.01, z]);
        box(f, 'Fahrwerk', 'Blattfederpaket', [length, 0.05, 0.07], [fx, y - springH + 0.025, z], { look: 'steel', ...bought(Math.round(length * 28), 'Federstahl') });
        for (const end of [1, -1]) {
          box(f, 'Fahrwerk', 'Federbock', [0.06, springH - 0.03, 0.09], [fx + end * (length / 2 - 0.03), y - (springH - 0.03) / 2, z]);
        }
      } else if (config.suspension === 'air') {
        rod(f, 'Fahrwerk', 'Luftfederbalg', 0.1, springH, 'y', [fx, y - springH / 2, z], { look: 'rubber', ...bought(6, 'Gummi / Stahl') });
      }
    };

    if (d.axleType === 'pendel') {
      for (const s of [1, -1]) {
        // Pendelachse: zwei Räder, mittig am Träger pendelnd gelagert.
        const zc = s * (stub ?? W / 2 - 0.03 - wheelW - 0.05);
        box(frame, 'Fahrwerk', 'Anschraubplatte', [0.3, 0.02, 0.22], [x, mountY - 0.01, zc]);
        // Gelenkt dreht die ganze Pendelachse auf einem kleinen Drehkranz unter der Platte.
        const f = steered ? knuckle(zc) : frame;
        const fx = steered ? 0 : x;
        const fz = steered ? 0 : zc;
        const under = steered ? mountY - 0.05 : mountY;
        if (steered) {
          rod(f, 'Lenkung', 'Lenkdrehkranz', 0.11, 0.03, 'y', [0, mountY - 0.035, 0], { innerRadius: 0.05 });
          // Der Lenkhebel verbindet die Pendelachse mit der Spurstange dahinter.
          box(f, 'Lenkung', 'Lenkhebel', [0.24, 0.03, 0.04], [tieRodDx * 0.55, tieRodY(mountY), 0], { look: 'steel' });
        }
        const top = under - springH;
        const hangerH = top - (R - 0.06);
        wheel(f, fx, fz + (wheelW / 2 + 0.05));
        wheel(f, fx, fz - (wheelW / 2 + 0.05));
        rod(f, 'Fahrwerk', 'Pendelachse Achskörper', axleR, 2 * wheelW + 0.12, 'z', [fx, R, fz]);
        box(f, 'Fahrwerk', 'Pendelbock', [0.17, hangerH, 0.08], [fx, top - hangerH / 2, fz], { wall: 0.01 });
        rod(f, 'Fahrwerk', 'Pendelbolzen', 0.028, 0.24, 'x', [fx, top - 0.07, fz]);
        spring(f, fx, fz, under);
        if (braked) brakeUnit(f, fx, fz - s * (wheelW + 0.075), -s);
      }
    } else {
      const zWheel = stub ?? W / 2 - 0.03 - wheelW / 2;
      const top = mountY - springH;
      const hangerH = top - (R - 0.06);
      const inner = zWheel - wheelW / 2;
      if (stub === undefined) {
        rod(frame, 'Fahrwerk', 'Starrachse Achskörper', axleR, steered ? 2 * (inner - 0.115) : 2 * zWheel + wheelW * 0.2, 'z', [x, R, 0]);
      }
      for (const s of [1, -1]) {
        // Einzeln aufgehängte Räder sitzen auf einem kurzen Achsstummel direkt am Halter.
        const zHanger = s * (inner - (stub === undefined ? 0.16 : 0.045));
        if (stub !== undefined) rod(frame, 'Fahrwerk', 'Achsstummel', axleR, wheelW + 0.14, 'z', [x, R, s * (zWheel - 0.02)]);
        box(frame, 'Fahrwerk', 'Achshalter', [0.15, hangerH, 0.07], [x, top - hangerH / 2, zHanger], { wall: 0.008 });
        spring(frame, x, zHanger, mountY);
        // Gelenkt schwenkt nur das Rad am Achsschenkel, die Achse bleibt fest.
        const f = steered ? knuckle(s * zWheel) : frame;
        const fx = steered ? 0 : x;
        const fz = steered ? 0 : s * zWheel;
        wheel(f, fx, fz);
        if (steered) {
          box(f, 'Lenkung', 'Achsschenkel', [0.1, 0.14, 0.06], [0, R, -s * (wheelW / 2 + 0.085)], { look: 'steel' });
          // Das Rad läuft auf einem Zapfen am Achsschenkel; der Lenkhebel greift an der Spurstange an.
          rod(f, 'Lenkung', 'Achszapfen', axleR, wheelW * 0.9 + 0.115, 'z', [0, R, -s * (wheelW * 0.05 + 0.0575)]);
          box(f, 'Lenkung', 'Lenkhebel', [0.2, 0.03, 0.04], [tieRodDx * 0.6, tieRodY(mountY), -s * (wheelW / 2 + 0.085)], { look: 'steel' });
        }
        if (braked) brakeUnit(f, fx, fz - s * (wheelW / 2 + 0.025), -s);
      }
    }
  };

  /** Spurstange, die die Lenkhebel einer gelenkten Achslinie verbindet. */
  const tieRod = (x: number, mountY: number) => {
    const span = d.axleType === 'pendel' ? 2 * (W / 2 - 0.03 - wheelW - 0.05) : 2 * (W / 2 - 0.03 - wheelW - 0.085);
    rod('chassis', 'Lenkung', 'Spurstange', 0.016, span + 0.04, 'z', [x + tieRodDx, tieRodY(mountY), 0], { look: 'galvanized' });
  };

  // Die Auflaufbremse wirkt über die Deichsel auf die Vorderachsen, alle anderen auf die Hinterachsen.
  const frontBraked = config.brake === 'overrun';
  const rearBraked = config.parkingBrake || (config.brake !== 'none' && config.brake !== 'overrun');

  // ── Achsgruppen ──────────────────────────────────────────────────────────
  const subH = 0.08;
  const subW = W - 0.3;
  const tongueW = Math.min(mode.front === 'bogie' ? 0.7 : 0.5, subW);
  /** Mitte des Schemelrahmens unter einem Abschnitt. */
  const subYOf = (s: Section) => s.yBottom - 0.05 - subH / 2;

  /** Achsgruppe auf einem Drehschemel; liefert die halbe Länge des Schemelrahmens. */
  const bogie = (name: string, s: Section, centerX: number, linesMm: number[], braked: boolean) => {
    frames[name] = { parent: 'chassis', origin: [centerX, 0, 0], axis: 'y', angle: steerAngleAt(centerX, 0) };
    const subLen = (linesMm.length - 1) * spacing + 0.5;
    // Der Drehkranz bleibt unter dem Abschnitt, an dem er hängt.
    const ringR = Math.min(W / 2 - 0.12, 0.6, centerX - s.x0 - 0.03, s.x1 - centerX - 0.03);
    rod(name, 'Lenkung', `Kugeldrehkranz Ø ${Math.round(ringR * 2000)}`, ringR, 0.05, 'y', [0, s.yBottom - 0.025, 0], { innerRadius: ringR - 0.09 });

    // Oben ist der Kranz am Aufbau verschraubt: an einem Ringflansch unter den Längsträgern,
    // den zwei Träger zwischen den Außenträgern aussteifen. Unten sitzt er auf dem Schemelrahmen.
    const flangeT = 0.02;
    rod('chassis', 'Lenkung', 'Drehkranzflansch', ringR + 0.03, flangeT, 'y', [centerX, s.yBottom + flangeT / 2, 0], { innerRadius: ringR - 0.12, look: 'paint' });
    const carrierH = Math.min(0.1, s.webH - 0.03);
    for (const end of [1, -1]) {
      box('chassis', 'Lenkung', 'Drehkranzträger', [0.12, carrierH, s.crossW], [centerX + end * (ringR - 0.045), s.yBottom + flangeT + carrierH / 2, 0], { wall: 0.008 });
    }
    box(name, 'Lenkung', 'Drehschemelrahmen', [subLen, subH, subW], [0, subYOf(s), 0], { wall: 0.012 });
    for (const xMm of linesMm) axleLine(name, xMm * MM - centerX, subYOf(s) - subH / 2, braked);
    return subLen / 2;
  };
  /** Achsgruppe direkt unter einem Abschnitt, starr oder mit einzeln gelenkten Rädern. */
  const underFrame = (s: Section, linesMm: number[], braked: boolean, steered: boolean) => {
    for (const xMm of linesMm) {
      box('chassis', 'Rahmen', 'Achsquerträger', [0.2, 0.08, s.crossW], [xMm * MM, s.yBottom + 0.04, 0], { wall: 0.01 });
      axleLine('chassis', xMm * MM, s.yBottom, braked, steered);
      if (steered) tieRod(xMm * MM, s.yBottom);
    }
  };

  if (stubZ !== undefined) {
    // Tieflader mit außen laufenden Hinterrädern: je Seite ein Achsträger im Radkasten.
    const house = wheelHouseMm(d) * MM;
    const mountY = D + springH + 0.07;
    for (const xMm of layout.rearAxlesMm) {
      for (const s of [1, -1]) {
        box('chassis', 'Rahmen', 'Achsträger im Radkasten', [0.2, 0.08, house - 0.02], [xMm * MM, mountY + 0.04, s * stubZ], { wall: 0.01 });
      }
      axleLine('chassis', xMm * MM, mountY, rearBraked, false, stubZ);
    }
  } else if (mode.rear === 'bogie') {
    bogie('bogieRear', rear, rearX, layout.rearAxlesMm, rearBraked);
    // Die Koppelstange lenkt den hinteren Drehschemel gegenläufig mit. Bei geteiltem
    // Aufbau wäre sie im Laderaum im Weg; dort ist eine hydraulische Kopplung anzunehmen.
    if (config.body === 'platform') {
      rod('chassis', 'Lenkung', 'Koppelstange', 0.02, frontX - rearX, 'x', [(frontX + rearX) / 2, subYOf(rear), 0.25], { look: 'galvanized' });
    }
  } else {
    underFrame(rear, layout.rearAxlesMm, rearBraked, mode.rear === 'knuckle');
  }

  // Die Deichsel hängt an einer Aufnahme, die bis vor die Ladefläche reicht,
  // damit sie frei hochklappen kann: am Drehschemel oder an einem eigenen Lenkbock.
  const subY = subYOf(front);
  let drawbarParent: string;
  let hingeX: number;
  if (mode.front === 'bogie') {
    const half = bogie('bogieFront', front, frontX, layout.frontAxlesMm, frontBraked);
    drawbarParent = 'bogieFront';
    hingeX = L / 2 + 0.12 - frontX;
    box('bogieFront', 'Lenkung', 'Deichselaufnahme', [hingeX - half + 0.02, subH, tongueW], [(hingeX + half) / 2, subY, 0], { wall: 0.01 });
  } else {
    underFrame(front, layout.frontAxlesMm, frontBraked, true);
    const pivotX = L / 2 - 0.2;
    frames.tongue = { parent: 'chassis', origin: [pivotX, subY, 0], axis: 'y', angle: -steerRad };
    drawbarParent = 'tongue';
    hingeX = 0.32;
    // Der Lenkbock sitzt unter einem eigenen Träger zwischen den Außenträgern.
    box('chassis', 'Lenkung', 'Lenkbockträger', [0.2, 0.08, front.crossW], [pivotX, front.yBottom + 0.04, 0], { wall: 0.01 });
    box('chassis', 'Lenkung', 'Lenkbock', [0.34, 0.05, tongueW], [pivotX, front.yBottom - 0.025, 0]);
    rod('tongue', 'Lenkung', 'Lenkbolzen', 0.03, 0.16, 'y', [0, 0, 0]);
    box('tongue', 'Lenkung', 'Deichselaufnahme', [hingeX + 0.14, subH, tongueW], [hingeX / 2 - 0.05, 0, 0], { wall: 0.01 });
    // Die Schubstange überträgt den Deichseleinschlag auf die Spurstange der ersten Achse.
    const firstAxle = Math.max(...layout.frontAxlesMm) * MM;
    const rodY = tieRodY(front.yBottom);
    const rodStart = firstAxle + tieRodDx;
    rod('chassis', 'Lenkung', 'Lenkschubstange', 0.016, pivotX - rodStart, 'x', [(pivotX + rodStart) / 2, rodY, 0.12], { look: 'galvanized' });
    // Liegt die Spurstange auf Achshöhe, führt ein Hebel von der Deichselaufnahme zu ihr hinunter.
    if (rodY < subY - subH / 2) {
      box('tongue', 'Lenkung', 'Lenkhebel Deichsel', [0.04, subY - subH / 2 - rodY + 0.03, 0.04], [-0.02, (rodY - 0.03 - subY - subH / 2) / 2, 0.12], { look: 'steel' });
    }
  }

  // ── Deichsel ─────────────────────────────────────────────────────────────
  const drawbarLength = Math.min(1.1 + 0.012 * config.payloadT, 1.7);
  const tip = drawbarLength + 0.13;
  // Abgesenkt zeigt die Deichsel auf die Kupplungshöhe des Zugfahrzeugs, sofern angegeben.
  const rest =
    config.couplingHeightMm === null
      ? 0
      : Math.asin(Math.max(-0.45, Math.min(0.45, (config.couplingHeightMm * MM - subY) / tip)));
  frames.drawbar = { parent: drawbarParent, origin: [hingeX, drawbarParent === 'tongue' ? 0 : subY, 0], axis: 'z', angle: config.drawbarUp ? DRAWBAR_UP : rest };

  const z0 = tongueW / 2 - 0.05;
  const armEndX = drawbarLength * 0.8;
  const armEndZ = 0.035;
  for (const s of [1, -1]) {
    const dz = s * (armEndZ - z0);
    box('drawbar', 'Deichsel', 'Zugholm', [Math.hypot(armEndX, dz), 0.07, 0.05], [armEndX / 2, 0, (s * (z0 + armEndZ)) / 2], {
      rotY: Math.atan2(-dz, armEndX),
      wall: 0.005,
    });
  }
  for (const t of [0.3, 0.6]) {
    const zAt = z0 + (armEndZ - z0) * t;
    box('drawbar', 'Deichsel', 'Querstrebe', [0.05, 0.05, 2 * zAt], [armEndX * t, 0, 0], { wall: 0.004 });
  }
  // Das Kopfstück ist massiv, damit die Zugöse darin sitzt und nicht in einem Hohlprofil endet.
  box('drawbar', 'Deichsel', 'Kopfstück', [drawbarLength - armEndX + 0.04, 0.07, 0.12], [(drawbarLength + armEndX) / 2, 0, 0]);
  rod('drawbar', 'Deichsel', 'Gelenkbolzen', 0.024, tongueW + 0.06, 'z', [0, 0, 0]);
  if (config.towEye === 'din') {
    parts.push({ kind: 'ring', frame: 'drawbar', group: 'Deichsel', name: 'DIN-Zugöse', look: 'paint', ...STEEL, radius: 0.058, tube: 0.021, axis: 'y', pos: [drawbarLength + 0.07, 0, 0] });
  } else {
    rod('drawbar', 'Deichsel', 'Flachstahl-Zugöse', 0.075, 0.03, 'y', [drawbarLength + 0.075, 0, 0], { innerRadius: 0.028, look: 'paint' });
  }
  if (config.drawbarSpring) {
    // Die Feder liegt zwischen zwei Lagern, die auf den Querstreben stehen.
    rod('drawbar', 'Deichsel', 'Deichselfeder mit Höheneinstellung', 0.035, armEndX * 0.3 + 0.03, 'x', [armEndX * 0.45, 0.095, 0], bought(6.5, 'Federstahl'));
    for (const t of [0.3, 0.6]) box('drawbar', 'Deichsel', 'Federlager', [0.03, 0.09, 0.06], [armEndX * t, 0.07, 0], DETAIL);
  }

  // ── Bremsanlage ──────────────────────────────────────────────────────────
  // Außenflächen der Stirnbleche vorn und hinten; Anbauteile liegen dort an.
  const frontEnd = L / 2;
  const connectorY = front.yBottom + Math.min(front.webH * 0.5, 0.1);
  if (config.brake === 'overrun') {
    box('drawbar', 'Bremse', 'Auflaufeinrichtung', [0.3, 0.09, 0.14], [drawbarLength - 0.08, 0.08, 0], { look: 'steel', ...bought(18, 'Stahlguss') });
    // Das Gestänge läuft in Führungen unter den Querstreben.
    rod('drawbar', 'Bremse', 'Bremsgestänge', 0.008, drawbarLength - 0.3, 'x', [(drawbarLength - 0.3) / 2, -0.03, 0], { look: 'galvanized' });
  } else if (config.brake === 'air') {
    const tankLength = Math.min(0.7, side.crossW - 0.2);
    let tank: Vec3;
    if (config.body === 'lowbed') {
      // Unter dem Tiefbett ist kein Platz: der Behälter liegt in einem Sattel an dessen Stirnwand.
      const x = onDeck!.x + 0.14;
      box('chassis', 'Bremse', 'Behälterhalter', [0.3, 0.02, Math.max(tankLength, 0.4 * side.width + 0.1)], [x, onDeck!.y + 0.01, 0], { look: 'galvanized' });
      tank = [x, onDeck!.y + 0.02 + 0.13, 0];
    } else {
      // Der Behälter hängt an einem Halter, der unter die Längsträger geschraubt ist.
      const s = config.body === 'longload' ? rear : side;
      const x = config.body === 'longload' ? rear.x1 - 0.16 : (frontX + rearX) / 2;
      box('chassis', 'Bremse', 'Behälterhalter', [0.3, 0.02, 0.4 * s.width + 0.09], [x, s.yBottom + 0.01, 0], { look: 'galvanized' });
      tank = [x, s.yBottom - 0.13, 0];
    }
    rod('chassis', 'Bremse', 'Druckluftbehälter', 0.13, tankLength, 'z', tank, { look: 'steel', ...bought(14, 'Stahl') });
    box('chassis', 'Bremse', 'Kupplungskopf Vorrat', [0.04, 0.06, 0.06], [frontEnd + 0.02, connectorY, 0.32], { look: 'lampRed', ...bought(0.5, 'Aluminium') });
    box('chassis', 'Bremse', 'Kupplungskopf Bremse', [0.04, 0.06, 0.06], [frontEnd + 0.02, connectorY, 0.2], { look: 'yellow', ...bought(0.5, 'Aluminium') });
  } else if (config.brake === 'hydraulic') {
    rod('chassis', 'Bremse', 'Hydraulikanschluss', 0.018, 0.06, 'x', [frontEnd + 0.03, connectorY, 0.26], { look: 'galvanized', ...bought(0.4, 'Stahl verzinkt') });
  } else if (config.brake === 'electric') {
    box('chassis', 'Bremse', 'Anschlussdose Bremse', [0.05, 0.09, 0.09], [frontEnd + 0.025, connectorY, 0.26], { look: 'steel', ...bought(0.6, 'Kunststoff') });
  }
  if (config.parkingBrake) {
    const x = Math.max(side.x0 + 0.2, Math.min(side.x1 - 0.3, rearX + 1.2));
    box('chassis', 'Bremse', 'Feststellbremse mit Spindel', [0.09, Math.max(0.04, Math.min(0.16, side.webH - 0.03)), 0.05], [x, side.webY, side.width / 2 - pocket / 2 - 0.004], { look: 'steel', ...bought(7, 'Stahl') });
    rod('chassis', 'Bremse', 'Handkurbel', 0.012, 0.16, 'z', [x, side.webY, side.width / 2 + 0.05], { look: 'galvanized', ...DETAIL });
  }

  // ── Ausstattung ──────────────────────────────────────────────────────────
  const rearEnd = -L / 2;
  if (config.rearCoupling === 'pin') {
    const y = rear.yBottom + 0.05;
    box('chassis', 'Ausstattung', 'Steckbolzenkupplung', [0.16, 0.025, 0.12], [rearEnd - 0.08, y + 0.045, 0], { look: 'steel', ...bought(9, 'Stahl') });
    box('chassis', 'Ausstattung', 'Kupplungsmaul', [0.16, 0.025, 0.12], [rearEnd - 0.08, y - 0.045, 0], { look: 'steel', ...DETAIL });
    rod('chassis', 'Ausstattung', 'Steckbolzen', 0.016, 0.17, 'y', [rearEnd - 0.11, y + 0.01, 0], { look: 'galvanized', ...DETAIL });
  } else if (config.rearCoupling === 'automatic') {
    const y = rear.yBottom + 0.07;
    box('chassis', 'Ausstattung', 'Automatische Anhängerkupplung', [0.2, 0.2, 0.18], [rearEnd - 0.1, y, 0], { look: 'steel', ...bought(28, 'Stahlguss') });
    box('chassis', 'Ausstattung', 'Fangmaul', [0.07, 0.16, 0.34], [rearEnd - 0.235, y, 0], { look: 'steel', ...DETAIL });
    rod('chassis', 'Ausstattung', 'Handhebel', 0.012, 0.18, 'z', [rearEnd - 0.1, y + 0.11, 0.1], { look: 'galvanized', ...DETAIL });
  }

  if (config.lashingRings && config.body !== 'longload') {
    for (let i = 0; i < side.pockets; i++) {
      for (const s of [1, -1]) {
        const x = side.pocketCenter(i) + (side.length / side.pockets) * 0.27;
        const z = s * (side.width / 2 - pocket + 0.006);
        parts.push({ kind: 'ring', frame: 'chassis', group: 'Ausstattung', name: 'Zurröse', look: 'galvanized', ...bought(0.9, 'Stahl verzinkt'), radius: 0.032, tube: 0.007, axis: 'z', pos: [x, side.webY - 0.02, z + s * 0.009] });
        box('chassis', 'Ausstattung', 'Zurrösenbock', [0.05, 0.03, 0.02], [x, side.webY + 0.02, z + s * 0.01], { look: 'galvanized', ...DETAIL });
      }
    }
  }

  const lampH = Math.min(0.1, rear.webH * 0.7);
  if (config.lighting === 'internal') {
    for (const s of [1, -1]) {
      box('chassis', 'Ausstattung', 'Rückleuchte', [0.025, lampH, 0.14], [rearEnd - 0.0125, rear.webY, s * (rear.width / 2 - 0.3)], { look: 'lampRed', ...bought(0.4, 'Kunststoff') });
    }
  } else if (config.lighting === 'stvzo') {
    for (const s of [1, -1]) {
      box('chassis', 'Ausstattung', 'Mehrkammer-Rückleuchte', [0.03, lampH, 0.24], [rearEnd - 0.015, rear.webY, s * (rear.width / 2 - 0.36)], { look: 'lampRed', ...bought(0.9, 'Kunststoff') });
      box('chassis', 'Ausstattung', 'Blinkerkammer', [0.03, lampH, 0.1], [rearEnd - 0.015, rear.webY, s * (rear.width / 2 - 0.18)], { look: 'lampAmber', ...DETAIL });
      box('chassis', 'Ausstattung', 'Begrenzungsleuchte vorn', [0.02, 0.05, 0.08], [frontEnd + 0.01, front.webY, s * (W / 2 - 0.12)], { look: 'lampWhite', ...bought(0.2, 'Kunststoff') });
      const markers = Math.max(2, Math.ceil(side.length / 3));
      for (let i = 0; i < markers; i++) {
        box('chassis', 'Ausstattung', 'Seitenmarkierungsleuchte', [0.1, 0.035, 0.02], [side.x0 + ((i + 0.5) * side.length) / markers + 0.12, side.yBottom + 0.0315, s * (side.width / 2 - 0.012)], { look: 'lampAmber', ...bought(0.15, 'Kunststoff') });
      }
    }
    box('chassis', 'Ausstattung', 'Kennzeichenhalter', [0.006, Math.min(0.12, rear.webH), 0.53], [rearEnd - 0.003, rear.webY, 0], { look: 'lampWhite', ...bought(0.5, 'Kunststoff') });
  }

  if (config.chocks !== 'none') {
    const double = config.chocks === 'double';
    const name = `Unterlegkeil ${double ? 'doppelt' : 'einfach'} wirkend`;
    const length = double ? 0.42 : 0.32;
    for (const s of [1, -1]) {
      if (onDeck) {
        // Unter dem Aufbau ist kein Platz: die Keile stehen in Haltern auf der Ladefläche.
        box('chassis', 'Ausstattung', name, [length, 0.15, 0.16], [onDeck.x, onDeck.y + 0.085, s * onDeck.z], { look: 'yellow', ...bought(double ? 4.8 : 3.4, 'Kunststoff') });
        box('chassis', 'Ausstattung', 'Keilhalter', [length + 0.04, 0.01, 0.18], [onDeck.x, onDeck.y + 0.005, s * onDeck.z], { look: 'galvanized', ...bought(1.2, 'Stahl verzinkt') });
      } else {
        const x = rearX + rearGroup / 2 + 0.45;
        // Der Halter ist unter den Untergurt des Außenträgers geschraubt.
        box('chassis', 'Ausstattung', name, [length, 0.15, 0.16], [x, side.yBottom - 0.085, s * (side.width / 2 - 0.09)], { look: 'yellow', ...bought(double ? 4.8 : 3.4, 'Kunststoff') });
        box('chassis', 'Ausstattung', 'Keilhalter', [length + 0.04, 0.01, 0.18], [x, side.yBottom - 0.005, s * (side.width / 2 - 0.09)], { look: 'galvanized', ...bought(1.2, 'Stahl verzinkt') });
      }
    }
  }

  return {
    parts,
    frames,
    reach: 0.12 + tip + 0.06,
    height,
    label: {
      x: side.pocketCenter(Math.floor(side.pockets / 2)),
      y: side.webY,
      z: side.width / 2 - pocket + 0.008,
      height: Math.min(side.webH * 0.5, 0.13),
    },
    loadSurfaceY,
    bed,
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
