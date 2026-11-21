import { useEffect, useRef, useState } from 'react';
import type { Derived, TrailerConfig } from '../trailer/config';
import { TrailerScene } from './scene';

interface Props {
  config: TrailerConfig;
  derived: Derived;
  showDimensions: boolean;
  /** Jede Änderung setzt die Kamera auf die Ausgangsansicht zurück. */
  resetSignal: number;
}

export function Viewer({ config, derived, showDimensions, resetSignal }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TrailerScene | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      sceneRef.current = new TrailerScene(hostRef.current!);
    } catch {
      setFailed(true);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

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
