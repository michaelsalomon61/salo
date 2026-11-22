import { describe, expect, it } from 'vitest';
import { buildEml, parseRecipients } from './eml';

const bytesOf = (text: string) => new TextEncoder().encode(text);
const decode = (b64: string) => Uint8Array.from(atob(b64.replace(/\s+/g, '')), (c) => c.charCodeAt(0));

/** Zerlegt die Nachricht in Kopf und Teile, so wie ein Mailprogramm sie liest. */
async function read(blob: Blob) {
  const text = await blob.text();
  const [head] = text.split('\r\n\r\n', 1);
  const boundary = /boundary="([^"]+)"/.exec(head)![1];
  const parts = text
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((part) => {
      const at = part.indexOf('\r\n\r\n');
      return { head: part.slice(0, at).trim(), body: part.slice(at + 4).trimEnd() };
    });
  return { text, head, parts, end: text.endsWith(`--${boundary}--\r\n`) };
}

describe('E-Mail-Entwurf', () => {
  const step = bytesOf('ISO-10303-21;\nHEADER;\n' + 'DATA;\n#1=CARTESIAN_POINT(\'\',(0.,0.,0.));\n'.repeat(4000) + 'END-ISO-10303-21;\n');
  const draft = { to: ['einkauf@example.com'], subject: 'STEP-Modell: Tieflader für Halle 3 – 24 t, grün', body: 'Im Anhang das Modell.\nMaße: 6.000 mm × 2.500 mm, Ø 500 mm.', attachment: { name: 'anhaenger-24t-6000x2500.step', bytes: step, type: 'model/step' } };

  it('enthält Empfänger, Betreff, Text und den Anhang unverändert', async () => {
    const mail = await read(buildEml(draft));
    expect(mail.head).toContain('X-Unsent: 1');
    expect(mail.head).toContain('To: einkauf@example.com');
    expect(mail.head).toContain('MIME-Version: 1.0');
    expect(mail.end).toBe(true);
    expect(mail.parts).toHaveLength(2);

    const subject = [...mail.head.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)].map((m) => new TextDecoder().decode(decode(m[1]))).join('');
    expect(subject).toBe(draft.subject);

    expect(mail.parts[0].head).toContain('text/plain; charset=UTF-8');
    expect(new TextDecoder().decode(decode(mail.parts[0].body))).toBe(draft.body.replace(/\n/g, '\r\n'));

    expect(mail.parts[1].head).toContain('Content-Disposition: attachment; filename="anhaenger-24t-6000x2500.step"');
    expect(mail.parts[1].head).toContain('Content-Type: model/step');
    expect(decode(mail.parts[1].body)).toEqual(step);
  });

  it('hält die Regeln für Nachrichten ein: Zeilenenden und Zeilenlängen', async () => {
    const { text } = await read(buildEml(draft));
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(Math.max(...text.split('\r\n').map((l) => l.length))).toBeLessThanOrEqual(78);
    // Kopfzeilen sind reines ASCII.
    expect(text.split('\r\n\r\n', 1)[0]).toMatch(/^[\x09\x0a\x0d\x20-\x7e]*$/);
  });

  it('lässt den Empfänger weg, wenn keiner angegeben ist', async () => {
    const { head } = await read(buildEml({ ...draft, to: [] }));
    expect(head).not.toMatch(/^To:/m);
  });

  it('schleust über Betreff, Dateiname und Empfänger keine Kopfzeilen ein', async () => {
    const { head, parts } = await read(buildEml({ ...draft, subject: 'Modell\r\nBcc: fremd@example.com', attachment: { ...draft.attachment, name: 'a"\r\nX-Böse: 1.step' } }));
    expect(head).not.toMatch(/^Bcc:/m);
    expect(parts[1].head).not.toMatch(/^X-B/m);
    expect(() => buildEml({ ...draft, to: ['a@example.com\r\nBcc: fremd@example.com'] })).toThrow();
  });

  it('prüft Empfängeradressen', () => {
    expect(parseRecipients('')).toEqual([]);
    expect(parseRecipients(' a@example.com; b.c@firma.example ,d@x.io ')).toEqual(['a@example.com', 'b.c@firma.example', 'd@x.io']);
    expect(parseRecipients('keine-adresse')).toBeNull();
    expect(parseRecipients('a@example')).toBeNull();
    expect(parseRecipients('a@example.com, <b@example.com>')).toBeNull();
  });
});
