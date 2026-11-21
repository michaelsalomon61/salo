import * as THREE from 'three';

export interface Yard {
  group: THREE.Group;
  dispose: () => void;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Betonplatten mit Fugen, Flecken und feinen Rissen; eine Kachel entspricht 8 m × 8 m. */
function concreteTexture(): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const rnd = seeded(11);

  g.fillStyle = '#b4b1ab';
  g.fillRect(0, 0, size, size);

  // Wolkige Flecken, über die Kachelränder hinweg wiederholt.
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const radius = 40 + rnd() * 170;
    const dark = rnd() < 0.55;
    const alpha = 0.03 + rnd() * 0.06;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, radius);
        grad.addColorStop(0, dark ? `rgba(70, 66, 60, ${alpha})` : `rgba(235, 232, 225, ${alpha})`);
        grad.addColorStop(1, 'rgba(128, 128, 128, 0)');
        g.fillStyle = grad;
        g.fillRect(x + ox - radius, y + oy - radius, radius * 2, radius * 2);
      }
    }
  }

  // Körnung.
  const image = g.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (rnd() - 0.5) * 22;
    image.data[i] += n;
    image.data[i + 1] += n;
    image.data[i + 2] += n;
  }
  g.putImageData(image, 0, 0);

  // Plattenfugen alle 4 m.
  for (const p of [0, size / 2]) {
    g.fillStyle = 'rgba(52, 50, 46, 0.8)';
    g.fillRect(p - 2, 0, 4, size);
    g.fillRect(0, p - 2, size, 4);
    g.fillStyle = 'rgba(225, 222, 215, 0.25)';
    g.fillRect(p + 2, 0, 3, size);
    g.fillRect(0, p + 2, size, 3);
  }

  // Feine Risse.
  g.strokeStyle = 'rgba(55, 52, 48, 0.45)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    let x = rnd() * size;
    let y = rnd() * size;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 9; k++) {
      x += (rnd() - 0.5) * 70;
      y += (rnd() - 0.2) * 55;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Senkrechte Sicken eines Trapezblechs, eine Kachel entspricht 0,3 m. */
function claddingTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, '#c9ccd0');
  grad.addColorStop(0.42, '#d6d9dc');
  grad.addColorStop(0.5, '#8f9397');
  grad.addColorStop(0.62, '#b9bcc0');
  grad.addColorStop(1, '#c9ccd0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Werkshof als Umgebung für das Rendering: Betonfläche bis zum Horizont,
 * eine Halle im Hintergrund und eine Fahrbahnmarkierung.
 */
export function buildYard(): Yard {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };
  const group = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(track(geometry), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  const concrete = track(concreteTexture());
  concrete.repeat.set(1200 / 8, 1200 / 8);
  const groundMaterial = track(new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.93 }));
  add(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2), groundMaterial, 0, 0, 0);

  // Markierung parallel zum Fahrzeug, leicht abgefahren.
  const marking = track(new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.85 }));
  add(new THREE.BoxGeometry(160, 0.003, 0.15), marking, 0, 0.0015, -6.5);

  // Halle im Hintergrund.
  const hallLength = 150;
  const hallHeight = 9;
  const hallZ = -105;
  const cladding = track(claddingTexture());
  cladding.repeat.set(hallLength / 0.3, 1);
  const wall = track(new THREE.MeshStandardMaterial({ map: cladding, roughness: 0.55, metalness: 0.35 }));
  const plinth = track(new THREE.MeshStandardMaterial({ color: 0x8d8b86, roughness: 0.95 }));
  const trim = track(new THREE.MeshStandardMaterial({ color: 0x4d5258, roughness: 0.6, metalness: 0.3 }));
  const door = track(new THREE.MeshStandardMaterial({ color: 0x5c6670, roughness: 0.5, metalness: 0.4 }));
  add(new THREE.BoxGeometry(hallLength, hallHeight, 34), wall, -18, hallHeight / 2 + 0.6, hallZ);
  add(new THREE.BoxGeometry(hallLength + 0.3, 0.6, 34.3), plinth, -18, 0.3, hallZ);
  add(new THREE.BoxGeometry(hallLength + 0.6, 0.5, 34.6), trim, -18, hallHeight + 0.85, hallZ);
  for (const x of [-70, -38, -6, 26]) {
    add(new THREE.BoxGeometry(7, 5.6, 0.2), door, x, 2.8, hallZ + 17.05);
  }

  return { group, dispose: () => disposables.forEach((item) => item.dispose()) };
}
