# Anhänger-Konfigurator

Machbarkeits-Prototyp: ein Konfigurator für Schwerlastanhänger mit Deichsel. Aus Traglast, Achszahl,
Abmessungen und Ausführung entsteht im Browser ein parametrisches 3D-Modell, das sich frei drehen lässt.

Erfasst werden Grunddaten, Einsatzbedingungen, Last, Fahrwerk (Bereifung, Federung, Bremsen), Ladefläche
(Belag, Kantenschutz, Bordwände, Verzurrösen), Deichsel und Kupplungen, Beleuchtung, Unterlegkeile,
Lackierung und Eckdaten des Zugfahrzeugs. Ausstattung erscheint im Modell, in der Stückliste und im
STEP-Export; Einsatzdaten fließen in Kennwerte und Hinweise ein.

Aus der fertigen Konfiguration lassen sich drei Ergebnisse erzeugen:

- **Zusammenfassung**: alle Angaben, Kennwerte und Hinweise auf einen Blick, speicherbar als CSV.
- **Stückliste**: alle Bauteile mit Menge, Abmessungen, Werkstoff und Gewicht samt Summen, speicherbar als CSV.
- **STEP-Modell**: jedes Bauteil als benannter Körper, Maße in Millimetern, z nach oben. Lenkung gerade,
  Deichsel waagerecht.

Alles läuft im Browser, die Seite braucht keinen Server.

## Starten

```bash
npm install
```

```bash
npm run dev
```

`npm run build` erzeugt die statische Seite in `dist/`, `npm test` prüft das Regelwerk.

## Aufbau

- `src/trailer/config.ts`: Parameter, Auswahllisten, Grenzen und Regelwerk. Aus der gewünschten
  Konfiguration wird eine baubare abgeleitet (Mindestachszahl, Radgröße, Rahmenhöhe, Mindestmaße).
- `src/trailer/advice.ts`: Kennwerte (Gewichte, Radlast, Zugkraftbedarf) und Hinweise auf Unstimmigkeiten.
- `src/trailer/summary.ts`: die Konfiguration als lesbare Liste.
- `src/trailer/parts.ts`: beschreibt jedes Bauteil einmal (Form, Lage, Werkstoff). Modell, Stückliste und
  STEP-Export lesen alle aus dieser Liste und bleiben dadurch deckungsgleich.
- `src/trailer/buildTrailer.ts`: baut daraus das 3D-Modell.
- `src/trailer/bom.ts`: fasst gleiche Bauteile zur Stückliste zusammen.
- `src/cad/`: STEP-Export über einen CAD-Kern (OpenCascade), der erst beim Export geladen wird.
- `src/viewer/`: 3D-Bühne mit Kamera, Licht und Maßlinien (Three.js).
- `src/ui/`, `src/App.tsx`, `src/styles.css`: Oberfläche.

## Hinweis

Das Modell ist ein Anschauungsmodell. Kennwerte, Querschnitte und Gewichte beruhen auf Faustregeln und
ersetzen keine technische Auslegung. Die Stückliste enthält weder Verbindungsmittel noch Preise.
