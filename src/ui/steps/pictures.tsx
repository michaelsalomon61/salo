import type { ReactNode } from 'react';
import type { Steering, TrailerConfig, Tyre } from '../../trailer/config';

/** Seitenansichten der drei Bauformen als Bildzeichen. */
export const BODY_PICTURES: Record<TrailerConfig['body'], ReactNode> = {
  platform: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      <rect x="6" y="12" width="64" height="7" rx="1.5" />
      <circle cx="20" cy="26" r="6" />
      <circle cx="58" cy="26" r="6" />
      <rect x="70" y="16" width="12" height="2" rx="1" />
    </svg>
  ),
  lowbed: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      <path d="M6 10h18v7h-3v8h26v-8h-3v-7h26v7H50v12H18V17H6z" />
      <circle cx="12" cy="26" r="5.5" />
      <circle cx="62" cy="26" r="5.5" />
      <rect x="70" y="14" width="12" height="2" rx="1" />
    </svg>
  ),
  longload: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      <rect x="6" y="14" width="16" height="6" rx="1.5" />
      <rect x="52" y="14" width="16" height="6" rx="1.5" />
      <rect x="20" y="16" width="34" height="2.4" />
      <rect x="8" y="4" width="2.4" height="11" />
      <rect x="18" y="4" width="2.4" height="11" />
      <rect x="54" y="4" width="2.4" height="11" />
      <rect x="64" y="4" width="2.4" height="11" />
      <circle cx="14" cy="27" r="5.5" />
      <circle cx="60" cy="27" r="5.5" />
      <rect x="68" y="16.5" width="14" height="2" rx="1" />
    </svg>
  ),
};

/** Draufsicht auf das Fahrgestell, vorn rechts: Rad als kleines Rechteck, um seine Mitte gedreht. */
function wheel(x: number, y: number, turn = 0, key?: string) {
  return <rect key={key} x={x - 6.5} y={y - 3} width="13" height="6" rx="2" transform={turn ? `rotate(${turn} ${x} ${y})` : undefined} />;
}

const FRONT = 53;
const REAR = 21;
const TOP = 7;
const BOTTOM = 31;
const frame = <rect x="9" y="10" width="56" height="18" rx="2.5" opacity="0.32" />;
/** Achse als Ganzes: Achskörper mit beiden Rädern, auf Wunsch mit Deichsel. */
const axle = (x: number, drawbar = false) => (
  <>
    <rect x={x - 1.2} y={TOP} width="2.4" height={BOTTOM - TOP} />
    {wheel(x, TOP)}
    {wheel(x, BOTTOM)}
    {drawbar && <rect x={x} y="17.9" width="27" height="2.2" rx="1.1" />}
  </>
);
/** Zwillingsräder einer Pendelachse. */
const twin = (x: number, y: number, turn: number) => (
  <g transform={`rotate(${turn} ${x} ${y})`}>
    <rect x={x - 6.5} y={y - 5} width="13" height="4.2" rx="1.6" />
    <rect x={x - 6.5} y={y + 0.8} width="13" height="4.2" rx="1.6" />
  </g>
);
const drawbar = <rect x="63" y="17.9" width="18" height="2.2" rx="1.1" transform="rotate(-16 63 19)" />;

/** Was sich bei welcher Lenkung dreht. */
export const STEERING_PICTURES: Record<Steering, ReactNode> = {
  turntable: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      {frame}
      {axle(REAR)}
      <g transform={`rotate(-22 ${FRONT} 19)`}>{axle(FRONT, true)}</g>
    </svg>
  ),
  doubleTurntable: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      {frame}
      <g transform={`rotate(20 ${REAR} 19)`}>{axle(REAR)}</g>
      <g transform={`rotate(-20 ${FRONT} 19)`}>{axle(FRONT, true)}</g>
    </svg>
  ),
  ackermann2: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      {frame}
      {axle(REAR)}
      {wheel(FRONT, TOP, -26)}
      {wheel(FRONT, BOTTOM, -20)}
      {drawbar}
    </svg>
  ),
  ackermann4: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      {frame}
      {wheel(REAR, TOP, 22)}
      {wheel(REAR, BOTTOM, 17)}
      {wheel(FRONT, TOP, -26)}
      {wheel(FRONT, BOTTOM, -20)}
      {drawbar}
    </svg>
  ),
  allWheel: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      {frame}
      {twin(REAR, TOP + 1, 22)}
      {twin(REAR, BOTTOM - 1, 17)}
      {twin(FRONT, TOP + 1, -26)}
      {twin(FRONT, BOTTOM - 1, -20)}
      {drawbar}
    </svg>
  ),
};

/** Kreisring um die Radmitte als Pfad; zusammen mit fill-rule evenodd bleibt die Mitte frei. */
const ring = (outer: number, inner: number) =>
  [outer, inner].map((r) => `M${42 - r} 19a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`).join('');
const hub = <circle cx="42" cy="19" r="2.6" />;

/** Seitenansicht des Rads: Die Bereifungen unterscheiden sich in Aufbau und Stärke der Lauffläche. */
export const TYRE_PICTURES: Record<Tyre, ReactNode> = {
  // Massiver Gummiring auf kleiner Felge.
  solid: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      <path fillRule="evenodd" d={ring(17, 7)} />
      {hub}
    </svg>
  ),
  // Vollreifen in zwei Schichten: Lauffläche und weicher Kern.
  superElastic: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      <path fillRule="evenodd" d={ring(17, 12.8)} />
      <path fillRule="evenodd" d={ring(11.4, 7)} opacity="0.55" />
      {hub}
    </svg>
  ),
  // Luftreifen mit Profilstollen und großer Felge.
  pneumatic: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x="40.4" y="1.2" width="3.2" height="3" rx="0.6" transform={`rotate(${(i * 360) / 14} 42 19)`} />
      ))}
      <path fillRule="evenodd" d={ring(15, 10.6)} />
      <path fillRule="evenodd" d={ring(9.2, 7.6)} opacity="0.55" />
      {hub}
    </svg>
  ),
  // Dünne Bandage auf einem Stahlrad.
  polyurethane: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      <path fillRule="evenodd" d={ring(17, 14.6)} />
      <path fillRule="evenodd" d={ring(13.4, 4.6)} opacity="0.55" />
      {hub}
    </svg>
  ),
};
