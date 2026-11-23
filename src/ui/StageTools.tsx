import { useRef, type CSSProperties } from 'react';
import { msg, type Msg } from '../i18n';
import { useLocale } from '../i18n/context';
import type { ViewName } from '../viewer/scene';
import { Popover } from './Popover';
import { useMediaQuery } from './useMediaQuery';

interface Props {
  showDimensions: boolean;
  onDimensions: (show: boolean) => void;
  /** Ob die Last gezeigt wird; null, wenn es keine darstellbare Last gibt. */
  showLoad: boolean | null;
  onLoad: (show: boolean) => void;
  onView: (view: ViewName) => void;
  steeringDeg: number;
  maxSteeringDeg: number;
  onSteering: (deg: number) => void;
  drawbarUp: boolean;
  onDrawbarUp: (up: boolean) => void;
}

const VIEWS: readonly { id: ViewName; name: Msg }[] = [
  { id: 'iso', name: msg('Schräg') },
  { id: 'side', name: msg('Seite') },
  { id: 'top', name: msg('Oben') },
];

/** Werkzeuge an der 3D-Ansicht: was gezeigt wird, von wo, und in welcher Stellung. */
export function StageTools({ showDimensions, onDimensions, showLoad, onLoad, onView, steeringDeg, maxSteeringDeg, onSteering, drawbarUp, onDrawbarUp }: Props) {
  const { t, m } = useLocale();
  const compact = useMediaQuery('(max-width: 1240px)');
  const viewIndex = useRef(0);
  const position = ((steeringDeg + maxSteeringDeg) / (2 * maxSteeringDeg)) * 100;
  const steeringText = steeringDeg === 0 ? '0°' : `${Math.abs(steeringDeg)}° ${t(steeringDeg < 0 ? 'links' : 'rechts')}`;

  const pose = (
    <>
      <label className="tool-slider" htmlFor="steering">
        <span>{t('Lenkung')}</span>
        <input
          id="steering"
          type="range"
          className="centered"
          min={-maxSteeringDeg}
          max={maxSteeringDeg}
          step={1}
          value={steeringDeg}
          disabled={drawbarUp}
          style={{ '--from': `${Math.min(50, position)}%`, '--to': `${Math.max(50, position)}%` } as CSSProperties}
          onChange={(e) => onSteering(Number(e.target.value))}
          onDoubleClick={() => onSteering(0)}
        />
        <output htmlFor="steering">{steeringText}</output>
      </label>
      <button type="button" id="drawbar-up" className="tool" aria-pressed={drawbarUp} onClick={() => onDrawbarUp(!drawbarUp)}>
        {t('Deichsel hoch')}
      </button>
    </>
  );

  return (
    <div className="stage-tools">
      <div className="toolbar" role="toolbar" aria-label={t('Werkzeuge der 3D-Ansicht')}>
        <button type="button" id="toggle-dimensions" className="tool" aria-pressed={showDimensions} onClick={() => onDimensions(!showDimensions)}>
          {t('Maße')}
        </button>
        <button type="button" id="show-load" className="tool" aria-pressed={!!showLoad} disabled={showLoad === null} onClick={() => onLoad(!showLoad)}>
          {t('Ladung')}
        </button>
        <i />
        {compact ? (
          <button
            type="button"
            id="view-next"
            className="tool"
            onClick={() => {
              viewIndex.current = (viewIndex.current + 1) % VIEWS.length;
              onView(VIEWS[viewIndex.current].id);
            }}
          >
            {t('Ansicht')}
          </button>
        ) : (
          VIEWS.map((v) => (
            <button key={v.id} type="button" id={`view-${v.id}`} className="tool" onClick={() => onView(v.id)}>
              {m(v.name)}
            </button>
          ))
        )}
        <i />
        {compact ? (
          <Popover id="pose-menu" buttonClass="tool" up end button={`${t('Lenkung')} ${steeringText}`}>
            {() => <div className="pose">{pose}</div>}
          </Popover>
        ) : (
          pose
        )}
      </div>
    </div>
  );
}
