import { msg, type Msg } from '../../i18n';
import type { Derived, TrailerConfig } from '../../trailer/config';
import type { AdjustedField } from '../../trailer/rules';

export type StepId = 'task' | 'vehicle' | 'running' | 'body' | 'result';

/** Die Schritte der Konfiguration: von der Aufgabe über das Fahrzeug zum Ergebnis. */
export const STEPS: readonly { id: StepId; name: Msg; lede: Msg }[] = [
  { id: 'task', name: msg('Aufgabe'), lede: msg('Was wird bewegt, und wo?') },
  { id: 'vehicle', name: msg('Fahrzeug'), lede: msg('Bauform und Hauptmaße.') },
  { id: 'running', name: msg('Fahrwerk'), lede: msg('Lenkung, Räder und Bremse.') },
  { id: 'body', name: msg('Aufbau'), lede: msg('Ladefläche, Deichsel und Ausstattung.') },
  { id: 'result', name: msg('Ergebnis'), lede: msg('Kennwerte, Unterlagen und Weitergabe.') },
];

/** Was jeder Schritt zum Bearbeiten der Konfiguration braucht. */
export interface StepProps {
  config: TrailerConfig;
  derived: Derived;
  set: <K extends keyof TrailerConfig>(key: K, value: TrailerConfig[K]) => void;
  /** Hinweis des Regelwerks zu einem Feld, in der gewählten Sprache. */
  note: (field: AdjustedField) => string | undefined;
}
