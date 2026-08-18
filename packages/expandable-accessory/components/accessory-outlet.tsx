import { useExpandableAccessory } from '../hooks/use-expandable-accessory';

/** Renders registered compact content only while controlled state is active. */
export const AccessoryOutlet: React.FC = () => {
  const { accessoryContent, isActive } = useExpandableAccessory();
  return isActive ? accessoryContent : null;
};
