import { StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';

/** Space between two cards in the editor's list. Each item carries half of it above and below. */
const ITEM_GAP = 8;

/**
 * The card an exercise or a superset draws in the template editor's list.
 * Shared by `template-exercise-row.tsx` and `template-superset-block.tsx` so a
 * single exercise and a superset read as the same kind of item.
 */
export const templateCardStyles = StyleSheet.create({
  item: {
    paddingHorizontal: 16,
    paddingVertical: ITEM_GAP / 2,
  },
  /**
   * Opaque, so the lifted copy `SortableList` draws above the list hides the
   * items it passes over. `secondarySystemBackground` rather than the white
   * grouped row color, which disappears against the opaque full-height sheet.
   */
  card: {
    paddingLeft: 16,
    paddingRight: 4,
    paddingBottom: 4,
    borderRadius: 12,
    backgroundColor: colors.secondarySystemBackground,
  },
});
