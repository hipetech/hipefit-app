import { useEffect } from 'react';
import { Redirect } from 'expo-router';

import { AuthScreen } from '@/features/auth';
import { useAuthStore } from '@/features/auth/store/use-auth-store';

export default function Login() {
  const { isLoggedIn, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  if (isLoading) {
    return null;
  }

  if (isLoggedIn) {
    return <Redirect href="/(private)" />;
  }

  return <AuthScreen />;
}
