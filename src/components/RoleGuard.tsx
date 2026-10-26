import type { PropsWithChildren } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { Redirect } from 'expo-router';
import { useAuth, homeRouteForRole } from '../hooks/useAuth';
import type { UserRole } from '../types/models';

export function RoleGuard({ role, children }: PropsWithChildren<{ role: UserRole }>) {
  const { initializing, isAuthenticated, role: currentRole } = useAuth();

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (currentRole !== role) {
    return <Redirect href={homeRouteForRole(currentRole) as never} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
