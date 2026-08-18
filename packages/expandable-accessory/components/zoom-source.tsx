import type { ExpandableAccessoryZoomSourceProps } from '../types';
import { Link } from 'expo-router';

/** Marks visual content as the Apple Zoom source without hiding its trigger. */
export const ExpandableAccessoryZoomSource: React.FC<
  ExpandableAccessoryZoomSourceProps
> = ({ children }) => <Link.AppleZoom>{children}</Link.AppleZoom>;
