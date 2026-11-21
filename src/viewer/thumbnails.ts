import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createPartFactory } from '../trailer/buildTrailer';
import type { Part } from '../trailer/parts';

/**
 * Rendert für jedes Bauteil ein kleines Bild und liefert sie als Daten-URLs,
 * in der Reihenfolge der Bauteile. Alle Bilder entstehen nacheinander mit
 * einem einzigen Renderer, der danach wieder freigegeben wird.
 */
export function renderPartThumbnails(parts: Part[], colorHex: string, width = 192, height = 144): string[] {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.7;
  const light = new THREE.DirectionalLight(0xffffff, 1.6);
  light.position.set(1.2, 2.4, 1.8);
  scene.add(light);

  const camera = new THREE.PerspectiveCamera(24, width / height, 0.001, 200);
  const direction = new THREE.Vector3(0.9, 0.62, 1).normalize();
  const factory = createPartFactory(colorHex);
  const box = new THREE.Box3();
  const sphere = new THREE.Sphere();

  try {
    return parts.map((part) => {
      // Das Bauteil für sich, ohne seine Lage im Fahrzeug.
      const object = factory.object({ ...part, pos: [0, 0, 0] });
      scene.add(object);
      object.updateMatrixWorld(true);
      box.setFromObject(object).getBoundingSphere(sphere);

      const half = THREE.MathUtils.degToRad(camera.fov) / 2;
      const fit = Math.min(half, Math.atan(Math.tan(half) * camera.aspect));
      const distance = (sphere.radius / Math.sin(fit)) * 0.92;
      camera.position.copy(sphere.center).addScaledVector(direction, distance);
      camera.near = distance / 100;
      camera.far = distance * 10;
      camera.lookAt(sphere.center);
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(object);
      return url;
    });
  } finally {
    factory.dispose();
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
