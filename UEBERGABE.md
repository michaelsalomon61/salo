# Übergabe

Stand: 24. November 2026. Diese Notiz richtet sich an die Person, die das Projekt übernimmt. Was der
Konfigurator kann und wie er aufgebaut ist, steht in der `README.md`; Arbeitshinweise für Claude Code stehen in
der `CLAUDE.md`.

## Was übergeben wird

Ein Machbarkeits-Prototyp: ein Konfigurator für Schwerlastanhänger mit Deichsel als statische Webseite. Es
gibt keinen Server, keine Datenbank, keine Zugangsdaten und keine Schlüssel. Alles, was dazugehört, liegt in
diesem Repository.

- Bedienung in fünf Schritten, 3D-Modell, drei Sprachen (Deutsch, Englisch, Slowakisch).
- Ausgaben: Angebot mit Bild und Richtpreis, Stückliste mit Bauteilbildern, technische Daten, STEP-Modell,
  E-Mail-Entwurf mit STEP im Anhang, Teilen-Link, KI-Bildprompt.
- Konfigurationen werden im Browser gespeichert und lassen sich als Datei sichern und einlesen.

## Erste Schritte

Benötigt wird Node.js ab Version 22.

```bash
npm ci
```

```bash
npm test
```

```bash
npm run dev
```

Ein frischer Klon von GitHub wurde am Stand dieser Notiz geprüft: Installation, alle 116 Tests und der Build
laufen durch. Zusätzlich prüft `node scripts/check-browser.cjs` die gebaute Seite im Browser (70 Prüfungen).

## Veröffentlichung

Jeder Push auf den Hauptzweig baut die Seite und veröffentlicht sie über GitHub Pages
(`.github/workflows/pages.yml`); schlägt ein Test fehl, wird nicht veröffentlicht. Nach der Übernahme:

1. Unter **Settings → Pages** prüfen, dass als Quelle „GitHub Actions" eingestellt ist.
2. Einmal pushen oder den Workflow von Hand starten und den Lauf abwarten.
3. Die Seite liegt dann unter `https://<kontoname>.github.io/<repository>/`.

Mit dem Besitzer ändert sich die Adresse der Seite. Bereits versendete Teilen-Links zeigen auf die alte
Adresse und müssen neu erzeugt werden. Gespeicherte Konfigurationen liegen im Browser und hängen an der
Adresse; sie wandern nur über „Gespeicherte Konfigurationen → als Datei sichern" und das Einlesen auf der neuen
Seite mit.

## Wo man was ändert

| Anliegen | Stelle |
| --- | --- |
| Preise, Stundensätze, Aufschläge | `src/data/prices.json` |
| Einstellbereiche, Achslasten, Bereifung, Radgrößen, Schwellen der Hinweise | `src/data/rules.json` |
| Texte und Übersetzungen | `src/i18n/translations.ts` |
| Neuer Parameter | `src/trailer/config.ts`, `src/trailer/params.ts`, Übersetzungen, `src/trailer/parts.ts` |
| Neues oder geändertes Bauteil | `src/trailer/parts.ts` |
| Regeln und Hinweise | `src/trailer/rules.ts`, `src/trailer/advice.ts` |
| Aussehen | `src/styles.css` |

Nach jeder Änderung `npm test` laufen lassen. Die Tests prüfen unter anderem, dass keine Übersetzung fehlt, dass
die Datendateien vollständig sind und dass im Modell kein Bauteil in der Luft hängt.

## Was nicht geprüft oder nur angenommen ist

Das Projekt ist ein Anschauungsmodell. Diese Punkte sollte man kennen, bevor man sich auf Ergebnisse verlässt:

- **Preise** sind Schätzwerte ohne Marktbezug. Der Richtpreis zeigt die Rechenweise, keinen belastbaren Betrag.
- **Regeln, Grenzwerte und Gewichte** beruhen auf Faustregeln, nicht auf einer technischen Auslegung oder einer
  Norm. Die Hinweise zur StVZO sind allgemeine Merkpunkte und keine rechtliche Prüfung.
- **Slowakisch und Englisch** wurden maschinell übersetzt und von niemandem mit der jeweiligen Muttersprache
  gegengelesen. Das betrifft vor allem die slowakischen Fachbegriffe.
- **STEP-Modell:** mit einem zweiten CAD-Kern geprüft (Körper gültig, Maße, Benennungen), aber nie in einem
  kommerziellen CAD-System geöffnet.
- **E-Mail-Entwurf:** die Datei ist formal geprüft, wurde aber in keinem echten Mailprogramm geöffnet. Wie
  Outlook, Apple Mail und Thunderbird sie anzeigen, ist offen. Der Weg über das Teilen-Menü am Telefon ist
  ungetestet.
- **KI-Bildprompt:** der Text ist geprüft, das Ergebnis in einem Bildgenerator nicht.
- **Browser:** geprüft wurde in Chromium unter Linux. Safari, Firefox und echte Telefone sind ungetestet.
- **Bildzeichen** auf den Karten für Bauform, Lenkung und Bereifung sind Schemata und fachlich nicht abgenommen.
- Im Modell bewegen sich Spur- und Schubstangen beim Lenken nicht mit.

## Offene Punkte

- Der STEP-Export läuft im Vordergrund; die Seite stockt dabei kurz. Abhilfe wäre ein Hintergrundprozess.
- Die Übersetzungen verwenden die deutschen Texte als Schlüssel. Ändert man einen deutschen Text, muss der
  Schlüssel in `translations.ts` mitgeändert werden; ein Test meldet es.
- Lenkeinschlag, „Deichsel hoch" und „Ladung zeigen" gehören zur Darstellung, werden aber noch mit der
  Konfiguration gespeichert und geteilt.
- Echtes Versenden von E-Mails oder ein gemeinsamer Ablageort für Konfigurationen bräuchten einen Server.
- Das Hauptpaket der Seite ist rund 1 MB groß (gepackt rund 280 kB); der CAD-Kern mit rund 23 MB wird erst beim
  STEP-Export geladen.

## Rechtliches

- Das Repository enthält **keine Lizenzdatei**. Welche Rechte mit der Übergabe übergehen, sollten bisheriger
  und neuer Besitzer ausdrücklich vereinbaren.
- Verwendete Bibliotheken: React, three.js, replicad, Vite und Vitest (MIT), TypeScript (Apache 2.0) sowie
  `replicad-opencascadejs`, der CAD-Kern OpenCascade als WebAssembly unter **LGPL 2.1**. Er wird als eigene
  Dateien neben dem übrigen Code ausgeliefert. Vor einer kommerziellen Nutzung sollte jemand die Pflichten aus
  dieser Lizenz prüfen.
- Die Seite erhebt keine Daten und setzt keine Cookies. Gespeicherte Konfigurationen bleiben im Browser des
  Nutzers. Ein Teilen-Link enthält die Konfiguration selbst, auch den Text unter „Anmerkungen".

## Entstehung

Das Projekt wurde im Dialog mit Claude Code entwickelt; der Verlauf mit beschreibenden Commit-Nachrichten
erklärt jede Änderung. Wer mit Claude Code weiterarbeitet, findet in der `CLAUDE.md` Befehle, Aufbau, Regeln,
bewährte Arbeitsweise und bekannte Fallstricke, sodass eine neue Sitzung ohne Vorwissen einsteigen kann.
In Cloud-Sitzungen von Claude Code (claude.ai/code) installiert ein Startschritt die Abhängigkeiten zu Beginn
jeder Sitzung von selbst (`.claude/hooks/session-start.sh`); lokal bleibt er ohne Wirkung.
