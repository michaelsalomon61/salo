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

/** Maserung für Holzbohlen: fünf Streifen, je einer pro Bohle, 1 m lang. */
export function woodTexture(kind: 'hardwood' | 'pine'): THREE.CanvasTexture {
  const pine = kind === 'pine';
  const size = 512;
  const { c, g } = canvas(size, size);
  const rnd = seeded(7);
  const planks = 5;
  const ph = size / planks;
  for (let i = 0; i < planks; i++) {
    g.fillStyle = pine
      ? `hsl(${36 + rnd() * 6}, ${46 + rnd() * 8}%, ${64 + rnd() * 7}%)`
      : `hsl(${26 + rnd() * 6}, ${34 + rnd() * 8}%, ${40 + rnd() * 9}%)`;
    g.fillRect(0, i * ph, size, ph);
    for (let k = 0; k < 34; k++) {
      g.fillStyle = pine ? `rgba(120, 78, 30, ${0.05 + rnd() * 0.12})` : `rgba(52, 30, 12, ${0.05 + rnd() * 0.13})`;
      g.fillRect(0, i * ph + rnd() * ph, size, 1 + rnd() * 1.5);
    }
  }
  return tiling(c, true);
}

/** Wandelt eine Höhenkarte (Helligkeit = Höhe) in eine kachelbare Normalenkarte um. */
function normalMapFrom(height: HTMLCanvasElement, strength: number): THREE.CanvasTexture {
  const { width: w, height: h } = height;
  const src = height.getContext('2d')!.getImageData(0, 0, w, h).data;
  const { c, g } = canvas(w, h);
  const out = g.createImageData(w, h);
  const at = (x: number, y: number) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = -(at(x + 1, y) - at(x - 1, y)) * strength;
      // Die Bildzeilen laufen nach unten, die Texturkoordinate v nach oben.
      const ny = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * w + x) * 4;
      out.data[i] = (nx / len) * 127.5 + 127.5;
      out.data[i + 1] = (ny / len) * 127.5 + 127.5;
      out.data[i + 2] = (1 / len) * 127.5 + 127.5;
      out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  return tiling(c, false);
}

/** Normalenkarte für Riffelblech: gegeneinander versetzte Tränen. */
export function checkerNormalTexture(): THREE.CanvasTexture {
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
  g.filter = 'blur(1.5px)';
  g.drawImage(c, 0, 0);
  return normalMapFrom(c, 3);
}

/** Normalenkarte für eine fein gerippte Gummiauflage. */
export function rubberNormalTexture(): THREE.CanvasTexture {
  const size = 64;
  const { c, g } = canvas(size, size);
  g.fillStyle = '#505050';
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#b0b0b0';
  g.fillRect(0, size / 4, size, size / 2);
  g.filter = 'blur(3px)';
  g.drawImage(c, 0, 0);
  return normalMapFrom(c, 1.5);
}

/** Drahtgitter mit durchsichtigen Maschen; eine Kachel entspricht einer Masche von 50 mm. */
export function meshTexture(): THREE.CanvasTexture {
  const size = 64;
  const { c, g } = canvas(size, size);
  g.clearRect(0, 0, size, size);
  g.fillStyle = '#9a9ea4';
  g.fillRect(0, 0, size, 7);
  g.fillRect(0, 0, 7, size);
  return tiling(c, true);
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
