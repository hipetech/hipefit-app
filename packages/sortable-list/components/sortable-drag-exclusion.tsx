import type React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useContext, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { SortableItemContext } from '../hooks/use-sortable-drag';

/**
 * Longer than any touch, so the blocking gesture below never activates. An
 * active Gesture Handler gesture cancels React Native's touches, which would
 * take the wrapped control's long press away.
 */
const NEVER_ACTIVATES_MS = 24 * 60 * 60 * 1000;

/** Far enough that no finger travel fails the blocking gesture. */
const UNLIMITED_TRAVEL = 1_000_000;

export interface SortableDragExclusionProps {
  /**
   * The control whose own long press must win. React Native children only: a
   * SwiftUI control goes in its own `Host` inside this wrapper, beside the
   * row's main `Host`.
   */
  children: React.ReactNode;
  /** Style of the wrapping view, which is also the excluded touch area. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Marks part of a sortable row as not draggable. A touch that starts inside it
 * never lifts the row, and the wrapped control keeps its own long press.
 *
 * It attaches a long press gesture that begins on touch down and then neither
 * activates nor fails until the finger is up. `blocksExternalGesture` makes
 * the row's drag wait on it, so UIKit never lets the drag recognize and
 * nothing cancels the control's touches. The gesture also raises the row's
 * `isExcluded` flag for the length of the touch, which is what stops the lift:
 * see `sortable-item.tsx` for why the relation alone does not.
 *
 * It cannot go inside a `Host`. Outside a sortable row it adds no gesture.
 */
export const SortableDragExclusion: React.FC<SortableDragExclusionProps> = ({
  children,
  style,
}) => {
  const item = useContext(SortableItemContext);
  const dragGesture = item?.dragGesture;
  const isExcluded = item?.isExcluded;

  const blocker = useMemo(() => {
    if (dragGesture === undefined || isExcluded === undefined) return null;

    return Gesture.LongPress()
      .minDuration(NEVER_ACTIVATES_MS)
      .maxDistance(UNLIMITED_TRAVEL)
      .shouldCancelWhenOutside(false)
      .blocksExternalGesture(dragGesture)
      .onBegin(() => {
        'worklet';
        isExcluded.set(true);
      })
      .onFinalize(() => {
        'worklet';
        isExcluded.set(false);
      });
  }, [dragGesture, isExcluded]);

  if (blocker === null) {
    return style === undefined ? (
      children
    ) : (
      <View style={style}>{children}</View>
    );
  }

  return (
    <GestureDetector gesture={blocker}>
      <View style={style} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
};
