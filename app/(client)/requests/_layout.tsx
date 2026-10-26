import { Stack } from 'expo-router';
import { useIsWide } from '../../../src/components/layout/Screen';

export default function ClientRequestsLayout() {
  const isWide = useIsWide();

  return (
    <Stack screenOptions={{ headerShown: !isWide }}>
      <Stack.Screen name="index" options={{ title: 'הבקשות שלי' }} />
      <Stack.Screen name="new" options={{ title: 'בקשה חדשה' }} />
      <Stack.Screen name="[requestId]" options={{ title: 'פרטי הבקשה' }} />
    </Stack>
  );
}
