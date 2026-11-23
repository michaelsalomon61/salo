import { useLocale } from '../../i18n/context';
import { COLORS, OPTIONS, hasBoardDeck, type TrailerConfig } from '../../trailer/config';
import { Chips, Field, Segmented, Subhead, Switch } from '../controls';
import type { StepProps } from './index';

/** Schritt 4: Ladefläche, Deichsel und Ausstattung. */
export function BodyStep({ config, set }: StepProps) {
  const { t, mm } = useLocale();
  const color = COLORS.find((c) => c.id === config.colorId) ?? COLORS[0];
  return (
    <>
      <Chips id="deck" label={t('Belag')} value={config.deck} options={OPTIONS.deck} onChange={(v) => set('deck', v)} />
      {hasBoardDeck(config.deck) && config.body === 'platform' && (
        <Segmented id="edge" label={t('Kantenschutz')} value={config.edgeProtection} options={OPTIONS.edgeProtection} onChange={(v) => set('edgeProtection', v)} />
      )}
      {config.body === 'platform' && <Segmented id="wall-type" label={t('Bordwände')} value={config.wallType} options={OPTIONS.wallType} onChange={(v) => set('wallType', v)} />}
      {config.wallType !== 'none' && (
        <>
          <Segmented id="wall-material" label={t('Material der Bordwände')} value={config.wallMaterial} options={OPTIONS.wallMaterial} onChange={(v) => set('wallMaterial', v)} />
          <Segmented id="wall-height" label={t('Höhe der Bordwände')} value={config.wallHeightMm} options={OPTIONS.wallHeightMm.map((o) => ({ id: o.id, name: mm(o.id) }))} onChange={(v) => set('wallHeightMm', v as TrailerConfig['wallHeightMm'])} />
        </>
      )}
      {config.body !== 'longload' && <Switch id="lashing" label={t('Verzurrösen zur Ladungssicherung')} checked={config.lashingRings} onChange={(v) => set('lashingRings', v)} />}
      <Field label={t('Lackierung')} value={`${color.ral} ${t(color.name)}`}>
        <div className="swatches" role="radiogroup" aria-label={t('Lackierung')}>
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              id={`color-${c.id}`}
              role="radio"
              aria-checked={c.id === config.colorId}
              aria-label={`${c.ral} ${t(c.name)}`}
              title={`${c.ral} ${t(c.name)}`}
              className="swatch"
              style={{ background: c.hex }}
              onClick={() => set('colorId', c.id)}
            />
          ))}
        </div>
      </Field>

      <Subhead>{t('Deichsel und Kupplung')}</Subhead>
      <Segmented id="tow-eye" label={t('Zugöse')} value={config.towEye} options={OPTIONS.towEye} onChange={(v) => set('towEye', v)} />
      <Switch id="drawbar-spring" label={t('Gefederte Höheneinstellung')} checked={config.drawbarSpring} onChange={(v) => set('drawbarSpring', v)} />
      <Chips id="rear-coupling" label={t('Kupplung hinten')} value={config.rearCoupling} options={OPTIONS.rearCoupling} onChange={(v) => set('rearCoupling', v)} />

      <Subhead>{t('Ausstattung')}</Subhead>
      <Segmented id="lighting" label={t('Beleuchtung')} value={config.lighting} options={OPTIONS.lighting} onChange={(v) => set('lighting', v)} />
      <Chips id="chocks" label={t('Unterlegkeile')} value={config.chocks} options={OPTIONS.chocks} onChange={(v) => set('chocks', v)} />
    </>
  );
}
