import type { Href } from 'expo-router';
import type { ReactElement, ReactNode } from 'react';

/**
 * How the expanded route is presented. `fullScreen` is a full-screen modal
 * that expands from `ZoomSource` with Apple Zoom. `pageSheet` is a page sheet
 * with no zoom, which Apple Zoom does not support, and it swipes down to
 * dismiss.
 */
export type ExpandedPresentation = 'fullScreen' | 'pageSheet';

/** Stack screen options that present the expanded route. */
export interface ExpandedScreenOptions {
  presentation: 'fullScreenModal' | 'modal';
}

export interface AccessoryContentProps {
  /** Content rendered by `AccessoryOutlet` inside `NativeTabs.BottomAccessory`. */
  children: ReactNode;
}

export interface ExpandedContentProps {
  /** Content rendered by `ExpandedOutlet` from the configured Stack route. */
  children: ReactNode;
}

export interface ExpandableAccessoryProviderProps {
  /** Controlled domain state that shows the accessory and permits expansion. */
  active: boolean;
  /** Stack route the accessory expands into. */
  href: Href;
  /**
   * How that route is presented. Register the route with
   * `expandedScreenOptions` for the same value, because the package cannot
   * set a Stack screen's presentation itself.
   */
  presentation: ExpandedPresentation;
  /** Absolute pathname reported by `usePathname` while expanded. */
  expandedPath: string;
  /** Route used when expanded content has no history entry to dismiss into. */
  fallbackHref: Href;
  /** Slot declarations plus the navigation tree that consumes their outlets. */
  children: ReactNode;
}

export interface ExpandableAccessoryTriggerProps {
  /** One accessible native child used as the navigation trigger. */
  children: ReactElement;
}

export interface ExpandableAccessoryZoomSourceProps {
  /**
   * One non-flattened native child captured by Apple's zoom transition. With
   * `pageSheet` presentation it renders unchanged, with no zoom.
   */
  children: ReactElement;
}

export interface ExpandableAccessoryContextValue {
  /** Whether domain state currently permits the accessory and expanded route. */
  isActive: boolean;
  /** Whether the configured expanded route is currently focused. */
  isExpanded: boolean;
  /** Route opened by the trigger. */
  href: Href;
  /** How the expanded route is presented, as passed to the provider. */
  presentation: ExpandedPresentation;
  /** Content registered for the native tab accessory. */
  accessoryContent: ReactNode;
  /** Content registered for the expanded route. */
  expandedContent: ReactNode;
  /**
   * Open without a zoom source. It does not check `isActive`, so a caller can
   * open in the same handler that activates the domain state; an expanded route
   * that is still inactive at the next render closes itself. Prefer `Trigger`
   * plus `ZoomSource` for taps on the accessory.
   */
  open: () => void;
  /** Close the expanded route through Expo Router. */
  close: () => void;
}
