# Anhänger-Konfigurator

Machbarkeits-Prototyp: ein Konfigurator für Schwerlastanhänger mit Deichsel. Aus Traglast, Achszahl,
Abmessungen und Ausführung entsteht im Browser ein parametrisches 3D-Modell, das sich frei drehen lässt.

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
- `src/trailer/buildTrailer.ts`: baut das 3D-Modell aus Bauteilen (Ladefläche, Rahmen, Achsen, Räder,
  Drehschemel, Deichsel).
- `src/viewer/`: 3D-Bühne mit Kamera, Licht und Maßlinien (Three.js).
- `src/App.tsx`, `src/styles.css`: Oberfläche.

## Hinweis

Das Modell ist ein Anschauungsmodell. Die Kennwerte beruhen auf Faustregeln und ersetzen keine technische
Auslegung.
