import { AccessoryContent } from './components/accessory-content';
import { AccessoryOutlet } from './components/accessory-outlet';
import { ExpandedContent } from './components/expanded-content';
import { ExpandedOutlet } from './components/expanded-outlet';
import { ExpandableAccessoryProvider } from './components/provider';
import { ExpandableAccessoryTrigger } from './components/trigger';
import { ExpandableAccessoryZoomSource } from './components/zoom-source';

/** Compound API for an active native-tab accessory with a routed expansion. */
export const ExpandableAccessory = {
  Provider: ExpandableAccessoryProvider,
  AccessoryContent,
  ExpandedContent,
  AccessoryOutlet,
  ExpandedOutlet,
  Trigger: ExpandableAccessoryTrigger,
  ZoomSource: ExpandableAccessoryZoomSource,
};

export { useExpandableAccessory } from './hooks/use-expandable-accessory';
export type {
  AccessoryContentProps,
  ExpandableAccessoryContextValue,
  ExpandableAccessoryProviderProps,
  ExpandableAccessoryTriggerProps,
  ExpandableAccessoryZoomSourceProps,
  ExpandedContentProps,
} from './types';
