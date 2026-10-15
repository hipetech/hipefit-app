import type { ExpandableAccessoryZoomSourceProps } from '../types';
import { Link } from 'expo-router';

import { useExpandableAccessory } from '../hooks/use-expandable-accessory';

/**
 * Marks visual content as the Apple Zoom source without hiding its trigger.
 * A `pageSheet` presentation has no zoom, so the content renders unchanged.
 */
export const ExpandableAccessoryZoomSource: React.FC<
  ExpandableAccessoryZoomSourceProps
> = ({ children }) => {
  const { presentation } = useExpandableAccessory();

  return presentation === 'fullScreen' ? (
    <Link.AppleZoom>{children}</Link.AppleZoom>
  ) : (
    children
  );
};
