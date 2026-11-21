import * as THREE from 'three';

/** Einfacher, reproduzierbarer Zufallsgenerator, damit Texturen nicht flackern. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function canvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return { c, g: c.getContext('2d')! };
}

function tiling(c: HTMLCanvasElement, color: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Hartholzbohlen in Längsrichtung, eine Kachel entspricht 1 m × 1 m. */
export function woodTexture(): THREE.CanvasTexture {
  const size = 512;
  const { c, g } = canvas(size, size);
  const rnd = seeded(7);
  const planks = 5;
  const ph = size / planks;
  for (let i = 0; i < planks; i++) {
    g.fillStyle = `hsl(${26 + rnd() * 6}, ${34 + rnd() * 8}%, ${40 + rnd() * 9}%)`;
    g.fillRect(0, i * ph, size, ph);
    for (let k = 0; k < 34; k++) {
      g.fillStyle = `rgba(52, 30, 12, ${0.05 + rnd() * 0.13})`;
      g.fillRect(0, i * ph + rnd() * ph, size, 1 + rnd() * 1.5);
    }
    g.fillStyle = 'rgba(25, 14, 6, 0.75)';
    g.fillRect(0, i * ph, size, 3);
  }
  return tiling(c, true);
}

/** Höhenkarte für Riffelblech: gegeneinander versetzte Tränen. */
export function checkerBumpTexture(): THREE.CanvasTexture {
  const size = 256;
  const { c, g } = canvas(size, size);
  g.fillStyle = '#6a6a6a';
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#ffffff';
  const cell = size / 4;
  const tear = (x: number, y: number, angle: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.beginPath();
    g.ellipse(0, 0, cell * 0.36, cell * 0.09, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      tear((i + 0.25) * cell, (j + 0.25) * cell, Math.PI / 4);
      tear((i + 0.75) * cell, (j + 0.75) * cell, -Math.PI / 4);
    }
  }
  return tiling(c, false);
}

/** Höhenkarte für eine fein gerippte Gummiauflage. */
export function rubberBumpTexture(): THREE.CanvasTexture {
  const size = 64;
  const { c, g } = canvas(size, size);
  g.fillStyle = '#505050';
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#b0b0b0';
  g.fillRect(0, 0, size, size / 2);
  return tiling(c, false);
}

/** Traglastangabe wie am Fahrzeug aufgebracht, auf transparentem Grund. */
export function payloadLabelTexture(text: string, color: string): THREE.CanvasTexture {
  const { c, g } = canvas(512, 192);
  g.fillStyle = color;
  g.font = '700 150px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 104);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
