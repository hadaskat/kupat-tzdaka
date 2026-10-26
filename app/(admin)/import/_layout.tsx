import { Stack } from 'expo-router';
import { useIsWide } from '../../../src/components/layout/Screen';

export default function ImportLayout() {
  const isWide = useIsWide();

  return (
    <Stack screenOptions={{ headerShown: !isWide }}>
      <Stack.Screen name="index" options={{ title: 'ייבוא נתונים' }} />
      <Stack.Screen name="[importId]" options={{ title: 'סקירת ייבוא' }} />
    </Stack>
  );
}
