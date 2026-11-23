import type { ReactNode } from 'react';
import { msg, type Msg } from '../../i18n';
import { useLocale } from '../../i18n/context';
import { LIMITS, OPTIONS, optionName, type TrailerConfig } from '../../trailer/config';
import { Cards, Chips, More, Segmented, Slider } from '../controls';
import type { StepProps } from './index';

/** Seitenansichten der drei Bauformen als Bildzeichen. */
const PICTURES: Record<TrailerConfig['body'], ReactNode> = {
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

const HINTS: Record<TrailerConfig['body'], Msg> = { platform: msg('durchgehend'), lowbed: msg('mit Tiefbett'), longload: msg('ausziehbar') };

/** Schritt 2: Bauform und Hauptmaße. */
export function VehicleStep({ config, derived, set, note }: StepProps) {
  const { t, m, mm } = useLocale();
  return (
    <>
      <Cards id="body" label={t('Bauform')} value={config.body} options={OPTIONS.body.map((o) => ({ ...o, hint: m(HINTS[o.id]), picture: PICTURES[o.id] }))} onChange={(v) => set('body', v)} />

      {config.body === 'longload' ? (
        <Slider id="length" label={t('Eingestellte Länge')} value={config.lengthMm} display={mm(config.lengthMm)} min={config.minLengthMm} max={config.maxLengthMm} step={config.rasterMm} onChange={(v) => set('lengthMm', v)} />
      ) : (
        <Slider id="length" label={t('Länge')} value={config.lengthMm} display={mm(config.lengthMm)} {...LIMITS.lengthMm} min={derived.minLengthMm} note={note('lengthMm')} onChange={(v) => set('lengthMm', v)} />
      )}
      <Slider id="width" label={t('Breite')} value={config.widthMm} display={mm(config.widthMm)} {...LIMITS.widthMm} min={derived.minWidthMm} note={note('widthMm')} onChange={(v) => set('widthMm', v)} />
      <Slider id="deck-height" label={t(config.body === 'lowbed' ? 'Höhe über den Achsen' : 'Ladehöhe')} value={config.deckHeightMm} display={mm(config.deckHeightMm)} {...LIMITS.deckHeightMm} min={derived.minDeckHeightMm} note={note('deckHeightMm')} onChange={(v) => set('deckHeightMm', v)} />
      <Segmented
        id="axles"
        label={t('Achsen')}
        value={config.axles}
        note={note('axles')}
        options={[2, 3, 4].map((n) => ({ id: n, name: String(n), disabled: n < derived.minAxles }))}
        onChange={(v) => set('axles', v)}
      />

      {config.body === 'lowbed' && (
        <>
          <Slider id="bed-height" label={t('Ladehöhe Tiefbett')} value={config.bedHeightMm} display={mm(config.bedHeightMm)} {...LIMITS.bedHeightMm} max={Math.min(LIMITS.bedHeightMm.max, config.deckHeightMm - 200)} note={note('bedHeightMm')} onChange={(v) => set('bedHeightMm', v)} />
          <Segmented id="rear-wheels" label={t('Hinterräder')} value={config.rearWheels} options={OPTIONS.rearWheels} note={note('rearWheels')} onChange={(v) => set('rearWheels', v)} />
          <Segmented
            id="ramp"
            label={t('Auffahrklappe')}
            value={config.ramp}
            note={note('ramp')}
            options={OPTIONS.ramp.map((o) => ({ ...o, disabled: o.id === 'rear' && config.rearWheels === 'inside' }))}
            onChange={(v) => set('ramp', v)}
          />
        </>
      )}
      {config.body === 'longload' && (
        <>
          <Slider id="min-length" label={t('Mindestlänge')} value={config.minLengthMm} display={mm(config.minLengthMm)} min={LIMITS.lengthMm.min} max={LIMITS.lengthMm.max} step={100} note={note('minLengthMm')} onChange={(v) => set('minLengthMm', v)} />
          <Slider id="max-length" label={t('Maximallänge')} value={config.maxLengthMm} display={mm(config.maxLengthMm)} min={LIMITS.lengthMm.min} max={LIMITS.lengthMm.max} step={100} note={note('maxLengthMm')} onChange={(v) => set('maxLengthMm', v)} />
          <Segmented id="raster" label={t('Längenrasterung')} value={config.rasterMm} options={OPTIONS.rasterMm.map((o) => ({ id: o.id, name: mm(o.id) }))} onChange={(v) => set('rasterMm', v as TrailerConfig['rasterMm'])} />
        </>
      )}
      {config.body === 'platform' && (
        <div className="sections">
          <More title={t('Dachaufbau')} hint={t(optionName('roof', config.roof))}>
            <Segmented id="roof" label={t('Dachaufbau')} value={config.roof} options={OPTIONS.roof} onChange={(v) => set('roof', v)} />
            {config.roof !== 'none' && (
              <>
                <Segmented id="roof-shape" label={t('Dachform')} value={config.roofShape} options={OPTIONS.roofShape} onChange={(v) => set('roofShape', v)} />
                <Slider id="roof-clear" label={t('Lichte Höhe')} value={config.roofClearMm} display={mm(config.roofClearMm)} {...LIMITS.roofClearMm} onChange={(v) => set('roofClearMm', v)} />
                <Chips id="roof-sides" label={t('Seiten')} value={config.roofSides} options={OPTIONS.roofSides} onChange={(v) => set('roofSides', v)} />
              </>
            )}
          </More>
        </div>
      )}
    </>
  );
}
