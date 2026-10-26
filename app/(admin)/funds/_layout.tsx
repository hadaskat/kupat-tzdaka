import { Stack } from 'expo-router';
import { useIsWide } from '../../../src/components/layout/Screen';

export default function FundsLayout() {
  // Wide screens navigate via the top bar and each screen draws its own title,
  // so a navigator header there is duplication; narrow screens still need it.
  const isWide = useIsWide();

  return (
    <Stack screenOptions={{ headerShown: !isWide }}>
      <Stack.Screen name="index" options={{ title: 'קרנות' }} />
      <Stack.Screen name="new" options={{ title: 'קרן חדשה' }} />
      {/* [fundId] is itself a Stack that draws its own header - showing one
          here too would give every screen two headers and two back buttons. */}
      <Stack.Screen name="[fundId]" options={{ headerShown: false }} />
    </Stack>
  );
}
