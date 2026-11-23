import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initialLang, locale, msg, rememberLang, type Lang, type Msg } from './i18n';
import { LocaleContext } from './i18n/context';
import { clearSaved, deleteSaved, importSaved, listSaved, loadDraft, saveConfig, saveDraft, type SavedConfig } from './storage/saved';
import { decodeShare, shareUrl } from './storage/share';
import { advise, performance } from './trailer/advice';
import { buildBom } from './trailer/bom';
import { COLORS, DEFAULT_CONFIG, STEERING, optionName, resolve, type TrailerConfig } from './trailer/config';
import { trailerParts } from './trailer/parts';
import { estimateQuote } from './trailer/pricing';
import { buildImagePrompt } from './trailer/prompt';
import { describeConfig, describeProse } from './trailer/summary';
import { BomDialog } from './ui/BomDialog';
import { saveBlob } from './ui/download';
import { MailDialog } from './ui/MailDialog';
import { PromptDialog } from './ui/PromptDialog';
import { QuoteDialog } from './ui/QuoteDialog';
import { ResetDialog } from './ui/ResetDialog';
import { SavedDialog } from './ui/SavedDialog';
import { ShareDialog } from './ui/ShareDialog';
import { StageTools } from './ui/StageTools';
import { StatusBar } from './ui/StatusBar';
import { STEPS, type StepId, type StepProps } from './ui/steps';
import { BodyStep } from './ui/steps/BodyStep';
import { ResultStep, type ResultAction } from './ui/steps/ResultStep';
import { RunningStep } from './ui/steps/RunningStep';
import { TaskStep } from './ui/steps/TaskStep';
import { VehicleStep } from './ui/steps/VehicleStep';
import { SummaryDialog } from './ui/SummaryDialog';
import { TopBar } from './ui/TopBar';
import type { ViewName } from './viewer/scene';
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
  const [view, setView] = useState<{ name: ViewName; n: number }>({ name: 'iso', n: 0 });
  const [stepId, setStepId] = useState<StepId>('task');
  const [dialog, setDialog] = useState<'summary' | 'bom' | 'saved' | 'saveAs' | 'share' | 'quote' | 'prompt' | 'reset' | 'mail' | null>(null);
  const captureRef = useRef<(() => string | null) | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  /** Zählt Neustarts; damit werden aufgeklappte Gruppen der Bedienung zurückgestellt. */
  const [generation, setGeneration] = useState(0);
  const closeDialog = useCallback(() => setDialog(null), []);
  const [stepExport, setStepExport] = useState<'idle' | 'working' | 'failed'>('idle');

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
  const approx = (value: string) => t('ca. {value}', { value: { raw: value } });

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
    setStepExport('idle');
    setShowDimensions(true);
    setView((v) => ({ name: 'iso', n: v.n + 1 }));
    setStepId('task');
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
    setStepExport('working');
    try {
      const { exportStep } = await import('./cad/exportStep');
      saveBlob(await exportStep(config, derived, L.partName), `${fileBase}.step`);
      setStepExport('idle');
    } catch {
      setStepExport('failed');
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.id === stepId);
  const goTo = (id: StepId) => {
    setStepId(id);
    panelRef.current?.scrollTo({ top: 0 });
  };
  const stepProps: StepProps = { config, derived, set, note };
  const bodyType = L.m({ platform: msg('Plattformanhänger'), lowbed: msg('Tiefladeanhänger'), longload: msg('Langmaterialanhänger') }[config.body]);
  const tonnes = (kilograms: number) => `${nf(Math.round(kilograms / 100) / 10)} t`;
  const specs: [string, string][] = [
    [t('Eigengewicht'), approx(kg(bom.totalKg))],
    [t('Gesamtgewicht'), approx(kg(perf.grossKg))],
    [t('Fahrwerk'), `${config.axles} × ${t(derived.axleType === 'pendel' ? 'Pendelachse' : 'Starrachse')}`],
    [t('Bereifung'), `${derived.wheelCount} × ${t(optionName('tyre', config.tyre))} Ø ${mm(derived.wheelDiameterMm)}`],
    [t('Radlast'), approx(kg(perf.wheelLoadKg))],
    [t('Zugkraftbedarf'), approx(`${nf(perf.pullN)} N`)],
    [t('Rahmenhöhe'), mm(derived.frameHeightMm)],
    [t('Gesamthöhe'), mm(Math.round(description.height * 100) * 10)],
    ...(description.bed ? [[t('Tiefbett (L × B)'), `${mm(Math.round(description.bed.length * 100) * 10)} × ${mm(Math.round(description.bed.width * 100) * 10)}`] as [string, string]] : []),
    [t('Einzelteile'), nf(bom.pieceCount)],
    [t('Richtpreis netto'), approx(L.eur(quote.netEur))],
  ];
  const onResult = (action: ResultAction) => {
    if (action === 'step') void saveStep();
    else if (action === 'prompt') void openPrompt();
    else setDialog(action);
  };

  return (
    <LocaleContext.Provider value={L}>
      <div className="app">
        <TopBar
          step={stepId}
          onStep={goTo}
          name={current ? current.name : t('Nicht gespeichert')}
          status={saveStatus ? L.m(saveStatus) : current && !unsaved ? t('Gespeichert') : ''}
          canSave={!current || unsaved}
          savedCount={saved.length}
          lang={lang}
          onLang={setLang}
          onSave={quickSave}
          onSaveAs={() => setDialog('saveAs')}
          onOpenSaved={() => setDialog('saved')}
          onReset={() => setDialog('reset')}
          onShare={() => setDialog('share')}
        />

        <main className="work">
          <section className="stage" aria-label={t('3D-Ansicht')}>
            <Viewer config={config} derived={derived} showDimensions={showDimensions} view={view} captureRef={captureRef} />
            <div className="stage-head">
              <h1>{t('{payload} t {type}', { payload: config.payloadT, type: { raw: bodyType } })}</h1>
              <p>
                {mm(config.lengthMm)} × {mm(config.widthMm)} · {config.axles} × {t(derived.axleType === 'pendel' ? 'Pendelachse' : 'Starrachse')} · {derived.wheelCount} × {t(optionName('tyre', config.tyre))}
              </p>
            </div>
            <p className="stage-hint">{t('Ziehen dreht das Modell, Scrollen oder Spreizen zoomt.')}</p>
            <StageTools
              showDimensions={showDimensions}
              onDimensions={setShowDimensions}
              showLoad={config.loadType === 'custom' ? null : config.showLoad}
              onLoad={(v) => set('showLoad', v)}
              onView={(name) => setView((v) => ({ name, n: v.n + 1 }))}
              steeringDeg={config.steeringDeg}
              maxSteeringDeg={STEERING[config.steering].maxDeg}
              onSteering={(v) => set('steeringDeg', v)}
              drawbarUp={config.drawbarUp}
              onDrawbarUp={(v) => set('drawbarUp', v)}
            />
          </section>

          <aside className="panel" aria-label={t('Konfiguration')} ref={panelRef}>
            <header className="panel-head">
              <p className="eyebrow">{t('Schritt {n} von {count}', { n: stepIndex + 1, count: STEPS.length })}</p>
              <h2>{L.m(STEPS[stepIndex].name)}</h2>
              <p className="lede">{L.m(STEPS[stepIndex].lede)}</p>
            </header>
            <div className="step" key={`${stepId}-${generation}`}>
              {stepId === 'task' && <TaskStep {...stepProps} />}
              {stepId === 'vehicle' && <VehicleStep {...stepProps} />}
              {stepId === 'running' && <RunningStep {...stepProps} />}
              {stepId === 'body' && <BodyStep {...stepProps} />}
              {stepId === 'result' && <ResultStep notices={notices} specs={specs} stepState={stepExport} onAction={onResult} />}
            </div>
          </aside>
        </main>

        <StatusBar
          figures={[
            { term: t('Eigengewicht'), value: approx(kg(Math.round(bom.totalKg / 10) * 10)) },
            { term: t('Gesamtgewicht'), value: tonnes(perf.grossKg) },
            { term: t('Radlast'), value: tonnes(perf.wheelLoadKg), extra: t('von {value}', { value: { raw: tonnes(derived.wheelCapacityKg) } }) },
            { term: t('Zugkraftbedarf'), value: `${nf(Math.round(perf.pullN / 100) / 10)} kN` },
          ]}
          adjusted={[...new Set(Object.values(adjustments).map(L.m))]}
          notices={notices}
          price={approx(L.eur(quote.netEur))}
          brief={`${t('Eigengewicht')} ${approx(kg(Math.round(bom.totalKg / 10) * 10))}`}
          back={stepIndex > 0 ? () => goTo(STEPS[stepIndex - 1].id) : null}
          next={stepIndex < STEPS.length - 1 ? { name: L.m(STEPS[stepIndex + 1].name), go: () => goTo(STEPS[stepIndex + 1].id) } : null}
        />

        {dialog === 'bom' && <BomDialog bom={bom} summary={summary} fileBase={fileBase} colorHex={color.hex} onClose={closeDialog} />}
        {dialog === 'prompt' && <PromptDialog prompt={imagePrompt()} copied={promptCopied} capture={captureRef.current} fileBase={fileBase} onClose={closeDialog} />}
        {dialog === 'mail' && (
          <MailDialog
            createStep={async () => (await import('./cad/exportStep')).exportStep(config, derived, L.partName)}
            fileBase={fileBase}
            subject={`${t('STEP-Modell')}: ${current?.name ?? headline}`}
            body={[
              t('Im Anhang das STEP-Modell des konfigurierten Anhängers.'),
              describeProse(config, derived, L),
              t('Maße in Millimetern, z nach oben. Jedes Bauteil ist ein benannter Körper.'),
              `${t('Konfiguration online öffnen')}:\n${shareUrl(requested, current?.name ?? linkName, window.location.href)}`,
            ].join('\n\n')}
            onClose={closeDialog}
          />
        )}
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

