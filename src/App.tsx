import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGES, initialLang, locale, msg, rememberLang, type Lang, type Msg } from './i18n';
import { LocaleContext } from './i18n/context';
import { clearSaved, deleteSaved, importSaved, listSaved, loadDraft, saveConfig, saveDraft, type SavedConfig } from './storage/saved';
import { decodeShare, shareUrl } from './storage/share';
import { advise, performance } from './trailer/advice';
import { buildBom } from './trailer/bom';
import { COLORS, DEFAULT_CONFIG, LIMITS, OPTIONS, STEERING, hasBoardDeck, optionName, resolve, type TrailerConfig } from './trailer/config';
import { trailerParts } from './trailer/parts';
import { estimateQuote } from './trailer/pricing';
import { buildImagePrompt } from './trailer/prompt';
import { describeConfig, describeProse } from './trailer/summary';
import { BomDialog } from './ui/BomDialog';
import { Chips, Field, NumberField, Section, Segmented, Slider, Switch, TextArea } from './ui/controls';
import { saveBlob } from './ui/download';
import { PromptDialog } from './ui/PromptDialog';
import { QuoteDialog } from './ui/QuoteDialog';
import { ResetDialog } from './ui/ResetDialog';
import { SavedDialog } from './ui/SavedDialog';
import { ShareDialog } from './ui/ShareDialog';
import { SummaryDialog } from './ui/SummaryDialog';
import { Viewer } from './viewer/Viewer';

export function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const L = useMemo(() => locale(lang), [lang]);
  const { t, mm, kg, nf } = L;
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t('Anhänger-Konfigurator');
    rememberLang(lang);
  }, [lang, t]);

  // Gewünschte Werte; das Regelwerk leitet daraus die baubare Konfiguration ab.
  // Ein geteilter Link hat Vorrang; sonst wird der Arbeitsstand der letzten Sitzung wiederhergestellt.
  const [shared] = useState(() => decodeShare(window.location.hash));
  const [draft] = useState(loadDraft);
  const [requested, setRequested] = useState<TrailerConfig>(shared?.config ?? draft?.config ?? DEFAULT_CONFIG);
  const [saved, setSaved] = useState<SavedConfig[]>(listSaved);
  const [currentId, setCurrentId] = useState<string | null>(shared ? null : (draft?.currentId ?? null));
  const [saveStatus, setSaveStatus] = useState<Msg | null>(
    shared ? (shared.name ? msg('Aus Link geöffnet: „{name}“', { name: { raw: shared.name } }) : msg('Aus Link geöffnet')) : null,
  );
  /** Name aus dem geteilten Link, als Vorschlag beim Speichern. */
  const [linkName, setLinkName] = useState<string | null>(shared?.name ?? null);

  useEffect(() => {
    // Die Konfiguration aus dem Link ist übernommen; ohne Anhang überschreibt ein Neuladen keine Änderungen.
    if (shared) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [shared]);
  const current = saved.find((e) => e.id === currentId) ?? null;
  const unsaved = current ? JSON.stringify(current.config) !== JSON.stringify(requested) : true;

  useEffect(() => {
    saveDraft({ config: requested, currentId });
  }, [requested, currentId]);
  const [showDimensions, setShowDimensions] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);
  const [dialog, setDialog] = useState<'summary' | 'bom' | 'saved' | 'saveAs' | 'share' | 'quote' | 'prompt' | 'reset' | null>(null);
  const captureRef = useRef<(() => string | null) | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  /** Zählt Neustarts; damit werden die Abschnitte der Bedienung neu aufgebaut. */
  const [generation, setGeneration] = useState(0);
  const closeDialog = useCallback(() => setDialog(null), []);
  const [step, setStep] = useState<'idle' | 'working' | 'failed'>('idle');

  const { config, derived, adjustments } = useMemo(() => resolve(requested), [requested]);
  const set = <K extends keyof TrailerConfig>(key: K, value: TrailerConfig[K]) => {
    setSaveStatus(null);
    setRequested((previous) => ({ ...previous, [key]: value }));
  };
  /** Hinweis des Regelwerks zu einem Feld, in der gewählten Sprache. */
  const note = (field: keyof typeof adjustments) => (adjustments[field] ? L.m(adjustments[field]) : undefined);

  /** Speichert die Eingaben unter einem Namen; liefert eine Fehlermeldung, wenn der Browser es verweigert. */
  const save = (name: string): Msg | null => {
    try {
      const result = saveConfig(name, requested);
      setSaved(result.list);
      setCurrentId(result.entry.id);
      setLinkName(null);
      setSaveStatus(msg('Gespeichert'));
      return null;
    } catch {
      return msg('Speichern nicht möglich: Der Browser lässt keinen lokalen Speicher zu.');
    }
  };
  const quickSave = () => {
    if (!current) return setDialog('saveAs');
    const error = save(current.name);
    if (error) setSaveStatus(error);
  };

  // Die Stückliste liefert auch das Eigengewicht für Kennwerte und Hinweise.
  const description = useMemo(() => trailerParts(config, derived), [config, derived]);
  const bom = useMemo(() => buildBom(description.parts, L), [description, L]);
  const perf = performance(config, derived, bom.totalKg);
  const quote = useMemo(() => estimateQuote(config, description.parts), [config, description]);
  const notices = useMemo(() => advise(config, derived, bom.totalKg).map(L.m), [config, derived, bom, L]);

  const color = COLORS.find((c) => c.id === config.colorId) ?? COLORS[0];
  const colorName = `${color.ral} ${t(color.name)}`;
  const headline = t('{payload} t Traglast, {axles} Achsen, {length} × {width}', {
    payload: config.payloadT,
    axles: config.axles,
    length: { raw: mm(config.lengthMm) },
    width: { raw: mm(config.widthMm) },
  });
  const summary = `${headline}, ${t('Ladehöhe')} ${mm(config.deckHeightMm)}, ${t(optionName('deck', config.deck))}, ${colorName}`;
  const fileBase = `${t('anhaenger')}-${config.payloadT}t-${config.lengthMm}x${config.widthMm}`;
  const steeringText = (deg: number) => (deg === 0 ? t('Geradeaus') : `${Math.abs(deg)}° ${t(deg < 0 ? 'links' : 'rechts')}`);
  const approx = (value: string) => t('ca. {value}', { value: { raw: value } });
  const sizeOptions = (key: 'wallHeightMm' | 'rasterMm') => OPTIONS[key].map((o) => ({ id: o.id, name: mm(o.id) }));

  const imagePrompt = () => buildImagePrompt(config, derived, description, bom.totalKg, bom.pieceCount, L);
  /** Kopiert den Prompt sofort beim Klick und zeigt ihn danach an. */
  const openPrompt = async () => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(imagePrompt());
      copied = true;
    } catch {
      // Der Dialog bietet das Kopieren dann von Hand an.
    }
    setPromptCopied(copied);
    setDialog('prompt');
  };

  /** Stellt den Zustand wie beim ersten Öffnen her; gespeicherte Konfigurationen nur auf Wunsch. */
  const reset = (deleteStored: boolean) => {
    setRequested(DEFAULT_CONFIG);
    setCurrentId(null);
    setLinkName(null);
    setSaveStatus(null);
    setStep('idle');
    setShowDimensions(true);
    setResetSignal((n) => n + 1);
    setGeneration((n) => n + 1);
    if (deleteStored) {
      try {
        setSaved(clearSaved());
      } catch {
        setSaveStatus(msg('Löschen nicht möglich: Der Browser lässt keinen lokalen Speicher zu.'));
      }
    }
    setDialog(null);
    panelRef.current?.scrollTo({ top: 0 });
  };

  const saveStep = async () => {
    setStep('working');
    try {
      const { exportStep } = await import('./cad/exportStep');
      saveBlob(await exportStep(config, derived, L.partName), `${fileBase}.step`);
      setStep('idle');
    } catch {
      setStep('failed');
    }
  };

  return (
    <LocaleContext.Provider value={L}>
      <div className="app">
        <section className="stage" aria-label={t('3D-Ansicht')}>
          <Viewer config={config} derived={derived} showDimensions={showDimensions} resetSignal={resetSignal} captureRef={captureRef} />
          <div className="stage-tools">
            <select id="language" className="pill" aria-label={t('Sprache')} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button type="button" id="toggle-dimensions" className="pill" aria-pressed={showDimensions} onClick={() => setShowDimensions((v) => !v)}>
              {t('Maße')}
            </button>
            <button type="button" id="reset-view" className="pill" onClick={() => setResetSignal((n) => n + 1)}>
              {t('Ansicht zurücksetzen')}
            </button>
          </div>
          <p className="stage-hint">{t('Ziehen dreht das Modell, Scrollen oder Spreizen zoomt.')}</p>
        </section>

        <aside className="panel" aria-label={t('Konfiguration')} ref={panelRef}>
          <header className="panel-head">
            <p className="eyebrow">{t('Konfigurator')}</p>
            <h1>{t('Schwerlastanhänger')}</h1>
            <p className="lede">{headline}</p>
            <div className="actions">
              <button type="button" id="open-quote" className="button primary" onClick={() => setDialog('quote')}>
                {t('Angebot')}
              </button>
              <button type="button" id="open-summary" className="button" onClick={() => setDialog('summary')}>
                {t('Zusammenfassung')}
              </button>
              <button type="button" id="open-bom" className="button" onClick={() => setDialog('bom')}>
                {t('Stückliste')}
              </button>
              <button type="button" id="save-step" className="button" disabled={step === 'working'} onClick={saveStep}>
                {t(step === 'working' ? 'Wird erzeugt …' : 'STEP-Modell')}
              </button>
              <button type="button" id="open-prompt" className="button" onClick={() => void openPrompt()}>
                {t('KI-Bildprompt')}
              </button>
            </div>
            {step === 'failed' && (
              <p className="note" role="alert">
                {t('Das STEP-Modell konnte nicht erzeugt werden. Bitte Verbindung prüfen und erneut versuchen.')}
              </p>
            )}
            <div className="save-bar">
              <div className="save-state">
                <p className="save-name">{current ? current.name : t('Nicht gespeichert')}</p>
                <p className="save-hint" aria-live="polite">
                  {saveStatus ? L.m(saveStatus) : t(current ? (unsaved ? 'Ungespeicherte Änderungen' : 'Alle Änderungen gespeichert') : 'Noch ohne Namen')}
                </p>
              </div>
              <div className="save-buttons">
                <button type="button" id="quick-save" className="button" disabled={!!current && !unsaved} onClick={quickSave}>
                  {t('Speichern')}
                </button>
                <button type="button" id="save-as" className="button" onClick={() => setDialog('saveAs')}>
                  {t('Speichern unter …')}
                </button>
                <button type="button" id="open-share" className="button" onClick={() => setDialog('share')}>
                  {t('Link teilen')}
                </button>
                <button type="button" id="open-saved" className="button" onClick={() => setDialog('saved')}>
                  {t('Gespeicherte')}
                  {saved.length > 0 ? ` (${saved.length})` : ''}
                </button>
                <button type="button" id="open-reset" className="button" onClick={() => setDialog('reset')}>
                  {t('Zurücksetzen')}
                </button>
              </div>
            </div>
          </header>

          <div className="sections" key={generation}>
            <Section title={t('Grunddaten')} open>
              <Slider id="payload" label={t('Nutzlast')} value={config.payloadT} display={`${config.payloadT} t`} {...LIMITS.payloadT} onChange={(v) => set('payloadT', v)} />
              <Segmented
                id="axles"
                label={t('Achsen')}
                value={config.axles}
                note={note('axles')}
                options={[2, 3, 4].map((n) => ({ id: n, name: String(n), disabled: n < derived.minAxles }))}
                onChange={(v) => set('axles', v)}
              />
              {config.body === 'longload' ? (
                <Slider id="length" label={t('Eingestellte Länge')} value={config.lengthMm} display={mm(config.lengthMm)} min={config.minLengthMm} max={config.maxLengthMm} step={config.rasterMm} onChange={(v) => set('lengthMm', v)} />
              ) : (
                <Slider id="length" label={t('Länge')} value={config.lengthMm} display={mm(config.lengthMm)} {...LIMITS.lengthMm} min={derived.minLengthMm} note={note('lengthMm')} onChange={(v) => set('lengthMm', v)} />
              )}
              <Slider id="width" label={t('Breite')} value={config.widthMm} display={mm(config.widthMm)} {...LIMITS.widthMm} min={derived.minWidthMm} note={note('widthMm')} onChange={(v) => set('widthMm', v)} />
              <Slider id="deck-height" label={t(config.body === 'lowbed' ? 'Höhe über den Achsen' : 'Ladehöhe')} value={config.deckHeightMm} display={mm(config.deckHeightMm)} {...LIMITS.deckHeightMm} min={derived.minDeckHeightMm} note={note('deckHeightMm')} onChange={(v) => set('deckHeightMm', v)} />
            </Section>

            <Section title={t('Bauform')}>
              <Segmented id="body" label={t('Bauform')} value={config.body} options={OPTIONS.body} onChange={(v) => set('body', v)} />
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
                  <Segmented id="raster" label={t('Längenrasterung')} value={config.rasterMm} options={sizeOptions('rasterMm')} onChange={(v) => set('rasterMm', v as TrailerConfig['rasterMm'])} />
                </>
              )}
              {config.body === 'platform' && (
                <>
                  <Segmented id="roof" label={t('Dachaufbau')} value={config.roof} options={OPTIONS.roof} onChange={(v) => set('roof', v)} />
                  {config.roof !== 'none' && (
                    <>
                      <Segmented id="roof-shape" label={t('Dachform')} value={config.roofShape} options={OPTIONS.roofShape} onChange={(v) => set('roofShape', v)} />
                      <Slider id="roof-clear" label={t('Lichte Höhe')} value={config.roofClearMm} display={mm(config.roofClearMm)} {...LIMITS.roofClearMm} onChange={(v) => set('roofClearMm', v)} />
                      <Chips id="roof-sides" label={t('Seiten')} value={config.roofSides} options={OPTIONS.roofSides} onChange={(v) => set('roofSides', v)} />
                    </>
                  )}
                </>
              )}
            </Section>

            <Section title={t('Einsatz')}>
              <Slider id="speed" label={t('Geschwindigkeit')} value={config.speedKmh} display={`${config.speedKmh} km/h`} {...LIMITS.speedKmh} onChange={(v) => set('speedKmh', v)} />
              <Segmented id="site" label={t('Einsatzort')} value={config.site} options={OPTIONS.site} onChange={(v) => set('site', v)} />
              <Switch id="public-roads" label={t('Öffentliche Verkehrswege (StVZO)')} checked={config.publicRoads} onChange={(v) => set('publicRoads', v)} />
              <Chips id="ground" label={t('Untergrund')} value={config.ground} options={OPTIONS.ground} onChange={(v) => set('ground', v)} />
              <Slider id="slope" label={t('Größte Steigung')} value={config.slopePct} display={`${config.slopePct} %`} {...LIMITS.slopePct} onChange={(v) => set('slopePct', v)} />
              <Slider id="obstacle" label={t('Höhe des größten Hindernisses')} value={config.obstacleMm} display={mm(config.obstacleMm)} {...LIMITS.obstacleMm} onChange={(v) => set('obstacleMm', v)} />
              <div className="number-grid">
                <NumberField id="aisle" label={t('Gangbreite')} unit="mm" step={50} value={config.aisleWidthMm} onChange={(v) => set('aisleWidthMm', v)} />
                <NumberField id="curve" label={t('Kurvenradius')} unit="mm" step={50} value={config.curveRadiusMm} onChange={(v) => set('curveRadiusMm', v)} />
                <NumberField id="hours" label={t('Stunden mit Last pro Tag')} unit="h" max={24} step={0.5} value={config.hoursLoadedPerDay} onChange={(v) => set('hoursLoadedPerDay', v)} />
                <NumberField id="distance" label={t('Wegstrecke pro Tag')} unit="km" step={0.5} value={config.distanceKmPerDay} onChange={(v) => set('distanceKmPerDay', v)} />
              </div>
            </Section>

            <Section title={t('Last')}>
              <Segmented id="load-type" label={t('Lastart')} value={config.loadType} options={OPTIONS.loadType} onChange={(v) => set('loadType', v)} />
              {config.loadType === 'custom' ? (
                <TextArea id="load-note" label={t('Beschreibung der Last')} value={config.loadNote} placeholder={t('z. B. vier Auflagepunkte, Schwerpunkt außermittig')} onChange={(v) => set('loadNote', v)} />
              ) : (
                <>
                  <Slider id="load-length" label={t('Länge der Last')} value={config.loadLengthMm} display={mm(config.loadLengthMm)} {...LIMITS.loadLengthMm} max={config.lengthMm} onChange={(v) => set('loadLengthMm', v)} />
                  <Slider id="load-width" label={t('Breite der Last')} value={config.loadWidthMm} display={mm(config.loadWidthMm)} {...LIMITS.loadWidthMm} max={config.widthMm} onChange={(v) => set('loadWidthMm', v)} />
                  <Slider id="load-height" label={t('Höhe der Last')} value={config.loadHeightMm} display={mm(config.loadHeightMm)} {...LIMITS.loadHeightMm} onChange={(v) => set('loadHeightMm', v)} />
                  <Switch id="show-load" label={t('Last im Modell zeigen')} checked={config.showLoad} onChange={(v) => set('showLoad', v)} />
                </>
              )}
            </Section>

            <Section title={t('Fahrwerk')}>
              <Chips id="steering-type" label={t('Lenkung')} value={config.steering} options={OPTIONS.steering} onChange={(v) => set('steering', v)} />
              <Chips id="tyre" label={t('Bereifung')} value={config.tyre} options={OPTIONS.tyre} onChange={(v) => set('tyre', v)} />
              <Switch id="non-marking" label={t('Spurfreie Bereifung')} checked={config.nonMarking} onChange={(v) => set('nonMarking', v)} />
              <Chips id="suspension" label={t('Federung')} value={config.suspension} options={OPTIONS.suspension} onChange={(v) => set('suspension', v)} />
              <Chips id="brake" label={t('Betriebsbremse')} value={config.brake} options={OPTIONS.brake} onChange={(v) => set('brake', v)} />
              <Switch id="parking-brake" label={t('Feststellbremse')} checked={config.parkingBrake} onChange={(v) => set('parkingBrake', v)} />
            </Section>

            <Section title={t('Ladefläche')}>
              <Chips id="deck" label={t('Belag')} value={config.deck} options={OPTIONS.deck} onChange={(v) => set('deck', v)} />
              {hasBoardDeck(config.deck) && config.body === 'platform' && (
                <Segmented id="edge" label={t('Kantenschutz')} value={config.edgeProtection} options={OPTIONS.edgeProtection} onChange={(v) => set('edgeProtection', v)} />
              )}
              {config.body === 'platform' && <Segmented id="wall-type" label={t('Bordwände')} value={config.wallType} options={OPTIONS.wallType} onChange={(v) => set('wallType', v)} />}
              {config.wallType !== 'none' && (
                <>
                  <Segmented id="wall-material" label={t('Material der Bordwände')} value={config.wallMaterial} options={OPTIONS.wallMaterial} onChange={(v) => set('wallMaterial', v)} />
                  <Segmented id="wall-height" label={t('Höhe der Bordwände')} value={config.wallHeightMm} options={sizeOptions('wallHeightMm')} onChange={(v) => set('wallHeightMm', v as TrailerConfig['wallHeightMm'])} />
                </>
              )}
              {config.body !== 'longload' && <Switch id="lashing" label={t('Verzurrösen zur Ladungssicherung')} checked={config.lashingRings} onChange={(v) => set('lashingRings', v)} />}
            </Section>

            <Section title={t('Deichsel und Kupplung')}>
              <Segmented id="tow-eye" label={t('Zugöse')} value={config.towEye} options={OPTIONS.towEye} onChange={(v) => set('towEye', v)} />
              <Switch id="drawbar-spring" label={t('Gefederte Höheneinstellung')} checked={config.drawbarSpring} onChange={(v) => set('drawbarSpring', v)} />
              <Slider
                id="steering"
                label={t('Lenkeinschlag')}
                value={config.steeringDeg}
                display={steeringText(config.steeringDeg)}
                {...LIMITS.steeringDeg}
                min={-STEERING[config.steering].maxDeg}
                max={STEERING[config.steering].maxDeg}
                centered
                disabled={config.drawbarUp}
                note={note('steeringDeg')}
                onChange={(v) => set('steeringDeg', v)}
              />
              <Switch id="drawbar-up" label={t('Deichsel hochgeklappt')} checked={config.drawbarUp} onChange={(v) => set('drawbarUp', v)} />
              <Chips id="rear-coupling" label={t('Kupplung hinten')} value={config.rearCoupling} options={OPTIONS.rearCoupling} onChange={(v) => set('rearCoupling', v)} />
            </Section>

            <Section title={t('Ausstattung')}>
              <Segmented id="lighting" label={t('Beleuchtung')} value={config.lighting} options={OPTIONS.lighting} onChange={(v) => set('lighting', v)} />
              <Chips id="chocks" label={t('Unterlegkeile')} value={config.chocks} options={OPTIONS.chocks} onChange={(v) => set('chocks', v)} />
              <Field label={t('Lackierung')} value={colorName}>
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
            </Section>

            <Section title={t('Zugfahrzeug')}>
              <div className="number-grid">
                <NumberField id="tow-weight" label={t('Gesamtgewicht')} unit="kg" step={50} value={config.towWeightKg} onChange={(v) => set('towWeightKg', v)} />
                <NumberField id="coupling-height" label={t('Kupplungshöhe')} unit="mm" step={10} max={1500} value={config.couplingHeightMm} onChange={(v) => set('couplingHeightMm', v)} />
                <NumberField id="tow-force" label={t('Zugkraft am Haken')} unit="N" step={100} value={config.towForceN} onChange={(v) => set('towForceN', v)} />
              </div>
              <Slider id="train" label={t('Anhänger im Zug')} value={config.trailersInTrain} display={String(config.trailersInTrain)} {...LIMITS.trailersInTrain} onChange={(v) => set('trailersInTrain', v)} />
            </Section>

            <Section title={t('Anmerkungen')}>
              <TextArea id="notes" label={t('Sonstige Anforderungen und Wünsche')} value={config.notes} onChange={(v) => set('notes', v)} />
            </Section>
          </div>

          {notices.length > 0 && (
            <section className="group" aria-label={t('Hinweise')}>
              <h2>{t('Hinweise')}</h2>
              <ul className="notices">
                {notices.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="group">
            <h2>{t('Kennwerte')}</h2>
            <dl className="specs">
              <Spec term={t('Eigengewicht')} value={approx(kg(bom.totalKg))} />
              <Spec term={t('Gesamtgewicht')} value={approx(kg(perf.grossKg))} />
              <Spec term={t('Fahrwerk')} value={`${config.axles} × ${t(derived.axleType === 'pendel' ? 'Pendelachse' : 'Starrachse')}`} />
              <Spec term={t('Bereifung')} value={`${derived.wheelCount} × ${t(optionName('tyre', config.tyre))} Ø ${mm(derived.wheelDiameterMm)}`} />
              <Spec term={t('Radlast')} value={approx(kg(perf.wheelLoadKg))} />
              <Spec term={t('Zugkraftbedarf')} value={approx(`${nf(perf.pullN)} N`)} />
              <Spec term={t('Rahmenhöhe')} value={mm(derived.frameHeightMm)} />
              <Spec term={t('Gesamthöhe')} value={mm(Math.round(description.height * 100) * 10)} />
              {description.bed && (
                <Spec term={t('Tiefbett (L × B)')} value={`${mm(Math.round(description.bed.length * 100) * 10)} × ${mm(Math.round(description.bed.width * 100) * 10)}`} />
              )}
              <Spec term={t('Einzelteile')} value={nf(bom.pieceCount)} />
              <Spec term={t('Richtpreis netto')} value={approx(L.eur(quote.netEur))} />
            </dl>
            <p className="footnote">{t('Anschauungsmodell. Kennwerte und Hinweise sind Schätzungen nach Faustregeln und ersetzen keine technische Auslegung.')}</p>
          </section>
        </aside>

        {dialog === 'bom' && <BomDialog bom={bom} summary={summary} fileBase={fileBase} colorHex={color.hex} onClose={closeDialog} />}
        {dialog === 'prompt' && <PromptDialog prompt={imagePrompt()} copied={promptCopied} capture={captureRef.current} fileBase={fileBase} onClose={closeDialog} />}
        {dialog === 'reset' && <ResetDialog savedCount={saved.length} onReset={reset} onClose={closeDialog} />}
        {dialog === 'share' && (
          <ShareDialog url={shareUrl(requested, current?.name ?? linkName, window.location.href)} title={current?.name ?? headline} onClose={closeDialog} />
        )}
        {(dialog === 'saved' || dialog === 'saveAs') && (
          <SavedDialog
            saved={saved}
            currentId={currentId}
            saveAs={dialog === 'saveAs'}
            suggestedName={linkName ?? `${t(optionName('body', config.body))} ${config.payloadT} t, ${nf(config.lengthMm)} × ${nf(config.widthMm)}`}
            onSave={save}
            onLoad={(entry) => {
              setRequested(entry.config);
              setCurrentId(entry.id);
              setLinkName(null);
              setSaveStatus(null);
              setDialog(null);
            }}
            onDelete={(id) => {
              try {
                setSaved(deleteSaved(id));
                if (id === currentId) setCurrentId(null);
              } catch {
                setSaveStatus(msg('Löschen nicht möglich: Der Browser lässt keinen lokalen Speicher zu.'));
              }
            }}
            onImport={(text) => {
              try {
                const result = importSaved(text);
                setSaved(result.list);
                return result.imported === 1 ? msg('1 Konfiguration eingelesen.') : msg('{count} Konfigurationen eingelesen.', { count: result.imported });
              } catch {
                return msg('Die Datei enthält keine Konfigurationen aus diesem Konfigurator.');
              }
            }}
            onNew={() => {
              setRequested(DEFAULT_CONFIG);
              setCurrentId(null);
              setLinkName(null);
              setSaveStatus(null);
              setDialog(null);
            }}
            onClose={closeDialog}
          />
        )}
        {dialog === 'quote' && (
          <QuoteDialog
            name={current && !unsaved ? current.name : null}
            title={`${t('Schwerlastanhänger')} ${t(optionName('body', config.body))}, ${config.payloadT} t`}
            prose={describeProse(config, derived, L)}
            sections={describeConfig(config, derived, description, bom.totalKg, bom.pieceCount, L)}
            quote={quote}
            fileBase={fileBase}
            onClose={closeDialog}
          />
        )}
        {dialog === 'summary' && (
          <SummaryDialog sections={describeConfig(config, derived, description, bom.totalKg, bom.pieceCount, L)} notices={notices} fileBase={fileBase} onClose={closeDialog} />
        )}
      </div>
    </LocaleContext.Provider>
  );
}

function Spec({ term, value }: { term: string; value: string }) {
  return (
    <div className="spec">
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}
