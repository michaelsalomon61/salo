# Anhänger-Konfigurator

Machbarkeits-Prototyp: ein Konfigurator für Schwerlastanhänger mit Deichsel. Aus Traglast, Achszahl,
Abmessungen und Ausführung entsteht im Browser ein parametrisches 3D-Modell, das sich frei drehen lässt.

Erfasst werden Grunddaten, Einsatzbedingungen, Last, Fahrwerk (Lenkung, Bereifung, Federung, Bremsen), Ladefläche
(Belag, Kantenschutz, Bordwände, Verzurrösen), Deichsel und Kupplungen, Beleuchtung, Unterlegkeile,
Lackierung und Eckdaten des Zugfahrzeugs. Ausstattung erscheint im Modell, in der Stückliste und im
STEP-Export; Einsatzdaten fließen in Kennwerte und Hinweise ein.

Konfigurationen lassen sich unter einem Namen im Browser speichern, wieder laden, ändern und löschen sowie
als Datei sichern und auf einem anderen Gerät einlesen. Über „Link teilen" entsteht ein Link, der die
Konfiguration selbst enthält: Jeder mit dem Link kann sie öffnen, ohne Konto und ohne Server.

Die Bedienung führt in fünf Schritten von der Aufgabe (Last, Einsatz) über Fahrzeug, Fahrwerk und Aufbau zum
Ergebnis. Die Kopfzeile zeigt die Schritte, den Namen der Konfiguration mit Speicherstand, Teilen und die
Sprache. Eine Fußleiste nennt laufend die Folgen jeder Änderung: Eigengewicht, Gesamtgewicht, Radlast,
Zugkraftbedarf, Richtpreis und die Zahl der Hinweise. Was nur die Darstellung betrifft (Maße, Ladung,
Ansichten, Lenkeinschlag, Deichsel hoch), liegt als Werkzeugleiste an der 3D-Ansicht.

Die Oberfläche gibt es in Deutsch, Englisch und Slowakisch, umschaltbar in der Kopfzeile. Angebot,
Zusammenfassung, Stückliste und die Bauteilnamen im STEP-Modell erscheinen in der gewählten Sprache, Zahlen
in der jeweiligen Landesschreibweise.

Der Schritt „Ergebnis" ist eine eigene Seite: links das Modell mit den wichtigsten Kennwerten, in der Mitte
die Unterlagen als Reiter (Angebot, Stückliste, Technische Daten, Hinweise), rechts die Liste zum Ausgeben
und Weitergeben. Kurze Abläufe wie Speichern, Link teilen oder der E-Mail-Entwurf öffnen sich als kleines
Fenster über der Seite.

Aus der fertigen Konfiguration lassen sich sechs Ergebnisse erzeugen:

- **Angebot**: Beschreibung der Konfiguration mit geschätztem Preis, ohne Adressdaten, druckbar und als PDF
  speicherbar. Die Preise sind Annahmen und stehen in der Datendatei `src/data/prices.json`.
- **Zusammenfassung**: alle Angaben, Kennwerte und Hinweise auf einen Blick, speicherbar als CSV.
- **Stückliste**: alle Bauteile mit kleinem 3D-Bild, Menge, Abmessungen, Werkstoff und Gewicht samt Summen,
  speicherbar als CSV.
- **STEP-Modell**: jedes Bauteil als benannter Körper, Maße in Millimetern, z nach oben. Lenkung gerade,
  Deichsel waagerecht.
- **STEP per E-Mail**: erzeugt einen E-Mail-Entwurf (`.eml`) mit dem STEP-Modell im Anhang, Betreff,
  Kurzbeschreibung und Link zur Konfiguration. Beim Öffnen zeigt das Mailprogramm die Nachricht zum Prüfen
  und Senden. Auf Geräten mit Teilen-Menü lässt sich das Modell auch direkt an die Mail-App übergeben. Die
  Seite selbst versendet nichts.
- **KI-Bildprompt**: ein fertiger Prompt für ChatGPT oder einen anderen Bildgenerator, der die Konfiguration
  genau beschreibt (Maße, Achsen, Räder, Bereifung, Lenkung, Deichsel, Aufbau, Farbe) und ein
  fotorealistisches Bild verlangt. Ein Klick legt ihn in die Zwischenablage; die aktuelle 3D-Ansicht lässt
  sich als Bild speichern und der KI als Vorlage mitgeben. Der Prompt folgt der gewählten Sprache.

**Zurücksetzen** stellt den Zustand wie beim ersten Öffnen her: alle Eingaben, der Name, die Ansicht und die
aufgeklappten Abschnitte. Gespeicherte Konfigurationen bleiben erhalten, außer man lässt sie im selben
Schritt ausdrücklich mitlöschen. Die gewählte Sprache bleibt.

Bauformen: durchgehende Plattform (auf Wunsch mit Dachaufbau als Plane oder Blech, Flach- oder Pultdach,
offen oder seitlich geschlossen), Tieflader (Hinterräder innen oder außen laufend, Auffahrklappe seitlich
oder hinten) und Langmaterial-Anhänger mit ausziehbarem Langrohr (Mindest- und Maximallänge, Raster).

Lenkungsarten: Drehschemel, Doppel-Drehschemel, 2-Rad- und 4-Rad-Achsschenkellenkung sowie Allradlenkung
mit Pendelachsen. Der Lenkeinschlag lässt sich im Modell verstellen; alle gelenkten Räder rollen dabei um
einen gemeinsamen Punkt.

Alles läuft im Browser, die Seite braucht keinen Server.

## Starten

```bash
npm install
```

```bash
npm run dev
```

`npm run build` erzeugt die statische Seite in `dist/`, `npm test` prüft Regelwerk, Stückliste, Preise,
Übersetzungen und den Zusammenhalt des Modells: Für rund 30 Konfigurationen werden alle Bauteile als Körper
aufgebaut, und jedes muss über Berührungen am Rahmen hängen (`src/cad/connectivity.test.ts`).

## Aufbau

- `src/data/`: Stammdaten als Datendateien. `rules.json` enthält Einstellbereiche und Kennzahlen des
  Regelwerks (Achslasten, Bereifung, Radgrößen, Lenkung, Schwellen der Hinweise), `prices.json` die Sätze und
  Stückpreise des Preismodells. Siehe „Stammdaten pflegen".
- `src/trailer/config.ts`: die Konfiguration mit Ausgangswerten und Auswahllisten sowie die Auslegung des
  Fahrwerks (Radgröße, Rahmenhöhe, Mindestmaße).
- `src/trailer/params.ts`: die Parameterliste. Jeder Parameter ist einmal beschrieben (Beschriftung,
  Bedienelement, Einheit, Einstellbereich, Bedingung); Bedienung und Zusammenfassung entstehen daraus.
- `src/trailer/rules.ts`: das Regelwerk als Liste einzelner, benannter Regeln. Aus der gewünschten
  Konfiguration wird eine baubare; jede Regel nennt das Feld, an dem ihr Hinweis erscheint.
- `src/trailer/advice.ts`: Kennwerte (Gewichte, Radlast, Zugkraftbedarf) und die Hinweise auf
  Unstimmigkeiten, ebenfalls als einzelne Regeln.
- `src/trailer/summary.ts`: die Konfiguration als lesbare Liste und als Kurzbeschreibung.
- `src/trailer/pricing.ts`: Preismodell auf Schätzbasis; rechnet mit den Sätzen aus `prices.json`.
- `src/trailer/prompt.ts`: Prompt für einen KI-Bildgenerator aus der aktuellen Konfiguration.
- `src/i18n/`: Sprachumschaltung. Die deutschen Texte im Code sind zugleich die Schlüssel; `translations.ts`
  enthält dazu die englische und slowakische Fassung. Tests prüfen, dass keine Übersetzung fehlt.
- `src/viewer/thumbnails.ts`: kleine 3D-Bilder einzelner Bauteile für die Stückliste.
- `src/storage/saved.ts`: gespeicherte Konfigurationen im lokalen Speicher des Browsers.
- `src/mail/eml.ts`: baut den E-Mail-Entwurf mit Anhang als `.eml`-Datei.
- `src/storage/share.ts`: Konfiguration als Link (Abweichungen vom Standard, kodiert hinter dem #-Zeichen).
- `src/trailer/parts.ts`: beschreibt jedes Bauteil einmal (Form, Lage, Werkstoff). Modell, Stückliste und
  STEP-Export lesen alle aus dieser Liste und bleiben dadurch deckungsgleich.
- `src/trailer/buildTrailer.ts`: baut daraus das 3D-Modell.
- `src/trailer/bom.ts`: fasst gleiche Bauteile zur Stückliste zusammen.
- `src/cad/`: STEP-Export über einen CAD-Kern (OpenCascade), der erst beim Export geladen wird.
- `src/viewer/`: 3D-Bühne mit Kamera, Licht und Maßlinien (Three.js).
- `src/App.tsx`: Zustand und Zusammenspiel; `src/ui/TopBar.tsx`, `StageTools.tsx`, `StatusBar.tsx`: Kopfzeile,
  Werkzeugleiste und Fußleiste; `src/ui/steps/`: die Schritte, deren Felder aus der Parameterliste entstehen; `src/ui/result/`: die
  Ergebnisseite mit ihren Reitern; `src/styles.css`: Gestaltung.

## Stammdaten pflegen

Preise und Grenzwerte lassen sich ändern, ohne den Programmcode anzufassen:

- `src/data/prices.json`: Fertigungspreis je Kilogramm nach Werkstoff, Stückpreise der Zukaufteile, Pauschalen
  für Leitungen, Lackierung, Montage, Konstruktion, Aufschlag, Mehrwertsteuer und Spanne der Schätzung.
- `src/data/rules.json`: Einstellbereiche der Schieberegler, Achslasten, Eigenschaften der Bereifungen,
  lieferbare Radgrößen, Lenkeinschläge und die Schwellen, ab denen Hinweise erscheinen.

Jeder Abschnitt trägt unter „hinweis" eine kurze Erklärung. Nach einer Änderung prüft `npm test`, ob die
Dateien vollständig und schlüssig sind. Ein Push auf den Hauptzweig veröffentlicht den neuen Stand.

Ein neuer Parameter braucht vier Stellen: den Eintrag mit Ausgangswert in `config.ts`, die Beschreibung in
`params.ts` samt Platz in Bedienung und Zusammenfassung, die Übersetzungen und seine Wirkung im Modell
(`parts.ts`). Tests melden, wenn ein Parameter in Bedienung oder Zusammenfassung fehlt.

Jeder Schritt hat eine eigene Adresse (`#/aufgabe` bis `#/ergebnis`); „Zurück" im Browser wechselt zwischen
den Schritten.

## Hinweis

Das Modell ist ein Anschauungsmodell. Kennwerte, Querschnitte und Gewichte beruhen auf Faustregeln und
ersetzen keine technische Auslegung. Die Stückliste enthält weder Verbindungsmittel noch Preise.
