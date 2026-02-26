import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Dialog,
  Input,
  Label,
  Select,
  Separator,
  Skeleton,
  TextField,
} from 'heroui-native';

import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { useUserStore } from '@/features/user/store/use-user-store';
import { capitalize, getInitials } from '@/lib/format';
import { TAB_BAR_TOTAL_HEIGHT } from '@/ui/tab-bar';
import { Text } from '@/ui/text';

interface SettingsItem {
  id: string;
  label: string;
  icon: string;
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
        icon: '🎨',
        hasArrow: true,
      },
    ],
  },
];

function SettingsItemList({
  sections,
  renderExtra,
}: {
  sections: SettingsSection[];
  renderExtra?: (itemId: string) => React.ReactNode;
}) {
  return (
    <View className="gap-5">
      {sections.map((section) => (
        <View key={section.id}>
          <Text variant="small" className="mb-2 tracking-wide uppercase">
            {section.category}
          </Text>
          <Card className="overflow-hidden">
            {section.items.map((item, index) => {
              const extra = renderExtra?.(item.id);
              return (
                <View key={item.id}>
                  <Pressable
                    className="w-full flex-row items-start justify-between p-3"
                    disabled={!item.hasArrow}
                  >
                    <View className="flex-1 flex-row items-start">
                      <View className="mr-4 h-10 w-10 items-center justify-center">
                        <Text className="text-2xl">{item.icon}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="mb-0.5 text-base font-medium">
                          {item.label}
                        </Text>
                        {extra}
                      </View>
                    </View>
                    {item.hasArrow && !extra && (
                      <View className="items-center justify-center">
                        <Text className="text-2xl font-light text-gray-500">
                          ›
                        </Text>
                      </View>
                    )}
                  </Pressable>
                  {index !== section.items.length - 1 && (
                    <Separator className="mx-3" />
                  )}
                </View>
              );
            })}
          </Card>
        </View>
      ))}
    </View>
  );
}

export default function Settings() {
  const { signOut } = useAuthStore();
  const { profile, isLoading, updateSettings, updateProfile } = useUserStore();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');

  const displayName = profile?.displayName ?? '';
  const email = profile?.email ?? '';
  const photoURL = profile?.photoURL ?? null;
  const settings = profile?.settings;
  const stats = profile?.stats;
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

  const themeValue = settings
    ? {
        value: settings.theme,
        label: capitalize(settings.theme),
      }
    : { value: 'system', label: 'System' };

  const renderAppExtra = (itemId: string): React.ReactNode => {
    if (itemId === 'theme') {
      return (
        <Select
          value={themeValue}
          onValueChange={(val) => {
            if (val) {
              const option = val as { value: string; label: string };
              const theme = option.value;
              if (theme === 'light' || theme === 'dark' || theme === 'system') {
                updateSettings({ theme });
              }
            }
          }}
        >
          <Select.Trigger className="mt-1 w-[120px] py-1">
            <Select.Value placeholder="Select theme" />
            <Select.TriggerIndicator />
          </Select.Trigger>
          <Select.Portal>
            <Select.Overlay />
            <Select.Content presentation="popover" width="trigger">
              <Select.Item value="system" label="System" />
              <Select.Item value="light" label="Light" />
              <Select.Item value="dark" label="Dark" />
            </Select.Content>
          </Select.Portal>
        </Select>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <ScrollView className="bg-background flex-1">
        <View className="p-4 pt-12">
          <View className="mb-6">
            <Card className="p-4">
              <View className="flex-row items-center">
                <Skeleton className="mr-4 h-[70px] w-[70px] rounded-full" />
                <View className="flex-1 gap-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-4 w-32" />
                </View>
              </View>
            </Card>
          </View>
          <View className="gap-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerStyle={{ paddingBottom: TAB_BAR_TOTAL_HEIGHT }}
    >
      <View className="p-4 pt-12">
        {/* Profile Header with Avatar */}
        <View className="mb-6">
          <Card className="p-4">
            <View className="flex-row items-center">
              <Avatar
                size="lg"
                className="mr-4 h-[70px] w-[70px]"
                alt="Profile Picture"
              >
                {photoURL ? <Avatar.Image source={{ uri: photoURL }} /> : null}
                <Avatar.Fallback>
                  {displayName ? getInitials(displayName) : '?'}
                </Avatar.Fallback>
              </Avatar>
              <View className="flex-1">
                <Text variant="h3" className="mb-1">
                  {displayName || 'User'}
                </Text>
                <Text variant="muted" className="mb-1 text-xs">
                  {email || 'No email'}
                </Text>
                {memberSince ? (
                  <Text variant="muted" className="text-xs">
                    Member since {memberSince}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Edit Profile Dialog */}
            <Dialog
              isOpen={profileDialogOpen}
              onOpenChange={setProfileDialogOpen}
            >
              <Dialog.Trigger asChild>
                <Button
                  variant="outline"
                  className="mt-3"
                  onPress={openProfileDialog}
                >
                  <Button.Label>Edit Profile</Button.Label>
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay />
                <Dialog.Content>
                  <Dialog.Close />
                  <Dialog.Title>Edit Profile</Dialog.Title>
                  <Dialog.Description>
                    Update your profile information
                  </Dialog.Description>
                  <View className="mt-2 gap-4">
                    <TextField>
                      <Label>Name</Label>
                      <Input
                        variant="secondary"
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="Enter your name"
                      />
                    </TextField>
                  </View>
                  <View className="mt-6 flex-row justify-end gap-3">
                    <Button
                      variant="outline"
                      onPress={() => setProfileDialogOpen(false)}
                    >
                      <Button.Label>Cancel</Button.Label>
                    </Button>
                    <Button onPress={saveProfile}>
                      <Button.Label>Save</Button.Label>
                    </Button>
                  </View>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog>
          </Card>
        </View>

        {/* Settings */}
        <View className="mb-6">
          <SettingsItemList
            sections={appSections}
            renderExtra={renderAppExtra}
          />
        </View>

        {/* Stats Summary */}
        <View className="mb-5">
          <Text variant="small" className="mb-2 tracking-wide uppercase">
            Your Stats
          </Text>
          <Card className="p-4">
            <View className="flex-row items-center justify-around p-0">
              <View className="flex-1 items-center">
                <Text className="mb-1 text-2xl font-bold">
                  {stats?.totalWorkouts ?? 0}
                </Text>
                <Text variant="muted" className="text-center text-xs">
                  Total Workouts
                </Text>
              </View>
              <Separator orientation="vertical" className="h-10" />
              <View className="flex-1 items-center">
                <Text className="mb-1 text-2xl font-bold">
                  {stats?.currentStreak ?? 0}
                </Text>
                <Text variant="muted" className="text-center text-xs">
                  Current Streak (days)
                </Text>
              </View>
              <Separator orientation="vertical" className="h-10" />
              <View className="flex-1 items-center">
                <Text className="mb-1 text-2xl font-bold">
                  {stats?.longestStreak ?? 0}
                </Text>
                <Text variant="muted" className="text-center text-xs">
                  Longest Streak (days)
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Logout Button with Confirmation Dialog */}
        <Dialog isOpen={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
          <Dialog.Trigger asChild>
            <Button variant="danger" className="mt-4 mb-8">
              <Button.Label className="text-base font-semibold">
                Log Out
              </Button.Label>
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content isSwipeable={false}>
              <Dialog.Title>Are you sure?</Dialog.Title>
              <Dialog.Description>
                You will be logged out of your account. You can sign back in
                anytime.
              </Dialog.Description>
              <View className="mt-4 flex-row justify-end gap-3">
                <Button
                  variant="outline"
                  onPress={() => setLogoutDialogOpen(false)}
                >
                  <Button.Label>Cancel</Button.Label>
                </Button>
                <Button
                  variant="danger"
                  onPress={async () => {
                    try {
                      await signOut();
                      setLogoutDialogOpen(false);
                    } catch (error) {
                      console.error('Logout error:', error);
                    }
                  }}
                >
                  <Button.Label>Log Out</Button.Label>
                </Button>
              </View>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      </View>
    </ScrollView>
  );
}
