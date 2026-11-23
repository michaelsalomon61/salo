import { Fragment, useEffect, useState } from 'react';
import { useLocale } from '../../i18n/context';
import type { Bom } from '../../trailer/bom';
import type { Part } from '../../trailer/parts';
import { renderPartThumbnails } from '../../viewer/thumbnails';

interface Props {
  bom: Bom;
  /** Lackfarbe des Anhängers, damit die Vorschaubilder dazu passen. */
  colorHex: string;
}

/**
 * Bauteil für das Vorschaubild: sehr lange Profile und Stangen werden gekürzt,
 * damit der Querschnitt in dem kleinen Bild erkennbar bleibt.
 */
function forThumbnail(part: Part): Part {
  if (part.kind === 'box') {
    const [longest, middle] = [...part.size].sort((a, b) => b - a);
    const limit = Math.max(middle * 5, 0.2);
    if (longest > limit) return { ...part, rotY: 0, size: part.size.map((s) => (s === longest ? limit : s)) as Part['pos'] };
    return { ...part, rotY: 0 };
  }
  if (part.kind === 'cylinder' && part.length > part.radius * 12) return { ...part, length: part.radius * 12 };
  return part;
}

/** Stückliste mit Vorschaubild, Menge, Abmessungen, Werkstoff und Gewicht je Position. */
export function BomView({ bom, colorHex }: Props) {
  const L = useLocale();
  const { t, nf } = L;
  const kg = (v: number) => nf(Math.round(v * 10) / 10);

  // Die Vorschaubilder entstehen nach dem Anzeigen, damit die Liste sofort da ist.
  const [thumbnails, setThumbnails] = useState<string[] | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setThumbnails(renderPartThumbnails(bom.rows.map((r) => forThumbnail(r.part)), colorHex));
      } catch {
        // Ohne WebGL bleibt die Liste ohne Bilder.
        setThumbnails(null);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [bom, colorHex]);

  return (
    <>
    <dl className="totals">
      <div>
        <dt>{t('Einzelteile')}</dt>
        <dd>{nf(bom.pieceCount)}</dd>
      </div>
      <div>
        <dt>{t('Positionen')}</dt>
        <dd>{nf(bom.rows.length)}</dd>
      </div>
      <div>
        <dt>{t('Gesamtgewicht')}</dt>
        <dd>{nf(bom.totalKg)} kg</dd>
      </div>
    </dl>

    <div className="table-scroll">
      <table className="bom">
        <thead>
          <tr>
            <th className="num">{t('Pos.')}</th>
            <th className="thumb-cell">{t('Bild')}</th>
            <th>{t('Benennung')}</th>
            <th className="num">{t('Menge')}</th>
            <th>{t('Abmessungen (mm)')}</th>
            <th>{t('Werkstoff')}</th>
            <th className="num">{t('Einzelgewicht (kg)')}</th>
            <th className="num">{t('Gesamtgewicht (kg)')}</th>
          </tr>
        </thead>
        <tbody>
          {bom.groups.map((g) => (
            <Fragment key={g.group}>
              <tr className="group-row">
                <th colSpan={3} scope="rowgroup">
                  {t(g.group)}
                </th>
                <td className="num">{nf(g.pieceCount)}</td>
                <td colSpan={3} />
                <td className="num">{kg(g.totalKg)}</td>
              </tr>
              {bom.rows
                .filter((r) => r.group === g.group)
                .map((r) => (
                  <tr key={r.pos}>
                    <td className="num">{r.pos}</td>
                    <td className="thumb-cell">
                      {thumbnails?.[r.pos - 1] ? <img className="thumb" src={thumbnails[r.pos - 1]} alt="" width={64} height={48} /> : <span className="thumb" />}
                    </td>
                    <td>{L.partName(r.name)}</td>
                    <td className="num">{nf(r.quantity)}</td>
                    <td>{r.dimensions}</td>
                    <td>{t(r.material)}</td>
                    <td className="num">{kg(r.unitKg)}</td>
                    <td className="num">{kg(r.totalKg)}</td>
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3} scope="row">
              {t('Summe')}
            </th>
            <td className="num">{nf(bom.pieceCount)}</td>
            <td colSpan={3} />
            <td className="num">{nf(bom.totalKg)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
      <p className="footnote">
        {t('Gewichte aus Abmessungen und Dichte berechnet, Zukaufteile geschätzt. Verbindungsmittel, Schweißnähte und Lackierung sind noch nicht enthalten. In den Bildern sind lange Teile verkürzt dargestellt.')}
      </p>
    </>
  );
}
