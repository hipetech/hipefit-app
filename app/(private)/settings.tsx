import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { useUserStore } from '@/features/user/store/use-user-store';
import { capitalize, getInitials } from '@/lib/format';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import { Separator } from '@/ui/separator';
import { Skeleton } from '@/ui/skeleton';
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
          <Text variant="small" className="mb-2 uppercase tracking-wide">
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
              updateSettings({
                theme: val.value as 'light' | 'dark' | 'system',
              });
            }
          }}
        >
          <SelectTrigger className="mt-1 w-[120px] py-1">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system" label="System">
              <Text>System</Text>
            </SelectItem>
            <SelectItem value="light" label="Light">
              <Text>Light</Text>
            </SelectItem>
            <SelectItem value="dark" label="Dark">
              <Text>Dark</Text>
            </SelectItem>
          </SelectContent>
        </Select>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-muted">
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
    <ScrollView className="flex-1 bg-muted">
      <View className="p-4 pt-12">
        {/* Profile Header with Avatar */}
        <View className="mb-6">
          <Card className="p-4">
            <View className="flex-row items-center">
              <Avatar className="mr-4 h-[70px] w-[70px]" alt="Profile Picture">
                {photoURL ? <AvatarImage source={{ uri: photoURL }} /> : null}
                <AvatarFallback>
                  <Text className="text-2xl">
                    {displayName ? getInitials(displayName) : '?'}
                  </Text>
                </AvatarFallback>
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
            <Dialog
              open={profileDialogOpen}
              onOpenChange={setProfileDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="mt-3"
                  onPress={openProfileDialog}
                >
                  <Text>Edit Profile</Text>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Profile</DialogTitle>
                  <DialogDescription>
                    Update your profile information
                  </DialogDescription>
                </DialogHeader>
                <View className="gap-4">
                  <View className="gap-2">
                    <Label>
                      <Text>Name</Text>
                    </Label>
                    <Input
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Enter your name"
                    />
                  </View>
                </View>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onPress={() => setProfileDialogOpen(false)}
                  >
                    <Text>Cancel</Text>
                  </Button>
                  <Button onPress={saveProfile}>
                    <Text>Save</Text>
                  </Button>
                </DialogFooter>
              </DialogContent>
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
          <Text variant="small" className="mb-2 uppercase tracking-wide">
            Your Stats
          </Text>
          <Card className="p-4">
            <CardContent className="flex-row items-center justify-around p-0">
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
            </CardContent>
          </Card>
        </View>

        {/* Logout Button with Alert Dialog */}
        <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mb-8 mt-4">
              <Text className="text-base font-semibold text-white">
                Log Out
              </Text>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                You will be logged out of your account. You can sign back in
                anytime.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Text>Cancel</Text>
              </AlertDialogCancel>
              <AlertDialogAction
                onPress={async () => {
                  try {
                    await signOut();
                    setLogoutDialogOpen(false);
                  } catch (error) {
                    console.error('Logout error:', error);
                  }
                }}
              >
                <Text className="text-white">Log Out</Text>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </View>
    </ScrollView>
  );
}
