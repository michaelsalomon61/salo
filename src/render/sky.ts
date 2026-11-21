import * as THREE from 'three';

/** Kleines, reproduzierbares Werterauschen für die Wolken. */
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) {
  let sum = 0;
  let amp = 0.5;
  for (let i = 0; i < 5; i++) {
    sum += amp * noise(x, y);
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Winkelradius der Sonnenscheibe; größer als in der Natur, damit Schatten weich auslaufen. */
const SUN_RADIUS = THREE.MathUtils.degToRad(1.3);
/** Bestrahlungsstärke der Sonne im Verhältnis zum Himmel (Himmel ≈ 2). */
export const SUN_IRRADIANCE = 6.5;

/**
 * Tageshimmel als HDR-Rundumbild: Verlauf vom Zenit zum Dunst am Horizont,
 * leichte Bewölkung und optional die Sonnenscheibe. Der Path Tracer beleuchtet
 * die Szene allein mit diesem Bild.
 */
export function makeSkyTexture(sunDirection: THREE.Vector3, withSun: boolean): THREE.DataTexture {
  const width = 2048;
  const height = 1024;
  const data = new Uint16Array(width * height * 4);
  const sun = sunDirection.clone().normalize();
  const sunRadiance = SUN_IRRADIANCE / (2 * Math.PI * (1 - Math.cos(SUN_RADIUS)));
  const one = THREE.DataUtils.toHalfFloat(1);

  for (let y = 0; y < height; y++) {
    const lat = ((y + 0.5) / height - 0.5) * Math.PI;
    const dy = Math.sin(lat);
    const cosLat = Math.cos(lat);
    for (let x = 0; x < width; x++) {
      const lon = ((x + 0.5) / width - 0.5) * 2 * Math.PI;
      const dx = cosLat * Math.cos(lon);
      const dz = cosLat * Math.sin(lon);

      let r: number;
      let g: number;
      let b: number;
      if (dy >= 0) {
        const haze = Math.pow(1 - dy, 4);
        r = 0.17 + (1.02 - 0.17) * haze;
        g = 0.36 + (1.1 - 0.36) * haze;
        b = 0.82 + (1.22 - 0.82) * haze;

        const cloud = smoothstep(0.5, 0.74, fbm((dx / (dy + 0.14)) * 0.9 + 3.1, (dz / (dy + 0.14)) * 0.9 + 1.7)) * smoothstep(0.02, 0.2, dy) * 0.8;
        r += (1.35 - r) * cloud;
        g += (1.36 - g) * cloud;
        b += (1.42 - b) * cloud;

        const cosSun = Math.max(0, dx * sun.x + dy * sun.y + dz * sun.z);
        const glow = 0.5 * Math.pow(cosSun, 48) + 1.5 * Math.pow(cosSun, 600);
        r += glow;
        g += glow * 0.93;
        b += glow * 0.8;
        if (withSun) {
          const disc = 1 - smoothstep(SUN_RADIUS * 0.85, SUN_RADIUS * 1.15, Math.acos(Math.min(1, cosSun)));
          r += sunRadiance * disc;
          g += sunRadiance * 0.95 * disc;
          b += sunRadiance * 0.86 * disc;
        }
      } else {
        // Unter dem Horizont: der Ton einer sonnenbeschienenen Betonfläche.
        const fade = smoothstep(0, -0.08, dy);
        r = 1.02 + (0.62 - 1.02) * fade;
        g = 1.1 + (0.6 - 1.1) * fade;
        b = 1.22 + (0.56 - 1.22) * fade;
      }

      const i = (y * width + x) * 4;
      data[i] = THREE.DataUtils.toHalfFloat(Math.min(r, 60000));
      data[i + 1] = THREE.DataUtils.toHalfFloat(Math.min(g, 60000));
      data[i + 2] = THREE.DataUtils.toHalfFloat(Math.min(b, 60000));
      data[i + 3] = one;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
    THREE.EquirectangularReflectionMapping,
    THREE.RepeatWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.LinearFilter,
    THREE.LinearFilter,
  );
  texture.needsUpdate = true;
  return texture;
}
