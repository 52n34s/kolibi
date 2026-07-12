import { Href, Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '@/stores/auth-store';

export default function Index() {
  const session = useAuthStore((state) => state.session);
  const isOnboarded = useAuthStore((state) => state.isOnboarded);

  if (session && isOnboarded === null) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <Redirect href={'/(auth)/login' as Href} />;
  }

  if (!isOnboarded) {
    return <Redirect href={{ pathname: '/onboarding', params: {} } as Href} />;
  }

  return <Redirect href={'/home' as Href} />;
}
