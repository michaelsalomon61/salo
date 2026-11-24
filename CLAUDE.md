# Anhänger-Konfigurator: Hinweise für Claude Code

Web-Konfigurator für Schwerlastanhänger mit Deichsel: Parameter eingeben, parametrisches 3D-Modell ansehen,
Angebot, Stückliste, STEP-Modell und weitere Ausgaben erzeugen. Statische Seite ohne Server (Vite, React,
TypeScript, three.js; STEP über replicad/OpenCascade). Überblick für Menschen: `README.md`, Stand und offene
Punkte: `UEBERGABE.md`.

## Befehle

```bash
npm ci
```

```bash
npm run dev
```

```bash
npx tsc --noEmit
```

```bash
npm test
```

```bash
npm run build && node scripts/check-browser.cjs
```

- In Cloud-Sitzungen installiert der Startschritt `.claude/hooks/session-start.sh` die Abhängigkeiten von selbst
  (eingetragen in `.claude/settings.json`); er läuft nur dort und nur, wenn sich `package.json` oder
  `package-lock.json` geändert haben. Lokal genügt `npm ci`.
- Einen Linter gibt es nicht; `npx tsc --noEmit` ist die statische Prüfung.
- `npm test` dauert rund eine Minute; fast alles davon ist `src/cad/connectivity.test.ts`, das den CAD-Kern lädt.
  Während der Arbeit einzelne Dateien laufen lassen, z. B. `npx vitest run src/trailer src/i18n`.
- `scripts/check-browser.cjs` prüft die gebaute Seite im Browser (rund 70 Prüfungen, drei Fensterbreiten).
  `--quick` lässt den STEP-Export aus. Es braucht Playwright; in Cloud-Sitzungen ist es vorinstalliert, im
  Projekt ist es bewusst keine Abhängigkeit.
- Jeder Push auf den Hauptzweig veröffentlicht nach Tests und Build auf GitHub Pages
  (`.github/workflows/pages.yml`). Die veröffentlichte Seite ist aus einer Cloud-Sitzung meist nicht
  erreichbar; den Erfolg zeigt der Workflow-Lauf.

## Aufbau in einem Satz je Baustein

- `src/data/*.json`: Stammdaten. `rules.json` Grenzwerte und Kennzahlen, `prices.json` Sätze und Stückpreise.
  Einträge `hinweis` sind Erläuterungen und werden in `src/data/index.ts` entfernt.
- `src/trailer/config.ts`: `TrailerConfig`, `DEFAULT_CONFIG`, Auswahllisten `OPTIONS`, Auslegung
  (`computeDerived`: Radgröße, Rahmenhöhe, Mindestmaße).
- `src/trailer/rules.ts`: Regelwerk als Liste benannter Regeln; `resolve(gewünscht)` liefert die baubare
  Konfiguration, abgeleitete Werte, Hinweise je Feld und die Namen der Regeln, die eingegriffen haben.
- `src/trailer/advice.ts`: Kennwerte (`performance`) und Hinweise als Liste benannter Prüfungen.
- `src/trailer/params.ts`: die Parameterliste. Beschriftung, Bedienelement, Einheit, Bereich, Bedingung und die
  Gliederung der Schritte (`PANEL_LAYOUT`). Die Bedienung (`src/ui/steps/Fields.tsx`) und die Zusammenfassung
  (`SUMMARY_LAYOUT` in `summary.ts`) entstehen daraus.
- `src/trailer/parts.ts`: **eine** Liste aller Bauteile (Form, Lage, Werkstoff, Gelenke). 3D-Modell
  (`buildTrailer.ts`), Stückliste (`bom.ts`), STEP (`src/cad/step.ts`), Preis (`pricing.ts`) und Bauteilbilder
  lesen alle daraus. Nichts davon bekommt eigene Geometrie.
- `src/viewer/scene.ts`: 3D-Bühne (Kamera, Licht, Maßlinien, Ansichten, `capture`, `snapshot`).
- `src/ui/`: `TopBar`, `StageTools`, `StatusBar`, `steps/`, `result/` (Ergebnisseite mit Reitern), Dialoge.
  `src/App.tsx` hält den Zustand und verdrahtet alles.
- `src/i18n/`: Sprachen. `src/storage/`: gespeicherte Konfigurationen und Teilen-Link. `src/mail/eml.ts`:
  E-Mail-Entwurf mit Anhang.

## Regeln, die hier gelten

- **Gewünscht und baubar trennen.** Der Zustand hält die Eingaben (`requested`); `resolve` leitet daraus die
  wirksame Konfiguration ab. Nie die korrigierten Werte zurück in die Eingaben schreiben, sonst geht ein
  angehobener Wert nicht mehr zurück, wenn die Ursache entfällt.
- **Texte:** Deutsche Ausgangstexte sind zugleich die Übersetzungsschlüssel. Jeder Text, der an `t(…)`, `L.t(…)`,
  `msg(…)` oder `setMessage(…)` geht, braucht einen Eintrag mit Englisch und Slowakisch in
  `src/i18n/translations.ts`; `src/i18n/i18n.test.ts` sucht die Texte im Quelltext und schlägt sonst fehl.
  Texte in Datenlisten als `msg('…')` schreiben, damit die Suche sie findet. Platzhalter `{name}` müssen in
  allen Sprachen gleich heißen. Zahlen über `L.mm`, `L.kg`, `L.eur`, `L.nf` schreiben.
- **Neuer Parameter:** Typ und Ausgangswert in `config.ts`, Eintrag in `PARAMS` samt Platz in `PANEL_LAYOUT`
  und `SUMMARY_LAYOUT`, Übersetzungen, Wirkung im Modell (`parts.ts`). `params.test.ts` meldet, wenn er in
  Bedienung oder Zusammenfassung fehlt.
- **Neues Bauteil:** nur in `parts.ts`, mit Gruppe, Werkstoff und Dichte oder Masse. Es muss ein anderes Teil
  berühren: `connectivity.test.ts` baut rund 30 Konfigurationen als Körper auf und lässt kein schwebendes
  Teil durch. Zukaufteile bekommen einen Stückpreis in `prices.json`, sonst wird nach Gewicht gerechnet.
- **Neue Regel:** ein Eintrag in `RULES` bzw. `ADVICE_RULES` mit eindeutigem Namen; Schwellen gehören nach
  `rules.json`, nicht in den Code.
- **Gestaltung:** ruhig und schlicht im Stil von Apple. Farben, Radien und Schatten nur über die Variablen am
  Anfang von `src/styles.css`; sie tragen auch den Dunkelmodus. Kennungen (`id`) der Bedienelemente stabil
  halten, das Prüfskript verwendet sie.
- Kommentare im Code auf Deutsch, Commit-Nachrichten auf Englisch und beschreibend. Keine neue Abhängigkeit
  ohne Not; die Seite bleibt ohne Server lauffähig.

## Arbeitsweise, die sich bewährt hat

- Reihenfolge vor jedem Commit: `npx tsc --noEmit`, betroffene Tests, `npm run build`, dann
  `node scripts/check-browser.cjs`. Bei sichtbaren Änderungen zusätzlich Bildschirmfotos in 1440, 1100 und
  390 px Breite ansehen; Layoutfehler zeigen sich fast nur dort.
- **Umbauten ohne Verhaltensänderung** vorher absichern: für einige hundert Konfigurationen (alle Optionen mal
  drei Bauformen, dazu zufällige mit festem Startwert, auch außerhalb der Grenzen) die Ergebnisse von
  `resolve`, `advise`, `describeConfig`, `estimateQuote` und `buildImagePrompt` in eine Datei schreiben und nach
  dem Umbau vergleichen. So entstand `rules.ts`/`params.ts` aus dem früheren Stand, ohne dass sich eine
  Ausgabe änderte.
- WebGL läuft in Playwright nur mit `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
  Nach Eingaben kurz warten (300 bis 900 ms), sonst liest man den alten Stand.

## Fallstricke

- **`DEFAULT_CONFIG` ändern verändert alte Teilen-Links.** Ein Link enthält nur die Abweichungen von den
  Ausgangswerten (`src/storage/share.ts`). Gespeicherte Konfigurationen sind vollständig und nicht betroffen.
  Beim Entfernen oder Umbenennen von Optionen füllt `sanitizeConfig` mit dem Ausgangswert auf.
- **Die 3D-Bühne darf nicht neu aufgebaut werden.** `<section class="stage">` bleibt in allen Schritten an
  derselben Stelle im Baum; die Ergebnisseite rückt sie nur per CSS in die linke Spalte (`.lead` mit
  `display: contents`). Wer die Struktur in `App.tsx` umstellt, verliert sonst Kamera und WebGL-Kontext.
- **Felder an Schaltflächen** (`Popover`) sind `position: fixed` und werden per Skript platziert. Ein Vorfahr
  mit `transform` würde sie verschieben; deshalb ist die Werkzeugleiste ohne `transform` zentriert.
- `input[type='range']` setzt global `width: 100%`. Abweichende Breiten brauchen denselben Selektor
  (`.tool-slider input[type='range']`).
- `snapshot()` und `capture()` der Bühne rendern selbst und stellen danach Größe und Kamera wieder her; nach
  Änderungen dort prüfen, dass die Bühne beim Zurückwechseln scharf und unverändert ist.
- Druck: Gedruckt wird nur der Inhalt von `.result-content` (Regeln unter `@media print`). Das Angebot ist auf
  zwei A4-Seiten ausgelegt.
- Der STEP-Export lädt rund 23 MB CAD-Kern erst beim ersten Aufruf und blockiert dabei kurz die Seite.

## Entscheidungen, die bewusst so sind

- Kein fotorealistisches Rendering in der Seite; es war eingebaut und wurde auf Wunsch wieder entfernt. An
  seiner Stelle gibt es den KI-Bildprompt.
- Keine Kunden- und Adressdaten, kein Konto, kein Server. E-Mail gibt es deshalb nur als Entwurfsdatei (`.eml`).
- Holzbeläge liegen quer zur Fahrtrichtung.
- Stellung des Modells (Lenkeinschlag, Deichsel hoch, Ladung zeigen) ist Darstellung und liegt an der
  3D-Ansicht, nicht in den Schritten. Die Werte stehen noch in `TrailerConfig` und werden mitgespeichert.
- Preise, Regeln und Grenzwerte sind Annahmen des Prototyps, keine geprüften Fachwerte.
