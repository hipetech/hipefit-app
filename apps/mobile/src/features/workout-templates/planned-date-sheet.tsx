/* eslint-disable jsx-a11y/aria-role -- `role` on a SwiftUI `Button` is
   `'default' | 'cancel' | 'destructive'` (see @expo/ui Button.d.ts), not a
   DOM ARIA role; the a11y rule cannot tell the two apart. */
import type React from 'react';
import {
  BottomSheet,
  Button,
  DatePicker,
  Group,
  HStack,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  datePickerStyle,
  font,
  padding,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';

import { fromLocalDateId, toLocalDateId } from '@/lib/format';

/** `fitToContents` fits this sheet: a graphical `DatePicker` has an intrinsic height. */
const SHEET_MODIFIERS = [
  presentationDragIndicator('visible'),
  padding({ horizontal: 16, top: 24, bottom: 8 }),
];

const PICKER_MODIFIERS = [datePickerStyle('graphical')];

const DONE_LABEL_MODIFIERS = [font({ textStyle: 'body', weight: 'semibold' })];

export interface PlannedDateSheetProps {
  isPresented: boolean;
  /** The planned day, `YYYY-MM-DD`, or `null` for none. */
  plannedDate: string | null;
  /** Called with the picked day, or `null` when the date is removed. */
  onChange: (plannedDate: string | null) => void;
  onClose: () => void;
}

/**
 * The calendar the template editor opens from its Planned date row: a SwiftUI
 * `BottomSheet` with a graphical `DatePicker`, Remove Date, and Done. Picking a
 * day applies at once; Done only closes.
 *
 * Host-less, like the exercise picker: the editor form renders it in its
 * SwiftUI tree, so it presents over the editor sheet. Days before today are
 * not offered, since a plan is for a day still ahead.
 */
export const PlannedDateSheet: React.FC<PlannedDateSheetProps> = ({
  isPresented,
  plannedDate,
  onChange,
  onClose,
}) => {
  const today = fromLocalDateId(toLocalDateId(new Date()));

  return (
    <BottomSheet
      isPresented={isPresented}
      onIsPresentedChange={(presented) => {
        if (!presented) onClose();
      }}
      fitToContents
    >
      <Group modifiers={SHEET_MODIFIERS}>
        {isPresented ? (
          <VStack spacing={12}>
            <HStack>
              {plannedDate === null ? null : (
                <Button
                  label="Remove Date"
                  role="destructive"
                  onPress={() => {
                    onChange(null);
                    onClose();
                  }}
                />
              )}
              <Spacer />
              <Button onPress={onClose}>
                <Text modifiers={DONE_LABEL_MODIFIERS}>Done</Text>
              </Button>
            </HStack>
            <DatePicker
              selection={
                plannedDate === null ? today : fromLocalDateId(plannedDate)
              }
              displayedComponents={['date']}
              range={{ start: today }}
              onDateChange={(date) => onChange(toLocalDateId(date))}
              modifiers={PICKER_MODIFIERS}
            />
          </VStack>
        ) : (
          <VStack>
            <Text> </Text>
          </VStack>
        )}
      </Group>
    </BottomSheet>
  );
};
