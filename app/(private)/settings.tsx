import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

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
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { settingsOptions } from '@/mock/settings';

export default function Settings() {
  const { signOut } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [autoPauseEnabled, setAutoPauseEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [editName, setEditName] = useState('John Doe');
  const [editEmail, setEditEmail] = useState('john.doe@example.com');
  const [selectedTheme, setSelectedTheme] = useState({
    value: 'System',
    label: 'System',
  });
  const [selectedLanguage, setSelectedLanguage] = useState({
    value: 'English',
    label: 'English',
  });

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-4 pt-12">
        {/* Profile Header with Avatar */}
        <View className="mb-6">
          <Card className="p-4">
            <View className="flex-row items-center">
              <Avatar className="mr-4 h-[70px] w-[70px]" alt="Profile Picture">
                <AvatarImage
                  source={{
                    uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
                  }}
                />
                <AvatarFallback>
                  <Text className="text-2xl">JD</Text>
                </AvatarFallback>
              </Avatar>
              <View className="flex-1">
                <Text variant="h3" className="mb-1">
                  {editName}
                </Text>
                <Text variant="muted" className="mb-1">
                  {editEmail}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Badge variant="secondary">
                    <Text variant="small">Intermediate</Text>
                  </Badge>
                  <Text variant="muted" className="text-xs">
                    Member since 2024
                  </Text>
                </View>
              </View>
              <Dialog
                open={profileDialogOpen}
                onOpenChange={setProfileDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Text>Edit</Text>
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
                    <View className="gap-2">
                      <Label>
                        <Text>Email</Text>
                      </Label>
                      <Input
                        value={editEmail}
                        onChangeText={setEditEmail}
                        placeholder="Enter your email"
                        keyboardType="email-address"
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
                    <Button onPress={() => setProfileDialogOpen(false)}>
                      <Text className="text-white">Save</Text>
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </View>
          </Card>
        </View>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="w-full">
            <TabsTrigger value="account" className="flex-1">
              <Text variant="small">Account</Text>
            </TabsTrigger>
            <TabsTrigger value="workout" className="flex-1">
              <Text variant="small">Workout</Text>
            </TabsTrigger>
            <TabsTrigger value="app" className="flex-1">
              <Text variant="small">App</Text>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-4">
            <View className="gap-5">
              {settingsOptions
                .filter((section) => section.category === 'Account')
                .map((section) => (
                  <View key={section.id}>
                    <Text
                      variant="small"
                      className="mb-2 uppercase tracking-wide"
                    >
                      {section.category}
                    </Text>
                    <Card className="overflow-hidden">
                      {section.items.map((item, index) => (
                        <View key={item.id}>
                          <Pressable
                            className="w-full flex-row items-center justify-between p-3"
                            disabled={
                              !(item.hasArrow ?? false) &&
                              !(item.hasSwitch ?? false)
                            }
                          >
                            <View className="flex-1 flex-row items-center">
                              <View className="mr-4 h-12 w-12 items-center justify-center">
                                <Text className="text-3xl">{item.icon}</Text>
                              </View>
                              <View className="flex-1">
                                <Text className="mb-0.5 text-base font-medium">
                                  {item.label}
                                </Text>
                                {item.value !== undefined && (
                                  <Text variant="muted" className="text-sm">
                                    {item.value}
                                  </Text>
                                )}
                              </View>
                            </View>
                            <View className="items-center justify-center">
                              {(item.hasSwitch ?? false) && (
                                <Switch
                                  checked={
                                    item.id === 'notifications'
                                      ? notificationsEnabled
                                      : notificationsEnabled
                                  }
                                  onCheckedChange={(value) => {
                                    if (item.id === 'notifications') {
                                      setNotificationsEnabled(value);
                                    }
                                  }}
                                />
                              )}
                              {(item.hasArrow ?? false) && (
                                <Text className="text-2xl font-light text-gray-500">
                                  ›
                                </Text>
                              )}
                            </View>
                          </Pressable>
                          {index !== section.items.length - 1 && (
                            <Separator className="mx-3" />
                          )}
                        </View>
                      ))}
                    </Card>
                  </View>
                ))}
            </View>
          </TabsContent>

          <TabsContent value="workout" className="mt-4">
            <View className="gap-5">
              {settingsOptions
                .filter((section) => section.category === 'Workout')
                .map((section) => (
                  <View key={section.id}>
                    <Text
                      variant="small"
                      className="mb-2 uppercase tracking-wide"
                    >
                      {section.category}
                    </Text>
                    <Card className="overflow-hidden">
                      {section.items.map((item, index) => (
                        <View key={item.id}>
                          <Pressable
                            className="w-full flex-row items-center justify-between p-3"
                            disabled={
                              !(item.hasArrow ?? false) &&
                              !(item.hasSwitch ?? false)
                            }
                          >
                            <View className="flex-1 flex-row items-center">
                              <View className="mr-4 h-12 w-12 items-center justify-center">
                                <Text className="text-3xl">{item.icon}</Text>
                              </View>
                            </View>
                            <View className="items-center justify-center">
                              {(item.hasSwitch ?? false) && (
                                <Switch
                                  checked={
                                    item.id === 'reminders'
                                      ? remindersEnabled
                                      : autoPauseEnabled
                                  }
                                  onCheckedChange={(value) => {
                                    if (item.id === 'reminders') {
                                      setRemindersEnabled(value);
                                    } else {
                                      setAutoPauseEnabled(value);
                                    }
                                  }}
                                />
                              )}
                              {(item.hasArrow ?? false) &&
                                item.id !== 'units' && (
                                  <Text className="text-2xl font-light text-gray-500">
                                    ›
                                  </Text>
                                )}
                            </View>
                          </Pressable>
                          {index !== section.items.length - 1 && (
                            <Separator className="mx-3" />
                          )}
                        </View>
                      ))}
                    </Card>
                  </View>
                ))}
            </View>
          </TabsContent>

          <TabsContent value="app" className="mt-4">
            <View className="gap-5">
              {settingsOptions
                .filter((section) => section.category === 'App')
                .map((section) => (
                  <View key={section.id}>
                    <Text
                      variant="small"
                      className="mb-2 uppercase tracking-wide"
                    >
                      {section.category}
                    </Text>
                    <Card className="overflow-hidden">
                      {section.items.map((item, index) => (
                        <View key={item.id}>
                          <Pressable
                            className="w-full flex-row items-center justify-between p-3"
                            disabled={!(item.hasArrow ?? false)}
                          >
                            <View className="flex-1 flex-row items-center">
                              <View className="mr-4 h-12 w-12 items-center justify-center">
                                <Text className="text-3xl">{item.icon}</Text>
                              </View>
                              <View className="flex-1">
                                <Text className="mb-0.5 text-base font-medium">
                                  {item.label}
                                </Text>
                                {item.id === 'theme' && (
                                  <Select
                                    value={selectedTheme}
                                    onValueChange={setSelectedTheme}
                                  >
                                    <SelectTrigger className="mt-1 h-8 w-[120px]">
                                      <SelectValue placeholder="Select theme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="System" label="System">
                                        <Text>System</Text>
                                      </SelectItem>
                                      <SelectItem value="Light" label="Light">
                                        <Text>Light</Text>
                                      </SelectItem>
                                      <SelectItem value="Dark" label="Dark">
                                        <Text>Dark</Text>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                                {item.id === 'language' && (
                                  <Select
                                    value={selectedLanguage}
                                    onValueChange={setSelectedLanguage}
                                  >
                                    <SelectTrigger className="mt-1 h-8 w-[120px]">
                                      <SelectValue placeholder="Select language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem
                                        value="English"
                                        label="English"
                                      >
                                        <Text>English</Text>
                                      </SelectItem>
                                      <SelectItem
                                        value="Spanish"
                                        label="Spanish"
                                      >
                                        <Text>Spanish</Text>
                                      </SelectItem>
                                      <SelectItem value="French" label="French">
                                        <Text>French</Text>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </View>
                            </View>
                            <View className="items-center justify-center">
                              {(item.hasArrow ?? false) &&
                                item.id !== 'theme' &&
                                item.id !== 'language' && (
                                  <Text className="text-2xl font-light text-gray-500">
                                    ›
                                  </Text>
                                )}
                            </View>
                          </Pressable>
                          {index !== section.items.length - 1 && (
                            <Separator className="mx-3" />
                          )}
                        </View>
                      ))}
                    </Card>
                  </View>
                ))}
            </View>
          </TabsContent>
        </Tabs>

        {/* Stats Summary with Progress */}
        <View className="mb-5">
          <Text variant="small" className="mb-2 uppercase tracking-wide">
            Your Stats
          </Text>
          <Card className="p-4">
            <CardContent className="flex-row items-center justify-around p-0">
              <View className="flex-1 items-center">
                <Text className="mb-1 text-2xl font-bold">156</Text>
                <Text variant="muted" className="text-center text-xs">
                  Total Workouts
                </Text>
                <View className="mt-2 w-full">
                  <Progress value={78} />
                </View>
              </View>
              <Separator orientation="vertical" className="h-10" />
              <View className="flex-1 items-center">
                <Text className="mb-1 text-2xl font-bold">42h</Text>
                <Text variant="muted" className="text-center text-xs">
                  Time Exercised
                </Text>
                <View className="mt-2 w-full">
                  <Progress value={65} />
                </View>
              </View>
              <Separator orientation="vertical" className="h-10" />
              <View className="flex-1 items-center">
                <Text className="mb-1 text-2xl font-bold">8.2k</Text>
                <Text variant="muted" className="text-center text-xs">
                  Calories Burned
                </Text>
                <View className="mt-2 w-full">
                  <Progress value={82} />
                </View>
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
