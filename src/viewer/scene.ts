import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { buildTrailer, type TrailerBuild } from '../trailer/buildTrailer';
import type { Derived, TrailerConfig } from '../trailer/config';

const MM = 0.001;
const VIEW_DIRECTION = new THREE.Vector3(0.85, 0.3, 0.9).normalize();
const DRAWBAR_UP = 1.36;
const mmFormat = new Intl.NumberFormat('de-DE');

/** Die 3D-Bühne: Renderer, Kamera, Licht, Anhänger und Maßlinien. */
export class TrailerScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labels = new CSS2DRenderer();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
  private readonly controls: OrbitControls;
  private readonly sun = new THREE.DirectionalLight(0xffffff, 1.7);
  private readonly dims = new THREE.Group();
  private readonly dimMaterial = new THREE.LineBasicMaterial({ color: 0x8e8e93 });
  private readonly environment: THREE.Texture;
  private readonly ground: THREE.Mesh;
  private readonly resizeObserver: ResizeObserver;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private trailer: TrailerBuild | null = null;
  private sizeKey = '';
  private radius = 4;
  private fitDistance = 12;
  private drawbarAngle = 0;
  private drawbarTarget = 0;
  private frame = 0;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    this.labels.domElement.className = 'stage-labels';
    host.appendChild(this.labels.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.6;

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
      new THREE.ShadowMaterial({ opacity: 0.16 }),
    );
    this.ground.receiveShadow = true;
    this.scene.add(this.ground, this.dims);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.3;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();

    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  update(config: TrailerConfig, derived: Derived) {
    if (this.trailer) {
      this.scene.remove(this.trailer.group);
      this.trailer.dispose();
    }
    this.trailer = buildTrailer(config, derived);
    this.scene.add(this.trailer.group);

    this.drawbarTarget = config.drawbarUp ? DRAWBAR_UP : 0;
    if (this.reducedMotion) this.drawbarAngle = this.drawbarTarget;
    this.trailer.drawbar.rotation.z = this.drawbarAngle;

    const L = config.lengthMm * MM;
    const W = config.widthMm * MM;
    const H = config.deckHeightMm * MM;
    const key = `${config.lengthMm}/${config.widthMm}/${config.deckHeightMm}`;
    if (key === this.sizeKey) return;
    const first = this.sizeKey === '';
    this.sizeKey = key;
    this.buildDimensions(L, W, H, config);

    // Bildausschnitt mit der Größe mitführen, den Blickwinkel des Nutzers aber behalten.
    const reach = this.trailer.drawbarLength + 0.3;
    const previousFit = this.fitDistance;
    this.radius = 0.5 * Math.hypot(L + reach, W + 0.6, H + 0.6);
    this.controls.target.set(reach * 0.4, H * 0.45, 0);
    this.updateFitDistance();
    if (first) {
      this.resetView();
    } else {
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.setLength(offset.length() * (this.fitDistance / previousFit));
      this.camera.position.copy(this.controls.target).add(offset);
    }

    const r = this.radius;
    this.sun.target.position.copy(this.controls.target);
    this.sun.position.copy(this.controls.target).add(new THREE.Vector3(0.35 * r, 2.2 * r, 1.1 * r));
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -r * 1.4;
    cam.right = cam.top = r * 1.4;
    cam.near = 0.1;
    cam.far = r * 6;
    cam.updateProjectionMatrix();
  }

  setDimensionsVisible(visible: boolean) {
    this.dims.visible = visible;
  }

  resetView() {
    this.camera.position.copy(this.controls.target).addScaledVector(VIEW_DIRECTION, this.fitDistance);
    this.controls.update();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.trailer?.dispose();
    this.clearDimensions();
    this.dimMaterial.dispose();
    this.environment.dispose();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }

  private tick() {
    if (this.trailer && this.drawbarAngle !== this.drawbarTarget) {
      const delta = this.drawbarTarget - this.drawbarAngle;
      this.drawbarAngle = Math.abs(delta) < 0.002 ? this.drawbarTarget : this.drawbarAngle + delta * 0.14;
      this.trailer.drawbar.rotation.z = this.drawbarAngle;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  private resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height);
    this.labels.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const previousFit = this.fitDistance;
    this.updateFitDistance();
    const offset = this.camera.position.clone().sub(this.controls.target);
    if (offset.lengthSq() > 0) {
      offset.setLength(offset.length() * (this.fitDistance / previousFit));
      this.camera.position.copy(this.controls.target).add(offset);
    }
  }

  private updateFitDistance() {
    const vertical = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    // Die Hüllkugel ist großzügig; 0,9 füllt den Ausschnitt, ohne anzuschneiden.
    this.fitDistance = (0.9 * this.radius) / Math.sin(Math.min(vertical, horizontal));
    this.controls.minDistance = this.radius * 0.5;
    this.controls.maxDistance = this.fitDistance * 2.5;
  }

  private clearDimensions() {
    for (const child of [...this.dims.children]) {
      this.dims.remove(child);
      if (child instanceof THREE.LineSegments) child.geometry.dispose();
    }
  }

  private buildDimensions(L: number, W: number, H: number, config: TrailerConfig) {
    this.clearDimensions();
    const gap = 0.35;
    const tick = 0.08;
    const y = 0.01;
    const x0 = -L / 2;
    const x1 = L / 2;
    const zSide = W / 2 + gap;
    const xRear = -L / 2 - gap;
    const points: number[] = [];
    const line = (a: [number, number, number], b: [number, number, number]) => points.push(...a, ...b);

    // Länge entlang der Seite, Breite hinter dem Heck, Ladehöhe an der Ecke dazwischen.
    line([x0, y, zSide], [x1, y, zSide]);
    line([x0, y, zSide - tick], [x0, y, zSide + tick]);
    line([x1, y, zSide - tick], [x1, y, zSide + tick]);
    line([xRear, y, -W / 2], [xRear, y, W / 2]);
    line([xRear - tick, y, -W / 2], [xRear + tick, y, -W / 2]);
    line([xRear - tick, y, W / 2], [xRear + tick, y, W / 2]);
    line([xRear, 0, zSide], [xRear, H, zSide]);
    line([xRear - tick, H, zSide], [xRear + tick, H, zSide]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.dims.add(new THREE.LineSegments(geometry, this.dimMaterial));

    const label = (text: string, x: number, yy: number, z: number) => {
      const el = document.createElement('div');
      el.className = 'dim-label';
      el.textContent = text;
      const object = new CSS2DObject(el);
      object.position.set(x, yy, z);
      this.dims.add(object);
    };
    label(`${mmFormat.format(config.lengthMm)} mm`, 0, y, zSide);
    label(`${mmFormat.format(config.widthMm)} mm`, xRear, y, 0);
    label(`${mmFormat.format(config.deckHeightMm)} mm`, xRear, H + 0.22, zSide);
  }
}
