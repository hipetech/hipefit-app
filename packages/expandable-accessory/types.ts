import type { Href } from 'expo-router';
import type { ReactElement, ReactNode } from 'react';

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
  /** Stack route used as the Apple Zoom destination. */
  href: Href;
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
  /** One non-flattened native child captured by Apple's zoom transition. */
  children: ReactElement;
}

export interface ExpandableAccessoryContextValue {
  /** Whether domain state currently permits the accessory and expanded route. */
  isActive: boolean;
  /** Whether the configured expanded route is currently focused. */
  isExpanded: boolean;
  /** Route opened by the Apple Zoom trigger. */
  href: Href;
  /** Content registered for the native tab accessory. */
  accessoryContent: ReactNode;
  /** Content registered for the expanded route. */
  expandedContent: ReactNode;
  /** Open without a zoom source. Prefer `Trigger` plus `ZoomSource` for taps. */
  open: () => void;
  /** Close the expanded route through Expo Router. */
  close: () => void;
}
