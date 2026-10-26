import { View, StyleSheet } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { Redirect } from 'expo-router';
import { AccountSettings } from '../src/components/AccountSettings';
import { useAuth } from '../src/hooks/useAuth';

/**
 * Shared by all three roles - kept at the root rather than duplicated inside
 * each route group, since groups share one URL space and a second "account"
 * route would collide.
 */
export default function Account() {
  const { initializing, isAuthenticated } = useAuth();

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

  return <AccountSettings />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
