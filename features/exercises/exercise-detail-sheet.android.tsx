import type { ExerciseDetailSheetProps } from './exercise-detail-sheet';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { EXERCISE_PLACEHOLDER_IMAGE } from '@/lib/constants';
import { capitalize, getDifficultyValue } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Chip } from '@/ui/chip';
import { Image } from '@/ui/Image';
import { Progress } from '@/ui/progress';
import { Separator } from '@/ui/separator';
import { Text } from '@/ui/text';

/**
 * Exercise detail sheet (Android fallback): a bottom-anchored RN `Modal` card.
 * SwiftUI `BottomSheet` is iOS-only, so Android uses plain RN scaffolding.
 */
export const ExerciseDetailSheet = ({
  exercise,
  isPresented,
  onClose,
  onAdd,
}: ExerciseDetailSheetProps) => (
  <Modal
    visible={isPresented && exercise !== null}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <Pressable
      style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
      onPress={onClose}
    />
    <View
      style={{
        backgroundColor: colors.systemBackground,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 32,
        maxHeight: '85%',
      }}
    >
      {exercise ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16 }}>
            <View style={{ gap: 4 }}>
              <Text variant="h4">{exercise.name}</Text>
              <Text variant="muted">
                {`${exercise.groupName} • ${
                  exercise.equipment.length > 0
                    ? exercise.equipment.join(', ')
                    : 'No equipment'
                }`}
              </Text>
            </View>

            <Image
              source={{ uri: exercise.imageURL ?? EXERCISE_PLACEHOLDER_IMAGE }}
              style={{ width: '100%', height: 200, borderRadius: 8 }}
              contentFit="cover"
              transition={200}
            />

            <Separator />

            <View style={{ gap: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text variant="muted">Difficulty</Text>
                <Chip label={capitalize(exercise.difficulty)} />
              </View>
              <Progress value={getDifficultyValue(exercise.difficulty)} />
            </View>

            {exercise.description ? (
              <View style={{ gap: 8 }}>
                <Text variant="h4" style={{ fontSize: 17 }}>
                  Description
                </Text>
                <Text variant="muted">{exercise.description}</Text>
              </View>
            ) : null}

            {exercise.isCustom ? <Chip label="Custom Exercise" /> : null}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.separator,
                }}
              >
                <Text style={{ fontWeight: '600' }}>Close</Text>
              </Pressable>
              <Pressable
                onPress={onAdd}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.brand,
                }}
              >
                <Text
                  style={{ color: colors.brandForeground, fontWeight: '600' }}
                >
                  Add to Workout
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      ) : null}
    </View>
  </Modal>
);
