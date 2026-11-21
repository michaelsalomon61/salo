/**
 * Konfiguration als Link.
 *
 * Der Link trägt die Konfiguration selbst in sich, hinter dem #-Zeichen. Es
 * braucht deshalb keinen Server und kein Konto: Wer den Link hat, kann sie
 * öffnen. Enthalten sind nur die Abweichungen vom Standard, damit der Link kurz bleibt.
 */
import { DEFAULT_CONFIG, type TrailerConfig } from '../trailer/config';
import { sanitizeConfig } from './saved';

const PARAM = 'konfig';

export interface SharedConfig {
  config: TrailerConfig;
  /** Name, unter dem der Absender die Konfiguration gespeichert hatte. */
  name: string | null;
}

/** Base64 in der Schreibweise für Adressen, auch für Umlaute und Sonderzeichen. */
function toBase64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
}

/** Der Teil des Links hinter dem #-Zeichen. */
export function encodeShare(config: TrailerConfig, name: string | null): string {
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sanitizeConfig(config))) {
    if (value !== DEFAULT_CONFIG[key as keyof TrailerConfig]) changed[key] = value;
  }
  return `${PARAM}=${toBase64Url(JSON.stringify({ v: 1, n: name ?? undefined, c: changed }))}`;
}

/** Liest eine Konfiguration aus dem Teil hinter dem #-Zeichen; null, wenn dort keine gültige steht. */
export function decodeShare(hash: string): SharedConfig | null {
  const match = new RegExp(`(?:^|[#&])${PARAM}=([A-Za-z0-9_-]+)`).exec(hash);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(match[1]));
    if (!parsed || typeof parsed !== 'object') return null;
    const { n, c } = parsed as { n?: unknown; c?: unknown };
    if (!c || typeof c !== 'object') return null;
    return { config: sanitizeConfig(c), name: typeof n === 'string' && n.trim() ? n.trim().slice(0, 80) : null };
  } catch {
    return null;
  }
}

/** Vollständiger Link auf diese Seite mit der Konfiguration. */
export function shareUrl(config: TrailerConfig, name: string | null, pageUrl: string): string {
  return `${pageUrl.split('#')[0]}#${encodeShare(config, name)}`;
}
