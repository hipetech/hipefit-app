import { useEffect } from 'react';
import { Redirect } from 'expo-router';

import { useAuthStore } from '@/features/auth/store/use-auth-store';

export default function Index() {
  const { isLoggedIn, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  if (isLoading) {
    return null;
  }

  if (isLoggedIn) {
    return <Redirect href="/(private)/(home)" />;
  }

  return <Redirect href="/(public)/login" />;
}
