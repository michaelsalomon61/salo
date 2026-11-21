import { Fragment } from 'react';
import { bomToCsv, type Bom } from '../trailer/bom';
import { Dialog } from './Dialog';
import { saveBlob } from './download';

interface Props {
  bom: Bom;
  summary: string;
  fileBase: string;
  onClose: () => void;
}

const nf = new Intl.NumberFormat('de-DE');
const kg = (v: number) => nf.format(Math.round(v * 10) / 10);

export function BomDialog({ bom, summary, fileBase, onClose }: Props) {
  const saveCsv = () => {
    // Das BOM-Zeichen sorgt dafür, dass Excel die Umlaute richtig liest.
    saveBlob(new Blob(['﻿', bomToCsv(bom)], { type: 'text/csv;charset=utf-8' }), `${fileBase}-stueckliste.csv`);
  };

  return (
    <Dialog title="Stückliste" subtitle={summary} onClose={onClose}>
      <dl className="totals">
        <div>
          <dt>Einzelteile</dt>
          <dd>{nf.format(bom.pieceCount)}</dd>
        </div>
        <div>
          <dt>Positionen</dt>
          <dd>{nf.format(bom.rows.length)}</dd>
        </div>
        <div>
          <dt>Gesamtgewicht</dt>
          <dd>{nf.format(bom.totalKg)} kg</dd>
        </div>
      </dl>

      <div className="table-scroll">
        <table className="bom">
          <thead>
            <tr>
              <th className="num">Pos.</th>
              <th>Benennung</th>
              <th className="num">Menge</th>
              <th>Abmessungen (mm)</th>
              <th>Werkstoff</th>
              <th className="num">Einzelgewicht (kg)</th>
              <th className="num">Gesamtgewicht (kg)</th>
            </tr>
          </thead>
          <tbody>
            {bom.groups.map((g) => (
              <Fragment key={g.group}>
                <tr className="group-row">
                  <th colSpan={2} scope="rowgroup">
                    {g.group}
                  </th>
                  <td className="num">{nf.format(g.pieceCount)}</td>
                  <td colSpan={3} />
                  <td className="num">{kg(g.totalKg)}</td>
                </tr>
                {bom.rows
                  .filter((r) => r.group === g.group)
                  .map((r) => (
                    <tr key={r.pos}>
                      <td className="num">{r.pos}</td>
                      <td>{r.name}</td>
                      <td className="num">{nf.format(r.quantity)}</td>
                      <td>{r.dimensions}</td>
                      <td>{r.material}</td>
                      <td className="num">{kg(r.unitKg)}</td>
                      <td className="num">{kg(r.totalKg)}</td>
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={2} scope="row">
                Summe
              </th>
              <td className="num">{nf.format(bom.pieceCount)}</td>
              <td colSpan={3} />
              <td className="num">{nf.format(bom.totalKg)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="dialog-actions">
        <p className="footnote">
          Gewichte aus Abmessungen und Dichte berechnet, Zukaufteile geschätzt. Verbindungsmittel, Schweißnähte,
          Lackierung und Preise sind noch nicht enthalten.
        </p>
        <button type="button" id="bom-save" className="button primary" onClick={saveCsv}>
          Als CSV speichern
        </button>
      </div>
    </Dialog>
  );
}
