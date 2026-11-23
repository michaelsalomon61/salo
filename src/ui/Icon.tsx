/** Kleine Liniensymbole im Stil der Oberfläche. */
const PATHS = {
  down: 'M4.5 6.5 9 11l4.5-4.5',
  right: 'M6.5 4.5 11 9l-4.5 4.5',
  share: 'M9 11V2.5M5.8 5.2 9 2.3l3.2 2.9M4 8.5v5.6c0 .5.4.9.9.9h8.2c.5 0 .9-.4.9-.9V8.5',
  check: 'M4 9.5 7.5 13 14 5.5',
  doc: 'M5 2.5h5.5L14 6v9.5H5zM10.5 2.5V6H14M7.5 9.5h4M7.5 12h4',
  list: 'M6.5 5h8M6.5 9h8M6.5 13h8M3.5 5h.01M3.5 9h.01M3.5 13h.01',
  table: 'M3.5 3.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM2.5 7.5h13M2.5 11h13M7 7.5v7',
  cube: 'M9 2 15 5.2v7.6L9 16l-6-3.2V5.2zM3 5.2 9 8.4l6-3.2M9 8.4V16',
  mail: 'M4 4h10a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 14 14H4a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 4 4zM3 5.5l6 4.5 6-4.5',
  link: 'M7.5 10.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.8.8M10.5 7.5a3 3 0 0 0-4.2 0L4 9.8A3 3 0 0 0 8.2 14l.8-.8',
  spark: 'M9 2.5 10.6 7.4 15.5 9l-4.9 1.6L9 15.5l-1.6-4.9L2.5 9l4.9-1.6z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
