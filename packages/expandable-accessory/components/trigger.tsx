import type { ExpandableAccessoryTriggerProps } from '../types';
import { Link } from 'expo-router';

import { useExpandableAccessory } from '../hooks/use-expandable-accessory';

/** Declarative navigation trigger. Place `ZoomSource` inside its native child. */
export const ExpandableAccessoryTrigger: React.FC<
  ExpandableAccessoryTriggerProps
> = ({ children }) => {
  const { href, isActive } = useExpandableAccessory();

  if (!isActive) {
    return null;
  }

  return (
    <Link href={href} asChild>
      <Link.Trigger>{children}</Link.Trigger>
    </Link>
  );
};
