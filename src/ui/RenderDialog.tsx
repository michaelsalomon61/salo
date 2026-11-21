import { useEffect, useRef, useState } from 'react';
import { PhotoRenderer, type PhotoProgress, type PhotoView } from '../render/photo';
import type { Derived, TrailerConfig } from '../trailer/config';
import type { CameraPose } from '../viewer/scene';
import { Dialog } from './Dialog';
import { saveBlob } from './download';

interface Props {
  config: TrailerConfig;
  derived: Derived;
  summary: string;
  fileBase: string;
  /** Kamera des Konfigurators, für die Ansicht "Aktuell". */
  pose: CameraPose | null;
  onClose: () => void;
}

const VIEWS: { id: PhotoView; label: string }[] = [
  { id: 'front', label: 'Vorne' },
  { id: 'side', label: 'Seite' },
  { id: 'rear', label: 'Hinten' },
  { id: 'current', label: 'Aktuell' },
];

export default function RenderDialog({ config, derived, summary, fileBase, pose, onClose }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PhotoRenderer | null>(null);
  const [view, setView] = useState<PhotoView>('front');
  const [progress, setProgress] = useState<PhotoProgress | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Bildgröße an Bildschirm und Pixeldichte ausrichten, im Format 16:9.
    const width = Math.round(
      Math.min(1600, Math.max(960, Math.min(window.innerWidth, 1200) * Math.min(window.devicePixelRatio, 2))) / 16,
    ) * 16;
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;
    frameRef.current!.appendChild(canvas);
    try {
      rendererRef.current = new PhotoRenderer(canvas, config, derived, { width, height: (width / 16) * 9 }, setProgress);
    } catch {
      setFailed(true);
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
      canvas.remove();
    };
  }, [config, derived]);

  useEffect(() => {
    rendererRef.current?.setView(view, pose ?? undefined);
  }, [view, pose, config, derived]);

  const percent = progress ? Math.round((progress.samples / progress.target) * 100) : 0;
  const status = failed
    ? 'Das Rendering braucht WebGL. Dieser Browser stellt es nicht bereit.'
    : !progress || progress.samples === 0
      ? 'Szene wird vorbereitet …'
      : !progress.pathTraced
        ? 'Vereinfachte Darstellung: Dieses Gerät unterstützt die physikalische Lichtberechnung nicht.'
        : progress.done
          ? 'Fertig berechnet.'
          : `Licht wird berechnet, das Bild wird laufend feiner: ${percent} %`;

  const save = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) saveBlob(blob, `${fileBase}-${view}.png`);
    }, 'image/png');
  };

  return (
    <Dialog title="Rendering" subtitle={summary} onClose={onClose}>
      <div className="render-frame" ref={frameRef} />
      <div
        className="progress"
        role="progressbar"
        aria-label="Fortschritt der Bildberechnung"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="status" aria-live="polite">
        {status}
      </p>
      <div className="dialog-actions">
        <div className="segmented" role="radiogroup" aria-label="Ansicht" id="render-view">
          {VIEWS.filter((v) => v.id !== 'current' || pose).map((v) => (
            <button
              key={v.id}
              type="button"
              id={`render-view-${v.id}`}
              role="radio"
              aria-checked={v.id === view}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          id="render-save"
          className="button primary"
          disabled={!progress || progress.samples < 1}
          onClick={save}
        >
          Bild speichern
        </button>
      </div>
      <p className="footnote">
        Das Bild entsteht im Browser durch Path Tracing. Die Berechnung dauert je nach Grafikkarte einige Sekunden
        bis Minuten; speichern ist jederzeit möglich.
      </p>
    </Dialog>
  );
}
