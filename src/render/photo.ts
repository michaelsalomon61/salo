import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { buildTrailer, type TrailerBuild } from '../trailer/buildTrailer';
import type { Derived, TrailerConfig } from '../trailer/config';
import { jointAngles } from '../trailer/parts';
import type { CameraPose } from '../viewer/scene';
import { SUN_IRRADIANCE, makeSkyTexture } from './sky';
import { buildYard, type Yard } from './yard';

export type PhotoView = 'front' | 'side' | 'rear' | 'current';

export interface PhotoProgress {
  samples: number;
  target: number;
  done: boolean;
  /** false, wenn das Gerät kein Path Tracing kann und vereinfacht gerendert wurde. */
  pathTraced: boolean;
}

/** Blickrichtungen: Winkel um die Hochachse ab Fahrtrichtung und Höhenwinkel, in Grad. */
const VIEWS: Record<Exclude<PhotoView, 'current'>, { azimuth: number; elevation: number }> = {
  front: { azimuth: 46, elevation: 9 },
  side: { azimuth: 86, elevation: 6 },
  rear: { azimuth: 140, elevation: 10 },
};

/** Sonne von vorn rechts, damit Stirn- und Längsseite beide Licht bekommen. */
const SUN_DIRECTION = new THREE.Vector3(0.55, 0.72, 0.42).normalize();
const TARGET_SAMPLES = 260;
/** Leichtes Weitwinkel wie bei einer Aufnahme aus wenigen Metern Abstand. */
const FOV = 36;

/**
 * Rendert die Konfiguration in einer Außenszene. Das Bild entsteht durch Path
 * Tracing: Licht wird physikalisch verfolgt und verfeinert sich Durchgang für
 * Durchgang. Geräte ohne die nötige Grafikunterstützung erhalten ein
 * vereinfachtes Bild mit klassischem Schattenwurf.
 */
export class PhotoRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly trailer: TrailerBuild;
  private readonly yard: Yard;
  private readonly bounds = new THREE.Box3();
  private sky: THREE.DataTexture;
  private pathTracer: WebGLPathTracer | null = null;
  private shaderFailed = false;
  private frame = 0;
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    config: TrailerConfig,
    derived: Derived,
    size: { width: number; height: number },
    private readonly onProgress: (progress: PhotoProgress) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size.width, size.height, false);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.62;
    this.renderer.debug.onShaderError = () => {
      this.shaderFailed = true;
    };

    this.camera = new THREE.PerspectiveCamera(FOV, size.width / size.height, 0.1, 3000);

    this.trailer = buildTrailer(config, derived);
    const joints = jointAngles(config);
    this.trailer.drawbar.rotation.z = joints.drawbar;
    this.trailer.bogie.rotation.y = joints.steering;
    this.yard = buildYard();
    this.scene.add(this.trailer.group, this.yard.group);
    this.scene.updateMatrixWorld(true);
    this.bounds.setFromObject(this.trailer.group);

    this.sky = makeSkyTexture(SUN_DIRECTION, true);
    this.scene.background = this.sky;
    this.scene.environment = this.sky;
  }

  /** Startet das Rendering für die gewählte Ansicht neu. */
  setView(view: PhotoView, pose?: CameraPose) {
    if (this.disposed) return;
    this.placeCamera(view, pose);
    cancelAnimationFrame(this.frame);

    if (!this.pathTracer && !this.shaderFailed && this.renderer.extensions.has('EXT_color_buffer_float')) {
      try {
        const tracer = new WebGLPathTracer(this.renderer);
        tracer.bounces = 5;
        tracer.filterGlossyFactor = 0.5;
        tracer.renderDelay = 0;
        tracer.minSamples = 1;
        tracer.fadeDuration = 0;
        tracer.dynamicLowRes = true;
        tracer.lowResScale = 0.25;
        // In Kacheln rechnen, damit die Seite währenddessen bedienbar bleibt.
        tracer.tiles.set(2, 2);
        tracer.setScene(this.scene, this.camera);
        this.pathTracer = tracer;
      } catch {
        this.shaderFailed = true;
      }
    } else {
      this.pathTracer?.updateCamera();
    }

    if (!this.pathTracer) {
      this.renderSimple();
      return;
    }
    this.report(0, false);
    this.loop();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.pathTracer?.dispose();
    this.trailer.dispose();
    this.yard.dispose();
    this.sky.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private loop = () => {
    const tracer = this.pathTracer;
    if (this.disposed || !tracer) return;
    if (this.shaderFailed) {
      tracer.dispose();
      this.pathTracer = null;
      this.renderSimple();
      return;
    }
    tracer.renderSample();
    const done = tracer.samples >= TARGET_SAMPLES;
    this.report(tracer.samples, done);
    if (!done) this.frame = requestAnimationFrame(this.loop);
  };

  private report(samples: number, done: boolean) {
    this.onProgress({ samples: Math.min(samples, TARGET_SAMPLES), target: TARGET_SAMPLES, done, pathTraced: true });
  }

  /** Ersatz ohne Path Tracing: Himmel als Umgebungslicht, Sonne als gerichtetes Licht mit Schattenwurf. */
  private renderSimple() {
    if (!this.scene.getObjectByName('sun')) {
      this.sky.dispose();
      this.sky = makeSkyTexture(SUN_DIRECTION, false);
      this.scene.background = this.sky;
      this.scene.environment = this.sky;

      const size = this.bounds.getSize(new THREE.Vector3()).length();
      const center = this.bounds.getCenter(new THREE.Vector3());
      const sun = new THREE.DirectionalLight(0xfff3e0, SUN_IRRADIANCE);
      sun.name = 'sun';
      sun.position.copy(center).addScaledVector(SUN_DIRECTION, size * 2);
      sun.target.position.copy(center);
      sun.castShadow = true;
      sun.shadow.mapSize.set(4096, 4096);
      sun.shadow.bias = -0.0003;
      sun.shadow.normalBias = 0.02;
      const cam = sun.shadow.camera;
      cam.left = cam.bottom = -size;
      cam.right = cam.top = size;
      cam.near = 0.1;
      cam.far = size * 5;
      cam.updateProjectionMatrix();
      this.scene.add(sun, sun.target);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    this.renderer.render(this.scene, this.camera);
    this.onProgress({ samples: 1, target: 1, done: true, pathTraced: false });
  }

  private placeCamera(view: PhotoView, pose?: CameraPose) {
    const camera = this.camera;
    if (view === 'current' && pose) {
      camera.fov = pose.fov;
      camera.position.fromArray(pose.position);
      camera.position.y = Math.max(camera.position.y, 0.3);
      camera.lookAt(new THREE.Vector3().fromArray(pose.target));
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      return;
    }

    const { azimuth, elevation } = VIEWS[view === 'current' ? 'front' : view];
    const az = THREE.MathUtils.degToRad(azimuth);
    const el = THREE.MathUtils.degToRad(elevation);
    const direction = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    const target = this.bounds.getCenter(new THREE.Vector3());
    camera.fov = FOV;
    camera.updateProjectionMatrix();

    // Abstand so wählen, dass der Anhänger das Bild füllt: Eckpunkte projizieren und nachführen.
    const { min, max } = this.bounds;
    const corner = new THREE.Vector3();
    let distance = this.bounds.getSize(new THREE.Vector3()).length() * 2;
    for (let i = 0; i < 6; i++) {
      camera.position.copy(target).addScaledVector(direction, distance);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      let extent = 0;
      for (let k = 0; k < 8; k++) {
        corner.set(k & 1 ? max.x : min.x, k & 2 ? max.y : min.y, k & 4 ? max.z : min.z).project(camera);
        extent = Math.max(extent, Math.abs(corner.x), Math.abs(corner.y) * 1.25);
      }
      distance *= extent / 0.9;
    }
    camera.position.copy(target).addScaledVector(direction, distance);
    // Etwas über die Mitte zielen: der Anhänger rückt nach unten, darüber bleibt Platz für Halle und Himmel.
    target.y += distance * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * 0.22;
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
}
