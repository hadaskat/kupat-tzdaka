import { Stack } from 'expo-router';
import { useIsWide } from '../../../../src/components/layout/Screen';

export default function FundDetailLayout() {
  const isWide = useIsWide();

  return (
    <Stack screenOptions={{ headerShown: !isWide }}>
      <Stack.Screen name="index" options={{ title: 'קרן' }} />
      <Stack.Screen name="edit" options={{ title: 'עריכת פרטי הקרן' }} />
      <Stack.Screen name="add-donation" options={{ title: 'הוספת תרומה' }} />
      <Stack.Screen name="transactions" options={{ title: 'תנועות הקרן' }} />
    </Stack>
  );
}
