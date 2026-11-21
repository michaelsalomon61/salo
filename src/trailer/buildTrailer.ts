import * as THREE from 'three';
import { COLORS, axleLayout, type Derived, type TrailerConfig } from './config';
import { checkerBumpTexture, payloadLabelTexture, rubberBumpTexture, woodTexture } from './textures';

const MM = 0.001;

export interface TrailerBuild {
  group: THREE.Group;
  /** Deichsel, drehbar um die lokale z-Achse (0 = waagerecht). */
  drawbar: THREE.Group;
  drawbarLength: number;
  dispose: () => void;
}

/**
 * Baut den Anhänger aus der aufgelösten Konfiguration.
 * Koordinaten in Metern: x in Fahrtrichtung (Deichsel bei +x), y nach oben,
 * z quer. Der Ursprung liegt auf dem Boden unter der Mitte der Ladefläche.
 */
export function buildTrailer(config: TrailerConfig, d: Derived): TrailerBuild {
  const L = config.lengthMm * MM;
  const W = config.widthMm * MM;
  const H = config.deckHeightMm * MM;
  const frameH = d.frameHeightMm * MM;
  const D = d.wheelDiameterMm * MM;
  const R = D / 2;
  const wheelW = d.wheelWidthMm * MM;
  const layout = axleLayout(config, d);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const colorHex = (COLORS.find((c) => c.id === config.colorId) ?? COLORS[0]).hex;
  const paint = track(
    new THREE.MeshPhysicalMaterial({
      color: colorHex,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
    }),
  );
  const darkSteel = track(new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.5, metalness: 0.65 }));
  const tyreMat = track(new THREE.MeshStandardMaterial({ color: 0x47474a, roughness: 0.9 }));
  const rimMat = track(new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.42, metalness: 0.45 }));

  const group = new THREE.Group();

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) => {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (
    parent: THREE.Object3D,
    material: THREE.Material | THREE.Material[],
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = mesh(track(new THREE.BoxGeometry(sx, sy, sz)), material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  /** Zylinder mit Achse entlang 'x' oder 'z'. */
  const rod = (
    parent: THREE.Object3D,
    material: THREE.Material,
    radius: number,
    length: number,
    axis: 'x' | 'z',
    x: number,
    y: number,
    z: number,
  ) => {
    const g = track(new THREE.CylinderGeometry(radius, radius, length, 28));
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    else g.rotateX(Math.PI / 2);
    const m = mesh(g, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ── Ladefläche ───────────────────────────────────────────────────────────
  const deckT = config.deck === 'wood' ? 0.045 : 0.02;
  let deckTop: THREE.Material = paint;
  if (config.deck === 'wood') {
    const map = track(woodTexture());
    map.repeat.set(L, W);
    deckTop = track(new THREE.MeshStandardMaterial({ map, roughness: 0.78 }));
  } else if (config.deck === 'checker') {
    const bumpMap = track(checkerBumpTexture());
    bumpMap.repeat.set(L / 0.16, W / 0.16);
    deckTop = track(
      new THREE.MeshStandardMaterial({ color: 0xb6b9be, roughness: 0.42, metalness: 0.85, bumpMap, bumpScale: 2.5 }),
    );
  } else if (config.deck === 'rubber') {
    const bumpMap = track(rubberBumpTexture());
    bumpMap.repeat.set(L / 0.04, W / 0.04);
    deckTop = track(new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 0.95, bumpMap, bumpScale: 1.2 }));
  }
  // BoxGeometry: Materialreihenfolge +x, -x, +y, -y, +z, -z.
  box(group, [paint, paint, deckTop, paint, paint, paint], L, deckT, W, 0, H - deckT / 2, 0);

  // ── Rahmen ───────────────────────────────────────────────────────────────
  const yBottom = H - frameH;
  const webH = frameH - deckT;
  const webY = yBottom + webH / 2;
  const pocket = 0.07;
  const pockets = Math.max(2, Math.round(L / 1.1));

  for (const side of [1, -1]) {
    // Außenträger als nach außen offenes U-Profil mit Rippen.
    box(group, paint, L - 0.024, webH, 0.012, 0, webY, side * (W / 2 - pocket));
    box(group, paint, L, 0.014, pocket + 0.006, 0, yBottom + 0.007, side * (W / 2 - pocket / 2 - 0.003));
    for (let i = 1; i < pockets; i++) {
      box(group, paint, 0.012, webH - 0.014, pocket - 0.006, -L / 2 + (i * L) / pockets, webY + 0.007, side * (W / 2 - pocket / 2));
    }
    // Innere Längsträger.
    box(group, paint, L - 0.05, webH - 0.02, 0.09, 0, webY + 0.01, side * W * 0.2);
  }
  for (const end of [1, -1]) {
    box(group, paint, 0.012, webH, W, end * (L / 2 - 0.006), webY, 0);
  }
  const crossCount = Math.max(2, Math.round(L / 0.9));
  for (let i = 1; i < crossCount; i++) {
    box(group, paint, 0.07, webH * 0.7, W - 2 * pocket - 0.02, -L / 2 + (i * L) / crossCount, H - deckT - (webH * 0.7) / 2, 0);
  }

  // Traglastangabe auf beiden Außenträgern, mittig in einem Rippenfeld.
  const labelH = Math.min(webH * 0.5, 0.13);
  const labelTex = track(payloadLabelTexture(`${config.payloadT} t`, isDark(colorHex) ? '#f5f5f7' : '#1d1d1f'));
  const labelMat = track(new THREE.MeshStandardMaterial({ map: labelTex, transparent: true, roughness: 0.6 }));
  const labelGeo = track(new THREE.PlaneGeometry(labelH * (512 / 192), labelH));
  const labelX = -L / 2 + (Math.floor(pockets / 2) + 0.5) * (L / pockets);
  for (const side of [1, -1]) {
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.set(side * labelX, webY, side * (W / 2 - pocket + 0.008));
    if (side < 0) label.rotation.y = Math.PI;
    group.add(label);
  }

  // ── Räder ────────────────────────────────────────────────────────────────
  const rimR = R * 0.6;
  const tyreGeo = track(tyreGeometry(R, rimR, wheelW));
  const rimGeo = track(new THREE.CylinderGeometry(rimR + 0.002, rimR + 0.002, wheelW * 0.72, 40).rotateX(Math.PI / 2));
  const hubGeo = track(new THREE.CylinderGeometry(R * 0.3, R * 0.3, wheelW * 0.9, 32).rotateX(Math.PI / 2));
  const capGeo = track(new THREE.CylinderGeometry(R * 0.15, R * 0.15, wheelW * 1.02, 24).rotateX(Math.PI / 2));
  const wheel = (parent: THREE.Object3D, x: number, z: number) => {
    const g = new THREE.Group();
    g.add(mesh(tyreGeo, tyreMat), mesh(rimGeo, rimMat), mesh(hubGeo, rimMat), mesh(capGeo, darkSteel));
    g.position.set(x, R, z);
    parent.add(g);
  };

  /** Eine Achslinie; mountY ist die Unterkante des Trägers, an dem sie hängt. */
  const axleLine = (parent: THREE.Object3D, x: number, mountY: number) => {
    const hangerH = mountY - (R - 0.06);
    const hangerY = mountY - hangerH / 2;
    if (d.axleType === 'pendel') {
      for (const side of [1, -1]) {
        // Pendelachse: zwei Räder, mittig am Träger pendelnd gelagert.
        const zc = side * (W / 2 - 0.03 - wheelW - 0.05);
        wheel(parent, x, zc + (wheelW / 2 + 0.05));
        wheel(parent, x, zc - (wheelW / 2 + 0.05));
        rod(parent, darkSteel, Math.max(0.03, R * 0.16), 2 * wheelW + 0.12, 'z', x, R, zc);
        box(parent, paint, 0.17, hangerH, 0.08, x, hangerY, zc);
        box(parent, paint, 0.3, 0.02, 0.22, x, mountY - 0.01, zc);
        rod(parent, darkSteel, 0.028, 0.24, 'x', x, mountY - 0.07, zc);
      }
    } else {
      const zWheel = W / 2 - 0.03 - wheelW / 2;
      wheel(parent, x, zWheel);
      wheel(parent, x, -zWheel);
      rod(parent, darkSteel, Math.max(0.03, R * 0.16), 2 * zWheel + wheelW * 0.2, 'z', x, R, 0);
      for (const side of [1, -1]) {
        box(parent, paint, 0.15, hangerH, 0.07, x, hangerY, side * (zWheel - wheelW / 2 - 0.1));
      }
    }
  };

  // Hinterachsen hängen an Querträgern direkt unter dem Rahmen.
  for (const xMm of layout.rearAxlesMm) {
    box(group, paint, 0.2, 0.08, W - 2 * pocket - 0.02, xMm * MM, yBottom + 0.04, 0);
    axleLine(group, xMm * MM, yBottom);
  }

  // ── Drehschemel mit Vorderachsen und Deichsel ────────────────────────────
  const bogie = new THREE.Group();
  const frontX = layout.frontCenterMm * MM;
  bogie.position.set(frontX, 0, 0);
  group.add(bogie);

  const subH = 0.08;
  const subY = yBottom - 0.05 - subH / 2;
  const subLen = (d.frontAxles - 1) * d.axleSpacingMm * MM + 0.5;
  const subW = W - 0.3;
  const turntable = mesh(track(new THREE.CylinderGeometry(Math.min(W / 2 - 0.12, 0.6), Math.min(W / 2 - 0.12, 0.6), 0.05, 56)), darkSteel);
  turntable.position.set(0, yBottom - 0.025, 0);
  bogie.add(turntable);
  box(bogie, paint, subLen, subH, subW, 0, subY, 0);
  for (const xMm of layout.frontAxlesMm) {
    axleLine(bogie, xMm * MM - frontX, subY - subH / 2);
  }

  // Zunge bis vor die Ladefläche, damit die Deichsel frei hochklappen kann.
  const hingeX = L / 2 + 0.12 - frontX;
  const tongueW = Math.min(0.7, subW);
  box(bogie, paint, hingeX - subLen / 2 + 0.02, subH, tongueW, (hingeX + subLen / 2) / 2, subY, 0);

  const drawbar = new THREE.Group();
  drawbar.position.set(hingeX, subY, 0);
  bogie.add(drawbar);
  const drawbarLength = Math.min(1.1 + 0.012 * config.payloadT, 1.7);
  const z0 = tongueW / 2 - 0.05;
  const armEndX = drawbarLength * 0.8;
  const armEndZ = 0.035;
  for (const side of [1, -1]) {
    const dx = armEndX;
    const dz = side * (armEndZ - z0);
    const arm = box(drawbar, paint, Math.hypot(dx, dz), 0.07, 0.05, dx / 2, 0, side * (z0 + armEndZ) / 2);
    arm.rotation.y = Math.atan2(-dz, dx);
  }
  for (const t of [0.3, 0.6]) {
    const zAt = z0 + (armEndZ - z0) * t;
    box(drawbar, paint, 0.05, 0.05, 2 * zAt, armEndX * t, 0, 0);
  }
  box(drawbar, paint, drawbarLength - armEndX + 0.04, 0.07, 0.12, (drawbarLength + armEndX) / 2, 0, 0);
  rod(drawbar, darkSteel, 0.024, tongueW + 0.06, 'z', 0, 0, 0);
  const eye = mesh(track(new THREE.TorusGeometry(0.058, 0.021, 16, 40).rotateX(Math.PI / 2)), paint);
  eye.position.set(drawbarLength + 0.07, 0, 0);
  drawbar.add(eye);

  return {
    group,
    drawbar,
    drawbarLength: drawbarLength + 0.15,
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
