import {documentaryConfig} from '../config/documentaryConfig';

export const colors = documentaryConfig.theme.colors;
export const fonts = documentaryConfig.theme.fonts;
export const safe = documentaryConfig.theme.safe;

/** Apply an alpha to a #rrggbb colour. */
export const withAlpha = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
};
