# Anhänger-Konfigurator

Machbarkeits-Prototyp: ein Konfigurator für Schwerlastanhänger mit Deichsel. Aus Traglast, Achszahl,
Abmessungen und Ausführung entsteht im Browser ein parametrisches 3D-Modell, das sich frei drehen lässt.

Aus der fertigen Konfiguration lassen sich drei Ergebnisse erzeugen:

- **Rendering**: ein per Path Tracing berechnetes Bild in einer Außenszene, speicherbar als PNG.
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

- `src/trailer/config.ts`: Parameter, Grenzen und Regelwerk. Aus der gewünschten Konfiguration wird eine
  baubare abgeleitet (Mindestachszahl, Radgröße, Rahmenhöhe, Mindestmaße, Gewichte).
- `src/trailer/parts.ts`: beschreibt jedes Bauteil einmal (Form, Lage, Werkstoff). Modell, Rendering,
  Stückliste und STEP-Export lesen alle aus dieser Liste und bleiben dadurch deckungsgleich.
- `src/trailer/buildTrailer.ts`: baut daraus das 3D-Modell.
- `src/trailer/bom.ts`: fasst gleiche Bauteile zur Stückliste zusammen.
- `src/cad/`: STEP-Export über einen CAD-Kern (OpenCascade), der erst beim Export geladen wird.
- `src/render/`: Außenszene (Himmel, Betonfläche, Halle) und Path Tracing.
- `src/viewer/`: 3D-Bühne mit Kamera, Licht und Maßlinien (Three.js).
- `src/ui/`, `src/App.tsx`, `src/styles.css`: Oberfläche.

## Hinweis

Das Modell ist ein Anschauungsmodell. Kennwerte, Querschnitte und Gewichte beruhen auf Faustregeln und
ersetzen keine technische Auslegung. Die Stückliste enthält weder Verbindungsmittel noch Preise.

Das Rendering nutzt die WebGL-Variante von `three-gpu-pathtracer`. Sie ist dort als auslaufend markiert,
deshalb ist die Version fest eingetragen; langfristig steht der Wechsel auf die WebGPU-Variante an.
