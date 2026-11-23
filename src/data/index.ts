/**
 * Stammdaten des Konfigurators: Grenzwerte des Regelwerks und Sätze des
 * Preismodells. Sie stehen als Datendateien neben dem Programmcode und lassen
 * sich dort pflegen. Die Einträge "hinweis" erläutern die Daten für den Leser
 * der Datei und werden hier entfernt.
 */
import priceData from './prices.json';
import ruleData from './rules.json';

function withoutHint<T extends { hinweis?: string }>(entry: T): Omit<T, 'hinweis'> {
  const { hinweis: _, ...data } = entry;
  return data;
}

export const RULE_DATA = {
  limits: withoutHint(ruleData.limits),
  axles: withoutHint(ruleData.axles),
  steering: withoutHint(ruleData.steering),
  tyres: withoutHint(ruleData.tyres),
  wheelSizes: ruleData.wheelSizes.list,
  springHeightMm: withoutHint(ruleData.springHeightMm),
  deckKgPerM2: withoutHint(ruleData.deckKgPerM2),
  groundFactor: withoutHint(ruleData.groundFactor),
  advice: withoutHint(ruleData.advice),
};

export const PRICE_DATA = {
  ratePerKg: withoutHint(priceData.ratePerKg),
  parts: withoutHint(priceData.parts),
  wiring: withoutHint(priceData.wiring),
  brakeLines: withoutHint(priceData.brakeLines),
  smallPartsShare: priceData.smallPartsShare,
  paintPerKg: priceData.paintPerKg,
  assembly: withoutHint(priceData.assembly),
  engineering: withoutHint(priceData.engineering),
  overheadShare: priceData.overheadShare,
  vatShare: priceData.vatShare,
  spread: priceData.spread,
};
