/**
 * E-Mail-Entwurf als .eml-Datei: eine fertige Nachricht mit Anhang, die das
 * Mailprogramm beim Öffnen als Entwurf zeigt. Eine Webseite kann einem
 * Mailprogramm sonst keinen Anhang mitgeben.
 */

export interface DraftAttachment {
  name: string;
  bytes: Uint8Array;
  /** MIME-Typ, etwa model/step. */
  type: string;
}

export interface Draft {
  /** Empfänger; leer lassen, wenn er erst im Mailprogramm eingetragen wird. */
  to: string[];
  subject: string;
  body: string;
  attachment: DraftAttachment;
}

const ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/**
 * Zerlegt die Eingabe in einzelne Adressen (getrennt durch Komma, Semikolon oder
 * Leerraum). Liefert null, wenn eine davon keine gültige Adresse ist.
 */
export function parseRecipients(input: string): string[] | null {
  const parts = input.split(/[\s,;]+/).filter(Boolean);
  return parts.every((p) => ADDRESS.test(p)) ? parts : null;
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Base64 in Zeilen zu 76 Zeichen, wie es für Nachrichten vorgeschrieben ist. */
function base64Lines(bytes: Uint8Array): string {
  const lines: string[] = [];
  // 57 Bytes ergeben genau eine Zeile; in größeren Blöcken kodieren, damit es schnell bleibt.
  const block = 57 * 512;
  for (let i = 0; i < bytes.length; i += block) lines.push(...(base64(bytes.subarray(i, i + block)).match(/.{1,76}/g) ?? []));
  return lines.join('\r\n');
}

/** Kopfzeilenwert mit Umlauten und Sonderzeichen (RFC 2047), auf mehrere Zeilen verteilt. */
function encodeHeader(text: string): string {
  const clean = text.replace(/[\r\n]+/g, ' ').trim();
  if (/^[\x20-\x7e]*$/.test(clean) && clean.length <= 60) return clean;
  const encoder = new TextEncoder();
  const words: string[] = [];
  let chunk = '';
  for (const char of clean) {
    // 39 Bytes ergeben 52 Zeichen Base64; mit Rahmen und „Subject: “ bleibt die Zeile unter 76 Zeichen.
    if (encoder.encode(chunk + char).length > 39) {
      words.push(chunk);
      chunk = '';
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${base64(encoder.encode(w))}?=`).join('\r\n ');
}

/** Dateiname für die Kopfzeilen: nur unkritische Zeichen. */
function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '-');
}

export function buildEml({ to, subject, body, attachment }: Draft): Blob {
  if (!to.every((a) => ADDRESS.test(a))) throw new Error('Ungültige Empfängeradresse');
  const boundary = `=_konfigurator_${attachment.bytes.length.toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  const name = safeName(attachment.name);
  const type = /^[a-z]+\/[a-z0-9.+-]+$/i.test(attachment.type) ? attachment.type : 'application/octet-stream';
  const head = [
    // Kennzeichnet die Nachricht als ungesendet: Das Mailprogramm öffnet sie zum Bearbeiten und Senden.
    'X-Unsent: 1',
    'X-Uniform-Type-Identifier: com.apple.mail-draft',
    ...(to.length ? [`To: ${to.join(',\r\n ')}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(new TextEncoder().encode(body.replace(/\r?\n/g, '\r\n'))),
    '',
    `--${boundary}`,
    `Content-Type: ${type}; name="${name}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${name}"`,
    '',
    '',
  ].join('\r\n');
  return new Blob([head, base64Lines(attachment.bytes), `\r\n--${boundary}--\r\n`], { type: 'message/rfc822' });
}
