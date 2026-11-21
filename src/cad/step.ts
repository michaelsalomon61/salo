/**
 * STEP-Modell aus der Bauteilbeschreibung.
 *
 * Der CAD-Kern (replicad auf OpenCascade) wird übergeben statt importiert,
 * damit er im Browser erst bei Bedarf geladen werden kann.
 */
import type * as Replicad from 'replicad';
import { COLORS, type Derived, type TrailerConfig } from '../trailer/config';
import { TYRE_SHAPE, trailerParts, type Look, type Part, type TrailerParts, type Vec3 } from '../trailer/parts';

type Kernel = typeof Replicad;
type Solid = Replicad.Shape3D;

const LOOK_COLORS: Record<Exclude<Look, 'paint'>, string> = {
  steel: '#2b2b2e',
  galvanized: '#b4b8be',
  aluminium: '#d3d6da',
  checker: '#b6b9be',
  hardwood: '#8a5d38',
  pine: '#d9b77e',
  plywood: '#3b2a21',
  rubber: '#232325',
  mesh: '#9a9ea4',
  tarp: '#d4d6d9',
  yellow: '#e9b800',
  lampRed: '#b30f14',
  lampAmber: '#e58a00',
  lampWhite: '#f1f1f2',
};
const TYRE_COLORS = { solid: '#47474a', superElastic: '#303033', pneumatic: '#1d1d1f', polyurethane: '#a5622c' };

/** Meter in Millimeter; STEP-Dateien führen im Maschinenbau üblicherweise Millimeter. */
const mm = (v: number) => v * 1000;
const AXES: Record<'x' | 'y' | 'z', Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

function cylinder(k: Kernel, radius: number, length: number, axis: 'x' | 'y' | 'z'): Solid {
  const dir = AXES[axis];
  const start = dir.map((c) => (-c * mm(length)) / 2) as Vec3;
  return k.makeCylinder(mm(radius), mm(length), start, dir);
}

/** Baut ein Bauteil um seinen eigenen Mittelpunkt, noch ohne Lage im Fahrzeug. */
function solidFor(k: Kernel, p: Part): Solid {
  switch (p.kind) {
    case 'box': {
      const [sx, sy, sz] = p.size.map(mm);
      let solid: Solid = k.makeBox([-sx / 2, -sy / 2, -sz / 2], [sx / 2, sy / 2, sz / 2]);
      if (p.wall) {
        // Hohlprofil: innen entlang der längsten Kante durchgehend ausnehmen.
        const w = mm(p.wall);
        const longest = p.size.indexOf(Math.max(...p.size));
        const half = [sx, sy, sz].map((s, i) => (i === longest ? s / 2 + 1 : s / 2 - w));
        if (half.every((h) => h > 0)) {
          solid = solid.cut(k.makeBox(half.map((h) => -h) as Vec3, half as Vec3));
        }
      }
      if (p.rotX) solid = solid.rotate((p.rotX * 180) / Math.PI, [0, 0, 0], [1, 0, 0]);
      return p.rotY ? solid.rotate((p.rotY * 180) / Math.PI, [0, 0, 0], [0, 1, 0]) : solid;
    }
    case 'cylinder': {
      const solid = cylinder(k, p.radius, p.length, p.axis);
      return p.innerRadius ? solid.cut(cylinder(k, p.innerRadius, p.length + 0.002, p.axis)) : solid;
    }
    case 'wheel': {
      // Reifen mit beidseitig vertiefter Felge und durchgehender Nabe als ein Körper.
      const rimR = p.radius * TYRE_SHAPE[p.tyre].rim;
      const recess = p.width * 0.14;
      let solid: Solid = cylinder(k, p.radius, p.width, 'z');
      for (const side of [1, -1]) {
        const cut = cylinder(k, rimR, recess + 0.001, 'z').translate(0, 0, side * mm(p.width / 2 - recess / 2 + 0.0005));
        solid = solid.cut(cut);
      }
      return solid.fuse(cylinder(k, p.radius * 0.3, p.width * 0.9, 'z'));
    }
    case 'ring': {
      const ring = k.drawCircle(mm(p.tube)).translate(mm(p.radius), 0).sketchOnPlane('XY').revolve([0, 1, 0]) as Solid;
      return p.axis === 'z' ? ring.rotate(90, [0, 0, 0], [1, 0, 0]) : ring;
    }
  }
}

/** Lage jedes Bezugssystems im Fahrzeug bei Grundstellung aller Gelenke. */
function frameOrigins(description: TrailerParts): Record<string, Vec3> {
  const origins: Record<string, Vec3> = {};
  for (const [name, frame] of Object.entries(description.frames)) {
    const parent = frame.parent ? origins[frame.parent] : [0, 0, 0];
    origins[name] = [parent[0] + frame.origin[0], parent[1] + frame.origin[1], parent[2] + frame.origin[2]];
  }
  return origins;
}

export interface StepPart {
  shape: Solid;
  name: string;
  color: string;
}

/**
 * Alle Bauteile als Körper in Fahrzeugkoordinaten, Maße in Millimetern,
 * z nach oben. Lenkung gerade, Deichsel waagerecht.
 */
export function buildStepParts(k: Kernel, config: TrailerConfig, derived: Derived, nameOf: (name: string) => string = (name) => name): StepPart[] {
  const description = trailerParts(config, derived);
  const paint = (COLORS.find((c) => c.id === config.colorId) ?? COLORS[0]).hex;
  const origins = frameOrigins(description);

  // Gleiche Räder werden einmal gebaut und dann kopiert.
  const wheels = new Map<string, Solid>();
  const counters = new Map<string, number>();

  return description.parts.map((p) => {
    let solid: Solid;
    if (p.kind === 'wheel') {
      const key = `${p.radius}/${p.width}/${p.tyre}`;
      if (!wheels.has(key)) wheels.set(key, solidFor(k, p));
      solid = wheels.get(key)!.clone();
    } else {
      solid = solidFor(k, p);
    }
    const origin = origins[p.frame];
    const shape = solid
      .translate(mm(p.pos[0] + origin[0]), mm(p.pos[1] + origin[1]), mm(p.pos[2] + origin[2]))
      // Das Modell rechnet mit y nach oben, CAD-Systeme erwarten z nach oben.
      .rotate(90, [0, 0, 0], [1, 0, 0]);

    const index = (counters.get(p.name) ?? 0) + 1;
    counters.set(p.name, index);
    return {
      shape,
      name: `${nameOf(p.name)} ${index}`,
      color: p.kind === 'wheel' ? TYRE_COLORS[p.tyre] : p.look === 'paint' ? paint : LOOK_COLORS[p.look],
    };
  });
}

export function buildStepBlob(k: Kernel, config: TrailerConfig, derived: Derived, nameOf?: (name: string) => string): Blob {
  return k.exportSTEP(buildStepParts(k, config, derived, nameOf), { unit: 'MM', modelUnit: 'MM' });
}
