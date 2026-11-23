import { useLocale } from '../../i18n/context';
import { OPTIONS } from '../../trailer/config';
import { Chips, Switch } from '../controls';
import type { StepProps } from './index';

/** Schritt 3: Lenkung, Räder, Federung und Bremse. */
export function RunningStep({ config, set }: StepProps) {
  const { t } = useLocale();
  return (
    <>
      <Chips id="steering-type" label={t('Lenkung')} value={config.steering} options={OPTIONS.steering} onChange={(v) => set('steering', v)} />
      <Chips id="tyre" label={t('Bereifung')} value={config.tyre} options={OPTIONS.tyre} onChange={(v) => set('tyre', v)} />
      <Switch id="non-marking" label={t('Spurfreie Bereifung')} checked={config.nonMarking} onChange={(v) => set('nonMarking', v)} />
      <Chips id="suspension" label={t('Federung')} value={config.suspension} options={OPTIONS.suspension} onChange={(v) => set('suspension', v)} />
      <Chips id="brake" label={t('Betriebsbremse')} value={config.brake} options={OPTIONS.brake} onChange={(v) => set('brake', v)} />
      <Switch id="parking-brake" label={t('Feststellbremse')} checked={config.parkingBrake} onChange={(v) => set('parkingBrake', v)} />
    </>
  );
}
