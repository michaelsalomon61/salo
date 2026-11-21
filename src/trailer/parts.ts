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
  axleLayout,
  hasBoardDeck,
  optionName,
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

export const GROUPS = ['Ladefläche', 'Rahmen', 'Bordwände', 'Fahrwerk', 'Bremse', 'Drehschemel', 'Deichsel', 'Ausstattung'] as const;
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
  /** Größte Höhe über dem Boden, mit Bordwänden. */
  height: number;
  /** Lage der Traglastangabe auf dem rechten Außenträger. */
  label: { x: number; y: number; z: number; height: number };
  /** Auflageebene für die Darstellung der Last. */
  loadSurfaceY: number;
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

export function trailerParts(config: TrailerConfig, d: Derived): TrailerParts {
  const L = config.lengthMm * MM;
  const W = config.widthMm * MM;
  const H = config.deckHeightMm * MM;
  const frameH = d.frameHeightMm * MM;
  const D = d.wheelDiameterMm * MM;
  const R = D / 2;
  const wheelW = d.wheelWidthMm * MM;
  const springH = d.springHeightMm * MM;
  const layout = axleLayout(config, d);
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

  // ── Ladefläche ───────────────────────────────────────────────────────────
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
  const edge = config.edgeProtection !== 'none' && hasBoardDeck(config.deck) ? 0.04 : 0;
  const deckL = L - 2 * edge;
  const deckW = W - 2 * edge;

  if (config.deck === 'steel') {
    box('chassis', 'Ladefläche', 'Deckblech', [L, plateT, W], [0, H - plateT / 2, 0]);
  } else if (config.deck === 'checker') {
    box('chassis', 'Ladefläche', 'Riffelblech', [L, plateT, W], [0, H - plateT / 2, 0], { look: 'checker' });
  } else if (config.deck === 'rubber') {
    box('chassis', 'Ladefläche', 'Deckblech', [L, plateT, W], [0, H - 0.01 - plateT / 2, 0]);
    box('chassis', 'Ladefläche', 'Gummiauflage', [L - 0.02, 0.01, W - 0.02], [0, H - 0.005, 0], {
      look: 'rubber',
      material: 'Gummi, gerippt',
      density: 1250,
    });
  } else if (config.deck === 'hardwood' || config.deck === 'pine') {
    const hard = config.deck === 'hardwood';
    const count = Math.max(1, Math.round(deckW / 0.2));
    const pitch = deckW / count;
    for (let i = 0; i < count; i++) {
      box('chassis', 'Ladefläche', hard ? 'Hartholzbohle' : 'Kiefernbohle', [deckL, deckT, pitch - 0.003], [0, H - deckT / 2, -deckW / 2 + (i + 0.5) * pitch], {
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
        box('chassis', 'Ladefläche', 'Siebdruckplatte', [deckL / nx - 0.003, deckT, deckW / nz - 0.003], [-deckL / 2 + ((i + 0.5) * deckL) / nx, H - deckT / 2, -deckW / 2 + ((j + 0.5) * deckW) / nz], {
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
    const y = H - deckT + h / 2;
    const name = raised ? 'Abgleitsicherung' : 'Kantenschutzwinkel';
    const angle = (length: number) => ({ massKg: Math.round(length * 2.4 * 10) / 10 });
    for (const side of [1, -1]) {
      box('chassis', 'Ladefläche', name, [L, h, edge], [0, y, side * (W / 2 - edge / 2)], angle(L));
      box('chassis', 'Ladefläche', name, [edge, h, deckW], [side * (L / 2 - edge / 2), y, 0], angle(deckW));
    }
  }

  // ── Rahmen ───────────────────────────────────────────────────────────────
  const yBottom = H - frameH;
  const webH = frameH - deckT;
  const webY = yBottom + webH / 2;
  const pocket = 0.07;
  const pockets = Math.max(2, Math.round(L / 1.1));
  const pocketCenter = (i: number) => -L / 2 + ((i + 0.5) * L) / pockets;

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

  // ── Bordwände ────────────────────────────────────────────────────────────
  const wallH = config.wallType === 'none' ? 0 : config.wallHeightMm * MM;
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
        box('chassis', 'Bordwände', panelName, thin, pos, {
          look: 'mesh',
          ...bought(Math.round(length * wallH * 9 * 10) / 10, 'Stahl, Drahtgitter 50 × 50'),
        });
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
      box('chassis', 'Bordwände', corner ? 'Eckrunge' : 'Mittelrunge', [post, wallH + 0.02 + stake, post], [x, H + (wallH + 0.02 - stake) / 2, z], { wall: 0.004 });
      if (stake && Math.abs(Math.abs(z) - (W / 2 - post / 2)) < 1e-6) {
        // Steckrungen sitzen in Taschen am Außenträger.
        box('chassis', 'Bordwände', 'Rungentasche', [post + 0.02, 0.14, pocket - 0.008], [x, H - deckT - 0.07, Math.sign(z) * (W / 2 - pocket / 2)], { wall: 0.005 });
      }
    };
    for (let i = 0; i <= segX; i++) {
      for (const side of [1, -1]) addPost(postX(i), side * (W / 2 - post / 2), i === 0 || i === segX);
    }
    for (let j = 1; j < segZ; j++) {
      for (const end of [1, -1]) addPost(end * (L / 2 - post / 2), postZ(j), false);
    }
    for (let i = 0; i < segX; i++) {
      for (const side of [1, -1]) panel(spanX - post, [(postX(i) + postX(i + 1)) / 2, yWall, side * (W / 2 - post / 2)], true);
    }
    for (let j = 0; j < segZ; j++) {
      for (const end of [1, -1]) panel(spanZ - post, [end * (L / 2 - post / 2), yWall, (postZ(j) + postZ(j + 1)) / 2], false);
    }
  }

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

  const brakeName = { none: '', overrun: 'Trommelbremse', air: 'Trommelbremse', hydraulic: 'Trommelbremse', electric: 'Elektromagnetbremse' }[config.brake] || 'Trommelbremse';
  const brakeUnit = (frame: string, x: number, z: number, inward: number) => {
    rod(frame, 'Bremse', brakeName, R * 0.42, 0.05, 'z', [x, R, z], bought(Math.round(12 * (D / 0.5) ** 2), 'Grauguss / Stahl'));
    if (config.brake === 'air') {
      rod(frame, 'Bremse', 'Membranbremszylinder', 0.07, 0.13, 'x', [x - R * 0.42 - 0.02, R + 0.02, z + inward * 0.06], bought(4.5, 'Stahl / Gummi'));
    } else if (config.brake === 'hydraulic') {
      rod(frame, 'Bremse', 'Radbremszylinder', 0.03, 0.1, 'x', [x - R * 0.42 - 0.02, R + 0.02, z + inward * 0.04], bought(1.2, 'Grauguss'));
    }
  };

  /**
   * Eine Achslinie. mountY ist die Unterkante des Trägers, an dem sie hängt;
   * eine Federung sitzt zwischen Träger und Achshalter.
   */
  const axleLine = (frame: string, x: number, mountY: number, braked: boolean) => {
    const top = mountY - springH;
    const hangerH = top - (R - 0.06);
    const hangerY = top - hangerH / 2;
    const spring = (z: number) => {
      if (config.suspension === 'rubber') {
        box(frame, 'Fahrwerk', 'Gummifederelement', [0.2, springH, 0.12], [x, mountY - springH / 2, z], { look: 'rubber', ...bought(4, 'Gummi-Metall') });
      } else if (config.suspension === 'leaf') {
        const length = Math.min(0.8, d.axleSpacingMm * MM - 0.04);
        box(frame, 'Fahrwerk', 'Blattfederpaket', [length, 0.05, 0.07], [x, mountY - springH + 0.025, z], { look: 'steel', ...bought(Math.round(length * 28), 'Federstahl') });
        for (const end of [1, -1]) {
          box(frame, 'Fahrwerk', 'Federbock', [0.06, springH - 0.03, 0.09], [x + end * (length / 2 - 0.03), mountY - (springH - 0.03) / 2, z]);
        }
      } else if (config.suspension === 'air') {
        rod(frame, 'Fahrwerk', 'Luftfederbalg', 0.1, springH, 'y', [x, mountY - springH / 2, z], { look: 'rubber', ...bought(6, 'Gummi / Stahl') });
      }
    };

    if (d.axleType === 'pendel') {
      for (const side of [1, -1]) {
        // Pendelachse: zwei Räder, mittig am Träger pendelnd gelagert.
        const zc = side * (W / 2 - 0.03 - wheelW - 0.05);
        wheel(frame, x, zc + (wheelW / 2 + 0.05));
        wheel(frame, x, zc - (wheelW / 2 + 0.05));
        rod(frame, 'Fahrwerk', 'Pendelachse Achskörper', axleR, 2 * wheelW + 0.12, 'z', [x, R, zc]);
        box(frame, 'Fahrwerk', 'Pendelbock', [0.17, hangerH, 0.08], [x, hangerY, zc], { wall: 0.01 });
        box(frame, 'Fahrwerk', 'Anschraubplatte', [0.3, 0.02, 0.22], [x, mountY - 0.01, zc]);
        rod(frame, 'Fahrwerk', 'Pendelbolzen', 0.028, 0.24, 'x', [x, top - 0.07, zc]);
        spring(zc);
        if (braked) brakeUnit(frame, x, zc - side * (wheelW + 0.08), -side);
      }
    } else {
      const zWheel = W / 2 - 0.03 - wheelW / 2;
      wheel(frame, x, zWheel);
      wheel(frame, x, -zWheel);
      rod(frame, 'Fahrwerk', 'Starrachse Achskörper', axleR, 2 * zWheel + wheelW * 0.2, 'z', [x, R, 0]);
      for (const side of [1, -1]) {
        const zHanger = side * (zWheel - wheelW / 2 - 0.14);
        box(frame, 'Fahrwerk', 'Achshalter', [0.15, hangerH, 0.07], [x, hangerY, zHanger], { wall: 0.008 });
        spring(zHanger);
        if (braked) brakeUnit(frame, x, side * (zWheel - wheelW / 2 - 0.03), -side);
      }
    }
  };

  // Die Auflaufbremse wirkt über die Deichsel auf die Vorderachsen, alle anderen auf die Hinterachsen.
  const frontBraked = config.brake === 'overrun';
  const rearBraked = config.parkingBrake || (config.brake !== 'none' && config.brake !== 'overrun');

  // Hinterachsen hängen an Querträgern direkt unter dem Rahmen.
  for (const xMm of layout.rearAxlesMm) {
    box('chassis', 'Rahmen', 'Achsquerträger', [0.2, 0.08, crossW], [xMm * MM, yBottom + 0.04, 0], { wall: 0.01 });
    axleLine('chassis', xMm * MM, yBottom, rearBraked);
  }

  // ── Drehschemel mit Vorderachsen ─────────────────────────────────────────
  const frontX = layout.frontCenterMm * MM;
  const rearX = layout.rearCenterMm * MM;
  const steer = (-config.steeringDeg * Math.PI) / 180;
  // Rechts ist +z; ein Einschlag nach rechts dreht den Drehschemel daher um -y.
  frames.bogieFront = { parent: 'chassis', origin: [frontX, 0, 0], axis: 'y', angle: steer };

  const subH = 0.08;
  const subY = yBottom - 0.05 - subH / 2;
  const subLen = (d.frontAxles - 1) * d.axleSpacingMm * MM + 0.5;
  const subW = W - 0.3;
  const ringR = Math.min(W / 2 - 0.12, 0.6);
  rod('bogieFront', 'Drehschemel', `Kugeldrehkranz Ø ${Math.round(ringR * 2000)}`, ringR, 0.05, 'y', [0, yBottom - 0.025, 0], {
    innerRadius: ringR - 0.09,
  });
  box('bogieFront', 'Drehschemel', 'Drehschemelrahmen', [subLen, subH, subW], [0, subY, 0], { wall: 0.012 });
  for (const xMm of layout.frontAxlesMm) {
    axleLine('bogieFront', xMm * MM - frontX, subY - subH / 2, frontBraked);
  }

  // Die Aufnahme reicht bis vor die Ladefläche, damit die Deichsel frei hochklappen kann.
  const hingeX = L / 2 + 0.12 - frontX;
  const tongueW = Math.min(0.7, subW);
  box('bogieFront', 'Drehschemel', 'Deichselaufnahme', [hingeX - subLen / 2 + 0.02, subH, tongueW], [(hingeX + subLen / 2) / 2, subY, 0], { wall: 0.01 });

  // ── Deichsel ─────────────────────────────────────────────────────────────
  const drawbarLength = Math.min(1.1 + 0.012 * config.payloadT, 1.7);
  const tip = drawbarLength + 0.13;
  // Abgesenkt zeigt die Deichsel auf die Kupplungshöhe des Zugfahrzeugs, sofern angegeben.
  const rest =
    config.couplingHeightMm === null
      ? 0
      : Math.asin(Math.max(-0.45, Math.min(0.45, (config.couplingHeightMm * MM - subY) / tip)));
  frames.drawbar = { parent: 'bogieFront', origin: [hingeX, subY, 0], axis: 'z', angle: config.drawbarUp ? DRAWBAR_UP : rest };

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
  if (config.towEye === 'din') {
    parts.push({ kind: 'ring', frame: 'drawbar', group: 'Deichsel', name: 'DIN-Zugöse', look: 'paint', ...STEEL, radius: 0.058, tube: 0.021, axis: 'y', pos: [drawbarLength + 0.07, 0, 0] });
  } else {
    rod('drawbar', 'Deichsel', 'Flachstahl-Zugöse', 0.075, 0.03, 'y', [drawbarLength + 0.075, 0, 0], { innerRadius: 0.028, look: 'paint' });
  }
  if (config.drawbarSpring) {
    rod('drawbar', 'Deichsel', 'Deichselfeder mit Höheneinstellung', 0.035, 0.36, 'x', [0.26, 0.095, 0], bought(6.5, 'Federstahl'));
    for (const x of [0.07, 0.45]) box('drawbar', 'Deichsel', 'Federlager', [0.03, 0.09, 0.06], [x, 0.06, 0], DETAIL);
  }

  // ── Bremsanlage ──────────────────────────────────────────────────────────
  const frontEnd = L / 2 + 0.012;
  const connectorY = yBottom + Math.min(webH * 0.5, 0.1);
  if (config.brake === 'overrun') {
    box('drawbar', 'Bremse', 'Auflaufeinrichtung', [0.3, 0.09, 0.14], [drawbarLength - 0.08, 0.08, 0], { look: 'steel', ...bought(18, 'Stahlguss') });
    rod('drawbar', 'Bremse', 'Bremsgestänge', 0.008, drawbarLength - 0.3, 'x', [(drawbarLength - 0.3) / 2, -0.05, 0], { look: 'galvanized' });
  } else if (config.brake === 'air') {
    rod('chassis', 'Bremse', 'Druckluftbehälter', 0.13, Math.min(0.7, crossW - 0.2), 'z', [(frontX + rearX) / 2, yBottom - 0.14, 0], { look: 'steel', ...bought(14, 'Stahl') });
    box('chassis', 'Bremse', 'Kupplungskopf Vorrat', [0.04, 0.06, 0.06], [frontEnd + 0.014, connectorY, 0.32], { look: 'lampRed', ...bought(0.5, 'Aluminium') });
    box('chassis', 'Bremse', 'Kupplungskopf Bremse', [0.04, 0.06, 0.06], [frontEnd + 0.014, connectorY, 0.2], { look: 'yellow', ...bought(0.5, 'Aluminium') });
  } else if (config.brake === 'hydraulic') {
    rod('chassis', 'Bremse', 'Hydraulikanschluss', 0.018, 0.06, 'x', [frontEnd + 0.03, connectorY, 0.26], { look: 'galvanized', ...bought(0.4, 'Stahl verzinkt') });
  } else if (config.brake === 'electric') {
    box('chassis', 'Bremse', 'Anschlussdose Bremse', [0.05, 0.09, 0.09], [frontEnd + 0.02, connectorY, 0.26], { look: 'steel', ...bought(0.6, 'Kunststoff') });
  }
  if (config.parkingBrake) {
    const x = Math.min(L / 2 - 0.5, rearX + 1.2);
    box('chassis', 'Bremse', 'Feststellbremse mit Spindel', [0.09, Math.min(0.16, webH - 0.03), 0.05], [x, webY, W / 2 - pocket / 2 - 0.004], { look: 'steel', ...bought(7, 'Stahl') });
    rod('chassis', 'Bremse', 'Handkurbel', 0.012, 0.16, 'z', [x, webY, W / 2 + 0.05], { look: 'galvanized', ...DETAIL });
  }

  // ── Ausstattung ──────────────────────────────────────────────────────────
  const rearEnd = -L / 2 - 0.012;
  if (config.rearCoupling === 'pin') {
    const y = yBottom + 0.05;
    box('chassis', 'Ausstattung', 'Steckbolzenkupplung', [0.16, 0.025, 0.12], [rearEnd - 0.07, y + 0.045, 0], { look: 'steel', ...bought(9, 'Stahl') });
    box('chassis', 'Ausstattung', 'Kupplungsmaul', [0.16, 0.025, 0.12], [rearEnd - 0.07, y - 0.045, 0], { look: 'steel', ...DETAIL });
    rod('chassis', 'Ausstattung', 'Steckbolzen', 0.016, 0.17, 'y', [rearEnd - 0.1, y + 0.01, 0], { look: 'galvanized', ...DETAIL });
  } else if (config.rearCoupling === 'automatic') {
    const y = yBottom + 0.07;
    box('chassis', 'Ausstattung', 'Automatische Anhängerkupplung', [0.2, 0.2, 0.18], [rearEnd - 0.1, y, 0], { look: 'steel', ...bought(28, 'Stahlguss') });
    box('chassis', 'Ausstattung', 'Fangmaul', [0.07, 0.16, 0.34], [rearEnd - 0.235, y, 0], { look: 'steel', ...DETAIL });
    rod('chassis', 'Ausstattung', 'Handhebel', 0.012, 0.18, 'z', [rearEnd - 0.1, y + 0.11, 0.1], { look: 'galvanized', ...DETAIL });
  }

  if (config.lashingRings) {
    for (let i = 0; i < pockets; i++) {
      for (const side of [1, -1]) {
        const x = pocketCenter(i) + (L / pockets) * 0.27;
        const z = side * (W / 2 - pocket + 0.006);
        parts.push({ kind: 'ring', frame: 'chassis', group: 'Ausstattung', name: 'Zurröse', look: 'galvanized', ...bought(0.9, 'Stahl verzinkt'), radius: 0.032, tube: 0.007, axis: 'z', pos: [x, webY - 0.02, z + side * 0.009] });
        box('chassis', 'Ausstattung', 'Zurrösenbock', [0.05, 0.03, 0.02], [x, webY + 0.02, z + side * 0.01], { look: 'galvanized', ...DETAIL });
      }
    }
  }

  const lampH = Math.min(0.1, webH * 0.7);
  if (config.lighting === 'internal') {
    for (const side of [1, -1]) {
      box('chassis', 'Ausstattung', 'Rückleuchte', [0.025, lampH, 0.14], [rearEnd - 0.012, webY, side * (W / 2 - 0.3)], { look: 'lampRed', ...bought(0.4, 'Kunststoff') });
    }
  } else if (config.lighting === 'stvzo') {
    for (const side of [1, -1]) {
      box('chassis', 'Ausstattung', 'Mehrkammer-Rückleuchte', [0.03, lampH, 0.24], [rearEnd - 0.015, webY, side * (W / 2 - 0.36)], { look: 'lampRed', ...bought(0.9, 'Kunststoff') });
      box('chassis', 'Ausstattung', 'Blinkerkammer', [0.03, lampH, 0.1], [rearEnd - 0.015, webY, side * (W / 2 - 0.18)], { look: 'lampAmber', ...DETAIL });
      box('chassis', 'Ausstattung', 'Begrenzungsleuchte vorn', [0.02, 0.05, 0.08], [frontEnd + 0.01, webY, side * (W / 2 - 0.12)], { look: 'lampWhite', ...bought(0.2, 'Kunststoff') });
      const markers = Math.max(2, Math.ceil(L / 3));
      for (let i = 0; i < markers; i++) {
        box('chassis', 'Ausstattung', 'Seitenmarkierungsleuchte', [0.1, 0.035, 0.02], [-L / 2 + ((i + 0.5) * L) / markers + 0.12, yBottom + 0.04, side * (W / 2 - 0.012)], { look: 'lampAmber', ...bought(0.15, 'Kunststoff') });
      }
    }
    box('chassis', 'Ausstattung', 'Kennzeichenhalter', [0.006, 0.12, 0.53], [rearEnd - 0.004, webY, 0], { look: 'lampWhite', ...bought(0.5, 'Kunststoff') });
  }

  if (config.chocks !== 'none') {
    const double = config.chocks === 'double';
    for (const side of [1, -1]) {
      const x = rearX + (d.rearAxles - 1) * d.axleSpacingMm * MM * 0.5 + R + 0.45;
      box('chassis', 'Ausstattung', `Unterlegkeil ${double ? 'doppelt' : 'einfach'} wirkend`, [double ? 0.42 : 0.32, 0.15, 0.16], [x, yBottom - 0.085, side * (W / 2 - 0.2)], { look: 'yellow', ...bought(double ? 4.8 : 3.4, 'Kunststoff') });
      box('chassis', 'Ausstattung', 'Keilhalter', [double ? 0.46 : 0.36, 0.01, 0.18], [x, yBottom - 0.005, side * (W / 2 - 0.2)], { look: 'galvanized', ...bought(1.2, 'Stahl verzinkt') });
    }
  }

  return {
    parts,
    frames,
    reach: 0.12 + tip + 0.06,
    height: H + (wallH ? wallH + 0.02 : 0),
    label: {
      x: pocketCenter(Math.floor(pockets / 2)),
      y: webY,
      z: W / 2 - pocket + 0.008,
      height: Math.min(webH * 0.5, 0.13),
    },
    loadSurfaceY: H,
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
