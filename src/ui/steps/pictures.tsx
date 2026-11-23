import type { ReactNode } from 'react';
import type { TrailerConfig } from '../../trailer/config';

/** Seitenansichten der drei Bauformen als Bildzeichen. */
export const BODY_PICTURES: Record<TrailerConfig['body'], ReactNode> = {
  platform: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      <rect x="6" y="12" width="64" height="7" rx="1.5" />
      <circle cx="20" cy="26" r="6" />
      <circle cx="58" cy="26" r="6" />
      <rect x="70" y="16" width="12" height="2" rx="1" />
    </svg>
  ),
  lowbed: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      <path d="M6 10h18v7h-3v8h26v-8h-3v-7h26v7H50v12H18V17H6z" />
      <circle cx="12" cy="26" r="5.5" />
      <circle cx="62" cy="26" r="5.5" />
      <rect x="70" y="14" width="12" height="2" rx="1" />
    </svg>
  ),
  longload: (
    <svg viewBox="0 0 84 38" aria-hidden="true">
      <rect x="6" y="14" width="16" height="6" rx="1.5" />
      <rect x="52" y="14" width="16" height="6" rx="1.5" />
      <rect x="20" y="16" width="34" height="2.4" />
      <rect x="8" y="4" width="2.4" height="11" />
      <rect x="18" y="4" width="2.4" height="11" />
      <rect x="54" y="4" width="2.4" height="11" />
      <rect x="64" y="4" width="2.4" height="11" />
      <circle cx="14" cy="27" r="5.5" />
      <circle cx="60" cy="27" r="5.5" />
      <rect x="68" y="16.5" width="14" height="2" rx="1" />
    </svg>
  ),
};
