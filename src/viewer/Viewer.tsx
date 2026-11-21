import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Derived, TrailerConfig } from '../trailer/config';
import { TrailerScene, type CameraPose } from './scene';

interface Props {
  config: TrailerConfig;
  derived: Derived;
  showDimensions: boolean;
  /** Jede Änderung setzt die Kamera auf die Ausgangsansicht zurück. */
  resetSignal: number;
  /** Wird mit einer Funktion belegt, die die aktuelle Kamera liefert. */
  poseRef?: RefObject<(() => CameraPose) | null>;
}

export function Viewer({ config, derived, showDimensions, resetSignal, poseRef }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TrailerScene | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      const scene = new TrailerScene(hostRef.current!);
      sceneRef.current = scene;
      if (poseRef) poseRef.current = () => scene.getPose();
    } catch {
      setFailed(true);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
      if (poseRef) poseRef.current = null;
    };
  }, [poseRef]);

  useEffect(() => {
    sceneRef.current?.update(config, derived);
  }, [config, derived]);

  useEffect(() => {
    sceneRef.current?.setDimensionsVisible(showDimensions);
  }, [showDimensions]);

  useEffect(() => {
    if (resetSignal > 0) sceneRef.current?.resetView();
  }, [resetSignal]);

  return (
    <div ref={hostRef} className="stage-canvas" role="img" aria-label="3D-Modell des konfigurierten Anhängers">
      {failed && (
        <p className="stage-error">
          Die 3D-Ansicht braucht WebGL. Dieser Browser stellt es nicht bereit.
        </p>
      )}
    </div>
  );
}
