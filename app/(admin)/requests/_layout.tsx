import { Stack } from 'expo-router';
import { useIsWide } from '../../../src/components/layout/Screen';

export default function AdminRequestsLayout() {
  const isWide = useIsWide();

  return (
    <Stack screenOptions={{ headerShown: !isWide }}>
      <Stack.Screen name="index" options={{ title: 'בקשות תמיכה' }} />
      <Stack.Screen name="[requestId]" options={{ title: 'פרטי הבקשה' }} />
    </Stack>
  );
}
