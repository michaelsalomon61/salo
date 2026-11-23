import type { ReactNode } from 'react';
import { useLocale } from '../../i18n/context';
import { COLORS, type TrailerConfig } from '../../trailer/config';
import { PARAMS, formatValue, isRelevant, labelOf, optionsOf, rangeOf, type LayoutItem, type MoreGroup, type ParamKey } from '../../trailer/params';
import { Cards, Chips, Field, More, NumberField, Segmented, Slider, Subhead, Switch, TextArea } from '../controls';
import type { StepProps } from './index';
import { BODY_PICTURES } from './pictures';

/** Bilder für Karten, je Parameter und Option. */
const PICTURES: Partial<Record<ParamKey, Record<string, ReactNode>>> = { body: BODY_PICTURES };

/** Das Bedienelement zu einem Parameter, wie die Parameterliste es beschreibt. */
function ParamField({ name, config, derived, set, note }: StepProps & { name: ParamKey }) {
  const L = useLocale();
  const param = PARAMS[name];
  const label = L.m(labelOf(name, config));
  // Der Typ des Werts folgt aus dem Parameter; die Liste stellt sicher, dass beides zusammenpasst.
  const change = (value: unknown) => set(name, value as TrailerConfig[typeof name]);
  const hint = note(name as Parameters<typeof note>[0]);

  switch (param.control) {
    case 'slider':
      return <Slider id={param.id} label={label} value={config[name] as number} display={formatValue(name, config, L)} {...rangeOf(name, config, derived)} note={param.quiet?.(config) ? undefined : hint} onChange={change} />;
    case 'segmented':
    case 'chips':
    case 'cards': {
      const options = optionsOf(name, L).map((o) => ({ ...o, disabled: param.disabled?.(o.id, config, derived) }));
      const value = config[name] as string | number;
      if (param.control === 'cards') {
        return <Cards id={param.id} label={label} value={String(value)} options={options.map((o) => ({ id: String(o.id), name: o.name, hint: L.m(param.hints![o.id]), picture: PICTURES[name]?.[o.id] }))} onChange={change} />;
      }
      const Choice = param.control === 'chips' ? Chips : Segmented;
      return <Choice id={param.id} label={label} value={value} options={options} note={hint} onChange={change} />;
    }
    case 'switch':
      return <Switch id={param.id} label={label} checked={config[name] as boolean} onChange={change} />;
    case 'number':
      return <NumberField id={param.id} label={label} unit={param.unit} step={param.step} max={param.max} value={config[name] as number | null} onChange={change} />;
    case 'text':
      return <TextArea id={param.id} label={label} value={config[name] as string} placeholder={param.placeholder && L.m(param.placeholder)} onChange={change} />;
    case 'color':
      return (
        <Field label={label} value={formatValue(name, config, L)}>
          <div className="swatches" role="radiogroup" aria-label={label}>
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                id={`${param.id}-${c.id}`}
                role="radio"
                aria-checked={c.id === config[name]}
                aria-label={`${c.ral} ${L.t(c.name)}`}
                title={`${c.ral} ${L.t(c.name)}`}
                className="swatch"
                style={{ background: c.hex }}
                onClick={() => change(c.id)}
              />
            ))}
          </div>
        </Field>
      );
  }
}

/** Die Felder eines Schritts in der Gliederung aus der Parameterliste. */
export function Fields({ items, ...props }: StepProps & { items: LayoutItem[] }) {
  const L = useLocale();
  const { config } = props;
  const field = (name: ParamKey) => isRelevant(name, config) && <ParamField key={name} name={name} {...props} />;
  const grid = (names: ParamKey[]) => (
    <div className="number-grid" key={names.join()}>
      {names.map(field)}
    </div>
  );
  const relevant = (group: MoreGroup) => group.items.some((item) => (typeof item === 'string' ? [item] : item.grid).some((name) => isRelevant(name, config)));

  const out: ReactNode[] = [];
  let groups: ReactNode[] = [];
  // Aufeinanderfolgende aufklappbare Gruppen stehen gemeinsam zwischen zwei Linien.
  const flush = () => {
    if (groups.length) out.push(<div className="sections" key={`sections-${out.length}`}>{groups}</div>);
    groups = [];
  };
  for (const item of items) {
    if (typeof item === 'object' && 'more' in item) {
      const group = item.more;
      if (!relevant(group)) continue;
      const hint = typeof group.hint === 'function' ? group.hint(config) : group.hint;
      groups.push(
        <More key={group.title.text} title={L.m(group.title)} hint={L.m(hint)}>
          {group.items.map((inner) => (typeof inner === 'string' ? field(inner) : grid(inner.grid)))}
        </More>,
      );
      continue;
    }
    flush();
    if (typeof item === 'string') out.push(field(item));
    else if ('subhead' in item) out.push(<Subhead key={item.subhead.text}>{L.m(item.subhead)}</Subhead>);
    else out.push(grid(item.grid));
  }
  flush();
  return <>{out}</>;
}
