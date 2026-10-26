import { Stack } from 'expo-router';
import { useIsWide } from '../../../src/components/layout/Screen';

export default function PeopleLayout() {
  const isWide = useIsWide();

  return (
    <Stack screenOptions={{ headerShown: !isWide }}>
      <Stack.Screen name="index" options={{ title: 'כרטסת' }} />
      <Stack.Screen name="new" options={{ title: 'רשומה חדשה' }} />
      <Stack.Screen name="[personId]" options={{ title: 'כרטיס' }} />
    </Stack>
  );
}
