import type React from 'react';
import { useState } from 'react';
import { Host } from '@expo/ui';
import {
  HStack,
  Image,
  List,
  ScrollView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  contentTransition,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { Card } from '@hipefit/ui';

import { WorkoutTemplateCard } from '@/features/workouts/workout-template-card';
import { WorkoutTemplatePreviewSheet } from '@/features/workouts/workout-template-preview-sheet';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { hapticImpact } from '@/lib/haptics';
import { useWorkoutTemplateStore } from '@/stores/use-workout-template-store';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';
import { layout } from '@/theme/styles';

/**
 * Horizontal margin of an `insetGrouped` section card.
 *
 * The template carousel zeroes its leading/trailing `listRowInsets` so the strip
 * can scroll edge to edge; this puts the same margin back *inside* the scroll
 * content, so the first card lines up with every other section's card and the
 * last card gets matching breathing room after it (the App Store idiom).
 */
const SECTION_HORIZONTAL_MARGIN = 16;

/**
 * Full-bleed carousel row: the App Store idiom for a horizontal strip inside a
 * grouped list. Zero leading/trailing row insets and the page background make
 * the row itself disappear; the section margin is re-applied to the content so
 * the cards stay aligned.
 */
const CAROUSEL_ROW_MODIFIERS = [
  listRowInsets({
    top: 8,
    leading: 0,
    bottom: 8,
    trailing: 0,
  }),
  listRowBackground(colors.systemGroupedBackground),
  listRowSeparator('hidden'),
];

/** Puts the section margin the carousel row gave up back inside its content. */
const CAROUSEL_CONTENT_MODIFIERS = [
  padding({ horizontal: SECTION_HORIZONTAL_MARGIN }),
];

/** Stable keys for the rows rendered behind `redacted('placeholder')`. */
const PLACEHOLDER_TEMPLATE_KEYS = ['template-a', 'template-b'];
const PLACEHOLDER_HISTORY_KEYS = ['history-a', 'history-b', 'history-c'];

/**
 * How the template count rolls to its new value. Matches Home's Activity
 * figures — 250ms of ease-in-out, well inside the ~300ms motion budget.
 */
const COUNTER_ANIMATION = Animation.easeInOut({ duration: 0.25 });

/**
 * The section header's trailing count. Font-*refining* only, so the count keeps
 * inheriting the header font and color the list style publishes.
 */
const COUNT_MODIFIERS = [monospacedDigit()];

interface SectionHeaderProps {
  title: string;
  /** Trailing count. Omit it entirely to render a plain header. */
  count?: number;
  /**
   * Roll the count with `numericText` when it changes instead of hard-cutting
   * it. The caller turns this off under Reduce Motion.
   */
  animateCount?: boolean;
}

/**
 * Grouped-list section header with an optional trailing count.
 *
 * This exists because `badge()` on a `<Section title=…>` is broken: instead of
 * decorating the header it collapses the title *into* the first row, so the
 * heading renders beside the row content with the count floating on the right.
 * `Section` accepts a custom `header` node, which is the supported escape hatch
 * — note the Swift side only reads the `header` slot when `title` is unset, so
 * the two props are mutually exclusive.
 *
 * Neither `Text` carries a font or color modifier **on purpose**: the list style
 * publishes the header font, color and text case through the SwiftUI
 * environment, and the header slot is a plain child view, so both inherit them.
 * Hard-coding `footnote` + `secondaryLabel` here would look right today but
 * silently drift from the sections that still use `title` (e.g. History).
 *
 * The count does take `monospacedDigit()`, which is font-*refining* rather than
 * font-*setting*, so it leaves that inheritance intact. It is a standalone
 * figure that changes in place when a template is saved; proportional digits
 * would make it jump sideways against the trailing edge each time.
 *
 * For the same reason it also supports the rolling `numericText` transition.
 * Both motion modifiers go *after* `monospacedDigit()` (index 0 is innermost),
 * so they wrap the fully resolved text rather than being re-resolved by it.
 */
const SectionHeader = ({ title, count, animateCount }: SectionHeaderProps) => (
  <HStack alignment="center">
    <Text>{title}</Text>
    <Spacer />
    {count != null ? (
      <Text
        modifiers={
          animateCount
            ? [
                ...COUNT_MODIFIERS,
                contentTransition('numericText'),
                animation(COUNTER_ANIMATION, count),
              ]
            : COUNT_MODIFIERS
        }
      >
        {String(count)}
      </Text>
    ) : null}
  </HStack>
);

/**
 * The loading stand-in for a template card, drawn behind
 * `redacted('placeholder')`.
 */
const PlaceholderWorkoutTemplateCard = () => (
  <Card width={200} radius={12} spacing={8}>
    <Text modifiers={mods.headlineLabel}>Placeholder Template</Text>
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={mods.footnoteSecondary}>8 exercises</Text>
      <Text modifiers={mods.footnoteSecondary}>~45 min</Text>
    </VStack>
  </Card>
);

/** A history-row skeleton retained for the future data integration. */
const PlaceholderHistoryRow = () => (
  <HStack alignment="center" spacing={12}>
    {/* Sized with a text style, never a fixed `size`, so the glyph tracks
        Dynamic Type like every other leading symbol in the app. */}
    <Image
      systemName="circle.fill"
      color={colors.systemGray}
      modifiers={mods.title3}
    />
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={mods.bodyLabel}>Placeholder Workout</Text>
      <Text modifiers={mods.footnoteSecondary}>Jan 1, 2026 · 45 min</Text>
    </VStack>
    <Spacer />
    {/* Keep the trailing figure tabular so its placeholder width matches the
        numeric column a future history row will need. */}
    <Text modifiers={mods.bodyLabelMono}>1.2k kg</Text>
  </HStack>
);

/** Muted single-row stand-in for an empty section. */
const EmptyRow = ({ label }: { label: string }) => (
  <Text modifiers={mods.bodySecondary}>{label}</Text>
);

/**
 * Body of the Workouts screen.
 *
 * Templates are read from `useWorkoutTemplateStore`, which the central
 * Firestore subscription starts, so a saved template appears here without a
 * reload. Workout history is not read: History keeps its empty state, and its
 * placeholder rows show only while the template store loads, because the whole
 * `List` is redacted as one unit.
 *
 * The template count rolls only once the store has loaded and Reduce Motion is
 * off. `.animation(_:value:)` does not animate when it is first applied, so
 * adding it as redaction lifts stops the placeholder count from rolling into the
 * real one.
 *
 * Tapping a template card opens `WorkoutTemplatePreviewSheet`, a sibling
 * island. The preview reads the template from the store by id, so it follows
 * the listener while open. The id stays set after dismissal so the sheet keeps
 * its content through the closing animation.
 *
 * One `Host` filling the screen (`flex: 1`, deliberately **no**
 * `matchContents`) around one SwiftUI `List` with `listStyle('insetGrouped')`.
 * A `List` has no intrinsic content height, so it can only live at the root of
 * a Host that owns real space. `insetGrouped` supplies the 16pt margins, 44pt
 * row heights, inset hairlines and grouped background for free — which is what
 * retires the hand-drawn divider, the chip beside the heading, the `EmptyCard`s
 * and the skeleton island this screen used to hand-roll.
 *
 * Empty states are a muted row plus a `Section` footer rather than a
 * `ContentUnavailableView`. Apple uses that view as the *whole* screen, never as
 * a list row (as a row it is just the tall hand-rolled empty card this migration
 * set out to delete), and a whole-screen variant does not fit here: the two
 * sections empty independently, so it would only ever be correct on a brand-new
 * account, and swapping the `List` out for a non-scrolling view takes away the
 * scroll view UIKit uses to collapse the large title.
 */
export const WorkoutsContent: React.FC = () => {
  const colorScheme = useAppColorScheme();
  const reduceMotion = useReduceMotion();
  const templates = useWorkoutTemplateStore((state) => state.templates);
  const isLoading = useWorkoutTemplateStore((state) => state.isLoading);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isPreviewPresented, setIsPreviewPresented] = useState(false);
  const previewTemplate =
    templates.find((template) => template.id === previewId)?.data ?? null;

  const openPreview = (templateId: string): void => {
    hapticImpact();
    setPreviewId(templateId);
    setIsPreviewPresented(true);
  };

  const hasTemplates = templates.length > 0;
  const templateCount = isLoading
    ? PLACEHOLDER_TEMPLATE_KEYS.length
    : templates.length;

  return (
    <>
      <Host style={layout.groupedScreen} colorScheme={colorScheme}>
        <List
          modifiers={
            isLoading ? mods.listInsetGroupedRedacted : mods.listInsetGrouped
          }
        >
          <Section
            header={
              <SectionHeader
                title="My Workout Templates"
                count={templateCount}
                animateCount={!isLoading && !reduceMotion}
              />
            }
            footer={
              !isLoading && !hasTemplates ? (
                <Text>
                  Create a workout template and it will show up here, ready to
                  start in one tap.
                </Text>
              ) : undefined
            }
          >
            {isLoading || hasTemplates ? (
              <ScrollView
                axes="horizontal"
                showsIndicators={false}
                modifiers={CAROUSEL_ROW_MODIFIERS}
              >
                <HStack
                  alignment="top"
                  spacing={12}
                  modifiers={CAROUSEL_CONTENT_MODIFIERS}
                >
                  {isLoading
                    ? PLACEHOLDER_TEMPLATE_KEYS.map((key) => (
                        <PlaceholderWorkoutTemplateCard key={key} />
                      ))
                    : templates.map(({ id, data }) => (
                        <WorkoutTemplateCard
                          key={id}
                          template={data}
                          onPress={() => openPreview(id)}
                        />
                      ))}
                </HStack>
              </ScrollView>
            ) : (
              <EmptyRow label="No workout templates yet" />
            )}
          </Section>

          <Section
            title="History"
            footer={
              !isLoading ? (
                <Text>
                  Finish a workout and it will appear in your history.
                </Text>
              ) : undefined
            }
          >
            {isLoading ? (
              PLACEHOLDER_HISTORY_KEYS.map((key) => (
                <PlaceholderHistoryRow key={key} />
              ))
            ) : (
              <EmptyRow label="No workouts yet" />
            )}
          </Section>
        </List>
      </Host>
      <WorkoutTemplatePreviewSheet
        template={previewTemplate}
        isPresented={isPreviewPresented && previewTemplate !== null}
        onClose={() => setIsPreviewPresented(false)}
      />
    </>
  );
};
