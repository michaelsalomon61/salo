import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLocale } from '../i18n/context';
import type { Derived, TrailerConfig } from '../trailer/config';
import { TrailerScene } from './scene';

interface Props {
  config: TrailerConfig;
  derived: Derived;
  showDimensions: boolean;
  /** Jede Änderung setzt die Kamera auf die Ausgangsansicht zurück. */
  resetSignal: number;
  /** Wird mit einer Funktion belegt, die die aktuelle Ansicht als PNG liefert. */
  captureRef?: RefObject<(() => string | null) | null>;
}

export function Viewer({ config, derived, showDimensions, resetSignal, captureRef }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TrailerScene | null>(null);
  const [failed, setFailed] = useState(false);
  const L = useLocale();

  useEffect(() => {
    try {
      sceneRef.current = new TrailerScene(hostRef.current!);
      if (captureRef) captureRef.current = () => sceneRef.current?.capture() ?? null;
    } catch {
      setFailed(true);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
      if (captureRef) captureRef.current = null;
    };
  }, [captureRef]);

  useEffect(() => {
    sceneRef.current?.update(config, derived, L.mm);
  }, [config, derived, L]);

  useEffect(() => {
    sceneRef.current?.setDimensionsVisible(showDimensions);
  }, [showDimensions]);

  useEffect(() => {
    if (resetSignal > 0) sceneRef.current?.resetView();
  }, [resetSignal]);

  return (
    <div ref={hostRef} className="stage-canvas" role="img" aria-label={L.t('3D-Modell des konfigurierten Anhängers')}>
      {failed && (
        <p className="stage-error">
          {L.t('Die 3D-Ansicht braucht WebGL. Dieser Browser stellt es nicht bereit.')}
        </p>
      )}
    </div>
  );
}
