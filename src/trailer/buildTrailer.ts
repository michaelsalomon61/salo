import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLORS, type Derived, type TrailerConfig } from './config';
import { trailerParts, type BoxPart, type Frame, type Look, type Part } from './parts';
import { checkerNormalTexture, payloadLabelTexture, rubberNormalTexture, woodTexture } from './textures';

export interface TrailerBuild {
  group: THREE.Group;
  /** Drehschemel mit Vorderachsen und Deichsel, lenkbar um die y-Achse. */
  bogie: THREE.Group;
  /** Deichsel, drehbar um die lokale z-Achse (0 = waagerecht). */
  drawbar: THREE.Group;
  drawbarLength: number;
  dispose: () => void;
}

/** Kachelgröße der Belagstexturen in Metern. */
const TILE: Partial<Record<Look, number>> = { checker: 0.16, rubber: 0.04 };
const WOOD_BANDS = 5;

/**
 * Baut das 3D-Modell aus der Bauteilbeschreibung (siehe parts.ts).
 * Der Ursprung liegt auf dem Boden unter der Mitte der Ladefläche.
 */
export function buildTrailer(config: TrailerConfig, d: Derived): TrailerBuild {
  const description = trailerParts(config, d);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const colorHex = (COLORS.find((c) => c.id === config.colorId) ?? COLORS[0]).hex;
  const paint = track(
    new THREE.MeshPhysicalMaterial({ color: colorHex, roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
  );
  const steel = track(new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.5, metalness: 0.65 }));
  const tyre = track(new THREE.MeshStandardMaterial({ color: 0x47474a, roughness: 0.9 }));
  const rim = track(new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.42, metalness: 0.45 }));

  /**
   * Strukturierte Beläge. Ein Material je Bauteil, weil der Path Tracer
   * Körper mit mehreren Materialien falsch zuordnet; die schmalen Seitenflächen
   * tragen deshalb dieselbe Struktur wie die Oberseite.
   */
  const surfaces = new Map<Look, THREE.Material>();
  const surface = (look: Look) => {
    let s = surfaces.get(look);
    if (s) return s;
    if (look === 'wood') {
      s = track(new THREE.MeshStandardMaterial({ map: track(woodTexture()), roughness: 0.78 }));
    } else if (look === 'checker') {
      const normalMap = track(checkerNormalTexture());
      s = track(new THREE.MeshStandardMaterial({ color: 0xb6b9be, roughness: 0.42, metalness: 0.85, normalMap }));
    } else {
      s = track(new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 0.95, normalMap: track(rubberNormalTexture()) }));
    }
    surfaces.set(look, s);
    return s;
  };

  const group = new THREE.Group();
  const bogie = new THREE.Group();
  bogie.position.fromArray(description.bogieOrigin);
  group.add(bogie);
  const drawbar = new THREE.Group();
  drawbar.position.fromArray(description.drawbarOrigin);
  bogie.add(drawbar);
  const frames: Record<Frame, THREE.Group> = { chassis: group, bogie, drawbar };

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const plain = (look: Look) => (look === 'steel' ? steel : look === 'tyre' ? tyre : paint);

  const addBox = (p: BoxPart) => {
    const [sx, sy, sz] = p.size;
    // Leicht gebrochene Kanten fangen Glanzlichter und lassen die Bauteile weniger künstlich wirken.
    const radius = Math.min(0.004, Math.min(sx, sy, sz) * 0.3);
    const geometry = track(new RoundedBoxGeometry(sx, sy, sz, 2, radius));
    let material: THREE.Material = plain(p.look);
    if (p.look === 'wood' || p.look === 'checker' || p.look === 'rubber') {
      material = surface(p.look);
      const uv = geometry.attributes.uv;
      const tile = TILE[p.look] ?? 1;
      for (let i = 0; i < uv.count; i++) {
        // Textur in Metern statt je Bauteil gestreckt; jede Bohle erhält einen eigenen Maserungsstreifen.
        const v =
          p.look === 'wood'
            ? (((p.variant ?? 0) % WOOD_BANDS) + uv.getY(i)) / WOOD_BANDS
            : (uv.getY(i) * sz + p.pos[2]) / tile;
        uv.setXY(i, (uv.getX(i) * sx + p.pos[0]) / tile, v);
      }
    }
    const m = mesh(geometry, material);
    m.position.fromArray(p.pos);
    if (p.rotY) m.rotation.y = p.rotY;
    return m;
  };

  // Gleiche Räder teilen sich ihre Geometrie.
  const wheelGeometry = new Map<string, THREE.BufferGeometry[]>();
  const addWheel = (p: Extract<Part, { kind: 'wheel' }>) => {
    const key = `${p.radius}/${p.width}`;
    let geo = wheelGeometry.get(key);
    if (!geo) {
      const R = p.radius;
      const rimR = R * 0.6;
      geo = [
        track(tyreGeometry(R, rimR, p.width)),
        track(new THREE.CylinderGeometry(rimR + 0.002, rimR + 0.002, p.width * 0.72, 40).rotateX(Math.PI / 2)),
        track(new THREE.CylinderGeometry(R * 0.3, R * 0.3, p.width * 0.9, 32).rotateX(Math.PI / 2)),
        track(new THREE.CylinderGeometry(R * 0.15, R * 0.15, p.width * 1.02, 24).rotateX(Math.PI / 2)),
      ];
      wheelGeometry.set(key, geo);
    }
    const g = new THREE.Group();
    g.add(mesh(geo[0], tyre), mesh(geo[1], rim), mesh(geo[2], rim), mesh(geo[3], steel));
    g.position.fromArray(p.pos);
    return g;
  };

  for (const p of description.parts) {
    let object: THREE.Object3D;
    if (p.kind === 'box') {
      object = addBox(p);
    } else if (p.kind === 'wheel') {
      object = addWheel(p);
    } else if (p.kind === 'cylinder') {
      const geometry = track(new THREE.CylinderGeometry(p.radius, p.radius, p.length, 48));
      if (p.axis === 'x') geometry.rotateZ(Math.PI / 2);
      else if (p.axis === 'z') geometry.rotateX(Math.PI / 2);
      object = mesh(geometry, plain(p.look));
      object.position.fromArray(p.pos);
    } else {
      object = mesh(track(new THREE.TorusGeometry(p.radius, p.tube, 16, 40).rotateX(Math.PI / 2)), plain(p.look));
      object.position.fromArray(p.pos);
    }
    frames[p.frame].add(object);
  }

  // Traglastangabe auf beiden Außenträgern, mittig in einem Rippenfeld.
  const { label } = description;
  const labelTex = track(payloadLabelTexture(`${config.payloadT} t`, isDark(colorHex) ? '#f5f5f7' : '#1d1d1f'));
  const labelMat = track(new THREE.MeshStandardMaterial({ map: labelTex, transparent: true, roughness: 0.6 }));
  const labelGeo = track(new THREE.PlaneGeometry(label.height * (512 / 192), label.height));
  for (const side of [1, -1]) {
    const plane = new THREE.Mesh(labelGeo, labelMat);
    plane.position.set(side * label.x, label.y, side * label.z);
    if (side < 0) plane.rotation.y = Math.PI;
    group.add(plane);
  }

  return {
    group,
    bogie,
    drawbar,
    drawbarLength: description.drawbarLength,
    dispose: () => disposables.forEach((item) => item.dispose()),
  };
}

/** Vollgummireifen als Drehkörper um die z-Achse, mit leicht gebrochenen Kanten. */
function tyreGeometry(R: number, rimR: number, width: number): THREE.BufferGeometry {
  const h = width / 2;
  const bevel = Math.min(0.014, width * 0.12);
  const e = 0.0006;
  // Dicht beieinander liegende Punktpaare halten die Kanten in der Schattierung scharf.
  const profile: [number, number][] = [
    [rimR + e, -h],
    [R - bevel - e, -h],
    [R - bevel, -h + e],
    [R - e, -h + bevel],
    [R, -h + bevel + e],
    [R, h - bevel - e],
    [R - e, h - bevel],
    [R - bevel, h - e],
    [R - bevel - e, h],
    [rimR + e, h],
    [rimR, h - e],
    [rimR, -h + e],
    [rimR + e, -h],
  ];
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    56,
  ).rotateX(Math.PI / 2);
}

function isDark(hex: string): boolean {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.2;
}
