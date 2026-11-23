import { msg, type Msg } from '../../i18n';
import type { Derived, TrailerConfig } from '../../trailer/config';
import type { AdjustedField } from '../../trailer/rules';

export type StepId = 'task' | 'vehicle' | 'running' | 'body' | 'result';

/** Die Schritte der Konfiguration: von der Aufgabe über das Fahrzeug zum Ergebnis. slug steht in der Adresse. */
export const STEPS: readonly { id: StepId; slug: string; name: Msg; lede: Msg }[] = [
  { id: 'task', slug: 'aufgabe', name: msg('Aufgabe'), lede: msg('Was wird bewegt, und wo?') },
  { id: 'vehicle', slug: 'fahrzeug', name: msg('Fahrzeug'), lede: msg('Bauform und Hauptmaße.') },
  { id: 'running', slug: 'fahrwerk', name: msg('Fahrwerk'), lede: msg('Lenkung, Räder und Bremse.') },
  { id: 'body', slug: 'aufbau', name: msg('Aufbau'), lede: msg('Ladefläche, Deichsel und Ausstattung.') },
  { id: 'result', slug: 'ergebnis', name: msg('Ergebnis'), lede: msg('Kennwerte, Unterlagen und Weitergabe.') },
];

/** Der Schritt, den die Adresse hinter dem #-Zeichen nennt; sonst der erste. */
export function stepFromHash(hash: string): StepId {
  return STEPS.find((s) => hash === `#/${s.slug}`)?.id ?? 'task';
}

export const hashOfStep = (id: StepId) => `#/${STEPS.find((s) => s.id === id)!.slug}`;

/** Was jeder Schritt zum Bearbeiten der Konfiguration braucht. */
export interface StepProps {
  config: TrailerConfig;
  derived: Derived;
  set: <K extends keyof TrailerConfig>(key: K, value: TrailerConfig[K]) => void;
  /** Hinweis des Regelwerks zu einem Feld, in der gewählten Sprache. */
  note: (field: AdjustedField) => string | undefined;
}
