import type { ExpandedPresentation, ExpandedScreenOptions } from '../types';

/**
 * Stack screen options for the expanded route. Apple Zoom needs a
 * `fullScreenModal`; a `modal` is a page sheet on iOS.
 */
export const expandedScreenOptions = (
  presentation: ExpandedPresentation
): ExpandedScreenOptions => ({
  presentation: presentation === 'fullScreen' ? 'fullScreenModal' : 'modal',
});
