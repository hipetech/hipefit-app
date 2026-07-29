import { StyleSheet } from 'react-native';
import { Host } from '@expo/ui';
import { ContentUnavailableView } from '@expo/ui/swift-ui';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';

/**
 * Height reserved for the empty state. `ContentUnavailableView` centers itself
 * in whatever space it is offered and has no useful intrinsic height, so the
 * `Host` is bounded rather than `matchContents`.
 */
const EMPTY_STATE_HEIGHT = 280;

const styles = StyleSheet.create({
  host: { height: EMPTY_STATE_HEIGHT },
});

export interface ExercisesEmptyProps {
  /** Whether the emptiness is caused by a search / difficulty filter. */
  isFiltered: boolean;
}

/**
 * Empty state for the exercise catalogue: the system's own
 * `ContentUnavailableView` in its own `Host`, replacing the hand-drawn
 * "No exercises found" card.
 */
export const ExercisesEmpty = ({ isFiltered }: ExercisesEmptyProps) => {
  const colorScheme = useAppColorScheme();

  return (
    <Host style={styles.host} colorScheme={colorScheme}>
      <ContentUnavailableView
        title={isFiltered ? 'No Matches' : 'No Exercises'}
        systemImage={isFiltered ? 'magnifyingglass' : 'dumbbell'}
        description={
          isFiltered
            ? 'Try a different search term or difficulty filter.'
            : 'Your exercise catalogue is empty.'
        }
      />
    </Host>
  );
};
