import type { SFSymbol } from 'sf-symbols-typescript';
import { useState } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import {
  BottomSheet,
  Button,
  Column,
  FieldGroup,
  Host,
  Icon,
  ListItem,
  Picker,
  Row,
  TextInput,
  Text as UIText,
} from '@expo/ui';

import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { useUserStore } from '@/features/user/store/use-user-store';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { BRAND_SEED, colors } from '@/theme/colors';
import { Avatar } from '@/ui/avatar';
import { Card } from '@/ui/card';
import { Separator } from '@/ui/separator';
import { Skeleton } from '@/ui/skeleton';
import { Text } from '@/ui/text';

interface SettingsItem {
  id: string;
  label: string;
  /** Leading SF Symbol shown at the start of the row (iOS). */
  icon: SFSymbol;
  hasArrow: boolean;
}

interface SettingsSection {
  id: number;
  category: string;
  items: SettingsItem[];
}

const appSections: SettingsSection[] = [
  {
    id: 1,
    category: 'App',
    items: [
      {
        id: 'theme',
        label: 'Theme',
        icon: 'paintpalette',
        hasArrow: true,
      },
    ],
  },
];

// Universal `Text`'s `textStyle.color` only accepts `string`, so the semantic
// `OpaqueColorValue` tokens are cast; they still resolve to the native semantic
// color at runtime (see `@/theme/colors`).
const LABEL = colors.label as string;
const SECONDARY = colors.secondaryLabel as string;
const DANGER = colors.systemRed as string;

export default function Settings() {
  const { signOut } = useAuthStore();
  const { profile, isLoading, updateSettings, updateProfile } = useUserStore();
  const scheme = useAppColorScheme();
  const { width } = useWindowDimensions();

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');

  // Screen has 16pt horizontal padding; a Card adds its default 16pt inset.
  const contentWidth = width - 32;
  const statColWidth = Math.floor((contentWidth - 32 - 2) / 3);

  const displayName = profile?.displayName ?? '';
  const email = profile?.email ?? '';
  const photoURL = profile?.photoURL ?? null;
  const stats = profile?.stats;
  const themeValue: string = profile?.settings?.theme ?? 'system';
  const memberSince = profile?.createdAt
    ? profile.createdAt.toDate().getFullYear()
    : '';

  const openProfileDialog = () => {
    setEditName(displayName);
    setProfileDialogOpen(true);
  };

  const saveProfile = async () => {
    await updateProfile({ displayName: editName });
    setProfileDialogOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setLogoutDialogOpen(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const renderTrailing = (item: SettingsItem) => {
    if (item.id === 'theme') {
      return (
        <Picker
          selectedValue={themeValue}
          onValueChange={(value) => {
            if (value === 'light' || value === 'dark' || value === 'system') {
              updateSettings({ theme: value });
            }
          }}
        >
          <Picker.Item label="System" value="system" />
          <Picker.Item label="Light" value="light" />
          <Picker.Item label="Dark" value="dark" />
        </Picker>
      );
    }
    if (item.hasArrow && process.env.EXPO_OS === 'ios') {
      return (
        <Icon name="chevron.right" size={16} color={colors.tertiaryLabel} />
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 24 }}
      >
        <Host matchContents seedColor={BRAND_SEED} colorScheme={scheme}>
          <Card>
            <Row spacing={16} alignment="center">
              <Skeleton width={70} height={70} radius={9999} />
              <Column spacing={8}>
                <Skeleton width={160} height={22} />
                <Skeleton width={200} height={14} />
                <Skeleton width={120} height={14} />
              </Column>
            </Row>
          </Card>
        </Host>
        <Host matchContents seedColor={BRAND_SEED} colorScheme={scheme}>
          <Card>
            <Skeleton width={contentWidth - 32} height={120} />
          </Card>
        </Host>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.systemBackground }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 24 }}
    >
      {/* Profile header */}
      <Host matchContents seedColor={BRAND_SEED} colorScheme={scheme}>
        <Card>
          <Row spacing={16} alignment="center">
            <Avatar
              source={photoURL}
              fallback={displayName || 'User'}
              size={70}
            />
            <Column spacing={2}>
              <UIText
                textStyle={{ fontSize: 22, fontWeight: '700', color: LABEL }}
              >
                {displayName || 'User'}
              </UIText>
              <UIText textStyle={{ fontSize: 13, color: SECONDARY }}>
                {email || 'No email'}
              </UIText>
              {memberSince ? (
                <UIText textStyle={{ fontSize: 13, color: SECONDARY }}>
                  {`Member since ${memberSince}`}
                </UIText>
              ) : null}
            </Column>
          </Row>
          <Button
            variant="outlined"
            label="Edit Profile"
            onPress={openProfileDialog}
          />
        </Card>
      </Host>

      {/* Settings sections */}
      <Host matchContents seedColor={BRAND_SEED} colorScheme={scheme}>
        <FieldGroup>
          {appSections.map((section) => (
            <FieldGroup.Section key={section.id} title={section.category}>
              {section.items.map((item) => (
                <ListItem key={item.id}>
                  {process.env.EXPO_OS === 'ios' ? (
                    <ListItem.Leading>
                      <Icon name={item.icon} size={22} color={colors.brand} />
                    </ListItem.Leading>
                  ) : null}
                  {item.label}
                  <ListItem.Trailing>{renderTrailing(item)}</ListItem.Trailing>
                </ListItem>
              ))}
            </FieldGroup.Section>
          ))}
        </FieldGroup>
      </Host>

      {/* Stats summary */}
      <Text
        variant="small"
        style={{
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: -8,
          color: colors.secondaryLabel,
        }}
      >
        Your Stats
      </Text>
      <Host matchContents seedColor={BRAND_SEED} colorScheme={scheme}>
        <Card>
          <Row spacing={0} alignment="center">
            <Column
              alignment="center"
              spacing={4}
              style={{ width: statColWidth }}
            >
              <UIText
                textStyle={{ fontSize: 24, fontWeight: '700', color: LABEL }}
              >
                {String(stats?.totalWorkouts ?? 0)}
              </UIText>
              <UIText
                numberOfLines={2}
                textStyle={{
                  fontSize: 12,
                  textAlign: 'center',
                  color: SECONDARY,
                }}
              >
                Total Workouts
              </UIText>
            </Column>
            <Separator orientation="vertical" length={40} />
            <Column
              alignment="center"
              spacing={4}
              style={{ width: statColWidth }}
            >
              <UIText
                textStyle={{ fontSize: 24, fontWeight: '700', color: LABEL }}
              >
                {String(stats?.currentStreak ?? 0)}
              </UIText>
              <UIText
                numberOfLines={2}
                textStyle={{
                  fontSize: 12,
                  textAlign: 'center',
                  color: SECONDARY,
                }}
              >
                Current Streak (days)
              </UIText>
            </Column>
            <Separator orientation="vertical" length={40} />
            <Column
              alignment="center"
              spacing={4}
              style={{ width: statColWidth }}
            >
              <UIText
                textStyle={{ fontSize: 24, fontWeight: '700', color: LABEL }}
              >
                {String(stats?.longestStreak ?? 0)}
              </UIText>
              <UIText
                numberOfLines={2}
                textStyle={{
                  fontSize: 12,
                  textAlign: 'center',
                  color: SECONDARY,
                }}
              >
                Longest Streak (days)
              </UIText>
            </Column>
          </Row>
        </Card>
      </Host>

      {/* Logout */}
      <Host matchContents seedColor={BRAND_SEED} colorScheme={scheme}>
        <Button
          variant="outlined"
          style={{ width: contentWidth }}
          onPress={() => setLogoutDialogOpen(true)}
        >
          <UIText
            textStyle={{ fontSize: 16, fontWeight: '600', color: DANGER }}
          >
            Log Out
          </UIText>
        </Button>
      </Host>

      {/* Edit Profile sheet — `BottomSheet` provides its own Host internally,
          so it must not be wrapped in another `Host`. */}
      <BottomSheet
        isPresented={profileDialogOpen}
        onDismiss={() => setProfileDialogOpen(false)}
      >
        <Column spacing={16} style={{ padding: 20 }}>
          <UIText textStyle={{ fontSize: 20, fontWeight: '700', color: LABEL }}>
            Edit Profile
          </UIText>
          <UIText textStyle={{ fontSize: 14, color: SECONDARY }}>
            Update your profile information
          </UIText>
          <Column spacing={6}>
            <UIText textStyle={{ fontSize: 13, color: SECONDARY }}>Name</UIText>
            <TextInput
              // Remount on each open so `defaultValue` re-seeds from the current name.
              key={profileDialogOpen ? 'edit-name-open' : 'edit-name-closed'}
              defaultValue={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
            />
          </Column>
          <Row spacing={12} alignment="center">
            <Button
              variant="text"
              label="Cancel"
              onPress={() => setProfileDialogOpen(false)}
            />
            <Button variant="filled" label="Save" onPress={saveProfile} />
          </Row>
        </Column>
      </BottomSheet>

      {/* Logout confirmation sheet — see note above re: nested Host. */}
      <BottomSheet
        isPresented={logoutDialogOpen}
        onDismiss={() => setLogoutDialogOpen(false)}
      >
        <Column spacing={16} style={{ padding: 20 }}>
          <UIText textStyle={{ fontSize: 20, fontWeight: '700', color: LABEL }}>
            Are you sure?
          </UIText>
          <UIText textStyle={{ fontSize: 14, color: SECONDARY }}>
            You will be logged out of your account. You can sign back in
            anytime.
          </UIText>
          <Row spacing={12} alignment="center">
            <Button
              variant="text"
              label="Cancel"
              onPress={() => setLogoutDialogOpen(false)}
            />
            <Button variant="outlined" onPress={handleLogout}>
              <UIText
                textStyle={{ fontSize: 16, fontWeight: '600', color: DANGER }}
              >
                Log Out
              </UIText>
            </Button>
          </Row>
        </Column>
      </BottomSheet>
    </ScrollView>
  );
}
