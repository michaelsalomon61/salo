import { useLocale } from '../../i18n/context';
import { LIMITS, OPTIONS } from '../../trailer/config';
import { Chips, More, NumberField, Segmented, Slider, Subhead, Switch, TextArea } from '../controls';
import type { StepProps } from './index';

/** Schritt 1: Last und Einsatzbedingungen. */
export function TaskStep({ config, set }: StepProps) {
  const { t, mm } = useLocale();
  return (
    <>
      <Slider id="payload" label={t('Nutzlast')} value={config.payloadT} display={`${config.payloadT} t`} {...LIMITS.payloadT} onChange={(v) => set('payloadT', v)} />

      <Subhead>{t('Last')}</Subhead>
      <Segmented id="load-type" label={t('Lastart')} value={config.loadType} options={OPTIONS.loadType} onChange={(v) => set('loadType', v)} />
      {config.loadType === 'custom' ? (
        <TextArea id="load-note" label={t('Beschreibung der Last')} value={config.loadNote} placeholder={t('z. B. vier Auflagepunkte, Schwerpunkt außermittig')} onChange={(v) => set('loadNote', v)} />
      ) : (
        <>
          <Slider id="load-length" label={t('Länge der Last')} value={config.loadLengthMm} display={mm(config.loadLengthMm)} {...LIMITS.loadLengthMm} max={config.lengthMm} onChange={(v) => set('loadLengthMm', v)} />
          <Slider id="load-width" label={t('Breite der Last')} value={config.loadWidthMm} display={mm(config.loadWidthMm)} {...LIMITS.loadWidthMm} max={config.widthMm} onChange={(v) => set('loadWidthMm', v)} />
          <Slider id="load-height" label={t('Höhe der Last')} value={config.loadHeightMm} display={mm(config.loadHeightMm)} {...LIMITS.loadHeightMm} onChange={(v) => set('loadHeightMm', v)} />
        </>
      )}

      <Subhead>{t('Einsatz')}</Subhead>
      <Segmented id="site" label={t('Einsatzort')} value={config.site} options={OPTIONS.site} onChange={(v) => set('site', v)} />
      <Chips id="ground" label={t('Untergrund')} value={config.ground} options={OPTIONS.ground} onChange={(v) => set('ground', v)} />
      <Slider id="speed" label={t('Geschwindigkeit')} value={config.speedKmh} display={`${config.speedKmh} km/h`} {...LIMITS.speedKmh} onChange={(v) => set('speedKmh', v)} />
      <Slider id="slope" label={t('Größte Steigung')} value={config.slopePct} display={`${config.slopePct} %`} {...LIMITS.slopePct} onChange={(v) => set('slopePct', v)} />
      <Switch id="public-roads" label={t('Öffentliche Verkehrswege (StVZO)')} checked={config.publicRoads} onChange={(v) => set('publicRoads', v)} />

      <div className="sections">
        <More title={t('Wege und Betrieb')} hint={t('Hindernisse, Gangbreite, Laufleistung')}>
          <Slider id="obstacle" label={t('Höhe des größten Hindernisses')} value={config.obstacleMm} display={mm(config.obstacleMm)} {...LIMITS.obstacleMm} onChange={(v) => set('obstacleMm', v)} />
          <div className="number-grid">
            <NumberField id="aisle" label={t('Gangbreite')} unit="mm" step={50} value={config.aisleWidthMm} onChange={(v) => set('aisleWidthMm', v)} />
            <NumberField id="curve" label={t('Kurvenradius')} unit="mm" step={50} value={config.curveRadiusMm} onChange={(v) => set('curveRadiusMm', v)} />
            <NumberField id="hours" label={t('Stunden mit Last pro Tag')} unit="h" max={24} step={0.5} value={config.hoursLoadedPerDay} onChange={(v) => set('hoursLoadedPerDay', v)} />
            <NumberField id="distance" label={t('Wegstrecke pro Tag')} unit="km" step={0.5} value={config.distanceKmPerDay} onChange={(v) => set('distanceKmPerDay', v)} />
          </div>
        </More>
        <More title={t('Zugfahrzeug')} hint={t('Gewicht, Kupplungshöhe, Zugkraft')}>
          <div className="number-grid">
            <NumberField id="tow-weight" label={t('Gesamtgewicht')} unit="kg" step={50} value={config.towWeightKg} onChange={(v) => set('towWeightKg', v)} />
            <NumberField id="coupling-height" label={t('Kupplungshöhe')} unit="mm" step={10} max={1500} value={config.couplingHeightMm} onChange={(v) => set('couplingHeightMm', v)} />
            <NumberField id="tow-force" label={t('Zugkraft am Haken')} unit="N" step={100} value={config.towForceN} onChange={(v) => set('towForceN', v)} />
          </div>
          <Slider id="train" label={t('Anhänger im Zug')} value={config.trailersInTrain} display={String(config.trailersInTrain)} {...LIMITS.trailersInTrain} onChange={(v) => set('trailersInTrain', v)} />
        </More>
        <More title={t('Anmerkungen')} hint={t('Sonstige Anforderungen und Wünsche')}>
          <TextArea id="notes" label={t('Sonstige Anforderungen und Wünsche')} value={config.notes} onChange={(v) => set('notes', v)} />
        </More>
      </div>
    </>
  );
}
