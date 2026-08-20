import { useExpandableAccessory } from '../hooks/use-expandable-accessory';

/** Renders registered expanded content from its dedicated Stack route. */
export const ExpandedOutlet: React.FC = () => {
  const { expandedContent, isActive } = useExpandableAccessory();
  return isActive ? expandedContent : null;
};
