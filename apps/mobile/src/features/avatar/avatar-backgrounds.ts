import type { ColorValue } from 'react-native';

export interface AvatarBackground {
  colors: [ColorValue, ColorValue];
  foregroundColor: ColorValue;
}

/** Pastel backgrounds ordered to match the reference profile color picker. */
export const AVATAR_BACKGROUNDS: [AvatarBackground, ...AvatarBackground[]] = [
  { colors: ['#ffe58a', '#f45f70'], foregroundColor: '#532c35' },
  { colors: ['#8b4df5', '#6edfd3'], foregroundColor: '#20243d' },
  { colors: ['#fff45f', '#efbd47'], foregroundColor: '#574715' },
  { colors: ['#5adbc5', '#3197d8'], foregroundColor: '#153f55' },
  { colors: ['#a7e2d4', '#f2a264'], foregroundColor: '#31504b' },
  { colors: ['#ffe0c8', '#bd48b4'], foregroundColor: '#552d4f' },
  { colors: ['#4e85ca', '#17277c'], foregroundColor: '#ffffff' },
  { colors: ['#e7ddcf', '#f1bd4d'], foregroundColor: '#59491f' },
  { colors: ['#d8d9dc', '#4d4e51'], foregroundColor: '#202124' },
  { colors: ['#cc8d8b', '#843630'], foregroundColor: '#ffffff' },
  { colors: ['#9ec9c6', '#27516a'], foregroundColor: '#182f3a' },
  { colors: ['#69d2a6', '#3c9b67'], foregroundColor: '#173f2c' },
  { colors: ['#f47c82', '#dc393d'], foregroundColor: '#ffffff' },
  { colors: ['#ffed68', '#efb849'], foregroundColor: '#584817' },
];

/** Subtle highlight around generated avatar backgrounds. */
export const AVATAR_BORDER_COLOR = 'rgba(255, 255, 255, 0.42)';
