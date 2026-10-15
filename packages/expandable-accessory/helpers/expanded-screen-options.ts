import type { ExpandedPresentation, ExpandedScreenOptions } from '../types';

/**
 * Stack screen options for the expanded route. `fullScreen` is a push, a
 * `card`: checked on an iOS 26.5 simulator with expo-router 57.0.8, Apple Zoom
 * into a `fullScreenModal` played as a plain slide, while a pushed card zoomed.
 * A `modal` is a page sheet on iOS.
 */
export const expandedScreenOptions = (
  presentation: ExpandedPresentation
): ExpandedScreenOptions => ({
  presentation: presentation === 'fullScreen' ? 'card' : 'modal',
});
