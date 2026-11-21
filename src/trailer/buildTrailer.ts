import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLORS, type Derived, type TrailerConfig } from './config';
import { TYRE_SHAPE, trailerParts, type BoxPart, type Look, type TrailerParts, type WheelPart } from './parts';
import { checkerNormalTexture, meshTexture, payloadLabelTexture, rubberNormalTexture, woodTexture } from './textures';

export interface Joint {
  object: THREE.Group;
  axis: 'y' | 'z';
  /** Stellung laut Konfiguration in Radiant. */
  angle: number;
}

export interface TrailerBuild {
  group: THREE.Group;
  /** Bewegliche Baugruppen (Drehschemel, Deichsel, …) nach Namen. */
  joints: Record<string, Joint>;
  description: TrailerParts;
  dispose: () => void;
}

/** Kachelgröße der gekachelten Oberflächen in Metern. */
const TILE: Partial<Record<Look, number>> = { checker: 0.16, rubber: 0.04, plywood: 0.012, mesh: 0.05 };
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
  const standard = (parameters: THREE.MeshStandardMaterialParameters) =>
    track(new THREE.MeshStandardMaterial(parameters));

  const colorHex = (COLORS.find((c) => c.id === config.colorId) ?? COLORS[0]).hex;

  // Materialien entstehen erst, wenn ein Bauteil sie braucht.
  const materials = new Map<Look, THREE.Material>();
  const material = (look: Look): THREE.Material => {
    let m = materials.get(look);
    if (m) return m;
    switch (look) {
      case 'paint':
        m = track(new THREE.MeshPhysicalMaterial({ color: colorHex, roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 }));
        break;
      case 'steel':
        m = standard({ color: 0x2b2b2e, roughness: 0.5, metalness: 0.65 });
        break;
      case 'galvanized':
        m = standard({ color: 0xb4b8be, roughness: 0.45, metalness: 0.8 });
        break;
      case 'aluminium':
        m = standard({ color: 0xd3d6da, roughness: 0.38, metalness: 0.85 });
        break;
      case 'checker':
        m = standard({ color: 0xb6b9be, roughness: 0.42, metalness: 0.85, normalMap: track(checkerNormalTexture()) });
        break;
      case 'rubber':
        m = standard({ color: 0x232325, roughness: 0.95, normalMap: track(rubberNormalTexture()) });
        break;
      case 'plywood':
        m = standard({ color: 0x3b2a21, roughness: 0.6, normalMap: track(rubberNormalTexture()) });
        break;
      case 'hardwood':
      case 'pine':
        m = standard({ map: track(woodTexture(look)), roughness: 0.78 });
        break;
      case 'mesh':
        m = standard({ map: track(meshTexture()), alphaTest: 0.5, roughness: 0.5, metalness: 0.6 });
        break;
      case 'yellow':
        m = standard({ color: 0xe9b800, roughness: 0.65 });
        break;
      case 'lampRed':
        m = standard({ color: 0xb30f14, emissive: 0x3a0406, roughness: 0.25 });
        break;
      case 'lampAmber':
        m = standard({ color: 0xe58a00, emissive: 0x3a2000, roughness: 0.25 });
        break;
      case 'lampWhite':
        m = standard({ color: 0xf1f1f2, roughness: 0.3 });
        break;
    }
    materials.set(look, m);
    return m;
  };

  const group = new THREE.Group();
  const joints: Record<string, Joint> = {};
  const frameObjects: Record<string, THREE.Group> = {};
  // Übergeordnete Bezugssysteme stehen in der Beschreibung vor ihren Kindern.
  for (const [name, frame] of Object.entries(description.frames)) {
    if (!frame.parent) {
      frameObjects[name] = group;
      continue;
    }
    const object = new THREE.Group();
    object.position.fromArray(frame.origin);
    frameObjects[frame.parent].add(object);
    frameObjects[name] = object;
    joints[name] = { object, axis: frame.axis, angle: frame.angle };
  }

  const mesh = (geometry: THREE.BufferGeometry, m: THREE.Material) => {
    const object = new THREE.Mesh(geometry, m);
    object.castShadow = true;
    object.receiveShadow = true;
    return object;
  };

  const addBox = (p: BoxPart) => {
    const [sx, sy, sz] = p.size;
    // Leicht gebrochene Kanten fangen Glanzlichter und lassen die Bauteile weniger künstlich wirken.
    const radius = Math.min(0.004, Math.min(sx, sy, sz) * 0.3);
    const geometry = track(new RoundedBoxGeometry(sx, sy, sz, 2, radius));
    const wood = p.look === 'hardwood' || p.look === 'pine';
    const tile = TILE[p.look];
    if (wood || tile) {
      // Texturen in Metern auftragen statt je Fläche zu strecken.
      const { position, normal, uv } = geometry.attributes;
      for (let i = 0; i < uv.count; i++) {
        const point = [position.getX(i), position.getY(i), position.getZ(i)];
        const n = [Math.abs(normal.getX(i)), Math.abs(normal.getY(i)), Math.abs(normal.getZ(i))];
        let [a, b] = n[0] >= n[1] && n[0] >= n[2] ? [2, 1] : n[1] >= n[2] ? [0, 2] : [0, 1];
        if (wood) {
          // Maserung entlang der längeren Kante; jede Bohle erhält einen eigenen Streifen.
          if (p.size[b] > p.size[a]) [a, b] = [b, a];
          const across = Math.min(1, Math.max(0, point[b] / p.size[b] + 0.5));
          uv.setXY(i, point[a] + p.pos[a], (((p.variant ?? 0) % WOOD_BANDS) + across) / WOOD_BANDS);
        } else {
          uv.setXY(i, (point[a] + p.pos[a]) / tile!, (point[b] + p.pos[b]) / tile!);
        }
      }
    }
    const object = mesh(geometry, material(p.look));
    object.position.fromArray(p.pos);
    if (p.rotY) object.rotation.y = p.rotY;
    return object;
  };

  // Gleiche Räder teilen sich Geometrie und Material.
  const wheelKits = new Map<string, { geometry: THREE.BufferGeometry[]; tyre: THREE.Material; rim: THREE.Material }>();
  const addWheel = (p: WheelPart) => {
    const key = `${p.radius}/${p.width}/${p.tyre}/${p.nonMarking}`;
    let kit = wheelKits.get(key);
    if (!kit) {
      const R = p.radius;
      const shape = TYRE_SHAPE[p.tyre];
      const rimR = R * shape.rim;
      const tyreColor = {
        solid: 0x47474a,
        superElastic: 0x303033,
        pneumatic: 0x1d1d1f,
        polyurethane: 0xa5622c,
      }[p.tyre];
      // Spurfreie Reifen sind hell, damit sie nicht abfärben; Polyurethan ist es von sich aus.
      const color = p.nonMarking && p.tyre !== 'polyurethane' ? 0xbdb9b0 : tyreColor;
      const steelRim = p.tyre === 'pneumatic' || p.tyre === 'polyurethane';
      kit = {
        geometry: [
          track(tyreGeometry(R, rimR, p.width, p.width * shape.shoulder)),
          track(new THREE.CylinderGeometry(rimR + 0.002, rimR + 0.002, p.width * 0.72, 40).rotateX(Math.PI / 2)),
          track(new THREE.CylinderGeometry(R * 0.3, R * 0.3, p.width * 0.9, 32).rotateX(Math.PI / 2)),
          track(new THREE.CylinderGeometry(R * 0.15, R * 0.15, p.width * 1.02, 24).rotateX(Math.PI / 2)),
        ],
        tyre: standard({ color, roughness: p.tyre === 'polyurethane' ? 0.55 : 0.9 }),
        rim: steelRim
          ? standard({ color: 0x9da1a7, roughness: 0.4, metalness: 0.7 })
          : standard({ color: 0x141416, roughness: 0.42, metalness: 0.45 }),
      };
      wheelKits.set(key, kit);
    }
    const object = new THREE.Group();
    object.add(mesh(kit.geometry[0], kit.tyre), mesh(kit.geometry[1], kit.rim), mesh(kit.geometry[2], kit.rim), mesh(kit.geometry[3], material('steel')));
    object.position.fromArray(p.pos);
    return object;
  };

  for (const p of description.parts) {
    let object: THREE.Object3D;
    if (p.kind === 'box') {
      object = addBox(p);
    } else if (p.kind === 'wheel') {
      object = addWheel(p);
    } else if (p.kind === 'cylinder') {
      const geometry = track(
        p.innerRadius
          ? ringPlateGeometry(p.radius, p.innerRadius, p.length)
          : new THREE.CylinderGeometry(p.radius, p.radius, p.length, 48),
      );
      if (p.axis === 'x') geometry.rotateZ(Math.PI / 2);
      else if (p.axis === 'z') geometry.rotateX(Math.PI / 2);
      object = mesh(geometry, material(p.look));
      object.position.fromArray(p.pos);
    } else {
      const geometry = track(new THREE.TorusGeometry(p.radius, p.tube, 16, 40));
      if (p.axis === 'y') geometry.rotateX(Math.PI / 2);
      object = mesh(geometry, material(p.look));
      object.position.fromArray(p.pos);
    }
    frameObjects[p.frame].add(object);
  }

  // Traglastangabe auf beiden Außenträgern, mittig in einem Rippenfeld.
  const { label } = description;
  const labelTex = track(payloadLabelTexture(`${config.payloadT} t`, isDark(colorHex) ? '#f5f5f7' : '#1d1d1f'));
  const labelMat = standard({ map: labelTex, transparent: true, roughness: 0.6 });
  const labelGeo = track(new THREE.PlaneGeometry(label.height * (512 / 192), label.height));
  for (const side of [1, -1]) {
    const plane = new THREE.Mesh(labelGeo, labelMat);
    plane.position.set(side * label.x, label.y, side * label.z);
    if (side < 0) plane.rotation.y = Math.PI;
    group.add(plane);
  }

  return { group, joints, description, dispose: () => disposables.forEach((item) => item.dispose()) };
}

/** Reifen als Drehkörper um die z-Achse mit gerundeten Schultern. */
function tyreGeometry(R: number, rimR: number, width: number, shoulder: number): THREE.BufferGeometry {
  const h = width / 2;
  const r = Math.min(shoulder, h - 0.002, R - rimR - 0.002);
  const e = 0.0006;
  const points: THREE.Vector2[] = [new THREE.Vector2(rimR + e, -h)];
  const arc = (centerY: number, from: number, to: number) => {
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      points.push(new THREE.Vector2(R - r + r * Math.cos(a), centerY + r * Math.sin(a)));
    }
  };
  arc(-h + r, -Math.PI / 2, 0);
  arc(h - r, 0, Math.PI / 2);
  // Dicht beieinander liegende Punktpaare halten die Innenkanten in der Schattierung scharf.
  points.push(
    new THREE.Vector2(rimR + e, h),
    new THREE.Vector2(rimR, h - e),
    new THREE.Vector2(rimR, -h + e),
    new THREE.Vector2(rimR + e, -h),
  );
  return new THREE.LatheGeometry(points, 56).rotateX(Math.PI / 2);
}

/** Flacher Ring (Scheibe mit Loch) um die y-Achse. */
function ringPlateGeometry(outer: number, inner: number, height: number): THREE.BufferGeometry {
  const h = height / 2;
  const e = Math.min(0.0006, height / 8);
  const profile: [number, number][] = [
    [inner + e, -h],
    [outer - e, -h],
    [outer, -h + e],
    [outer, h - e],
    [outer - e, h],
    [inner + e, h],
    [inner, h - e],
    [inner, -h + e],
    [inner + e, -h],
  ];
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    64,
  );
}

function isDark(hex: string): boolean {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.2;
}
