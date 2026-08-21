import { Stack } from 'expo-router';

import { EditProfileForm } from '@/features/settings/edit-profile-form';

/**
 * Edit Profile route, presented as a form sheet (see `_layout.tsx`). Thin by
 * design: the form is a platform-split island that owns its own Host on iOS.
 */
export default function EditProfile() {
  return (
    <>
      <EditProfileForm />
      <Stack.Screen.Title>Edit Profile</Stack.Screen.Title>
    </>
  );
}
