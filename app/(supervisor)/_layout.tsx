import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RoleGuard } from '../../src/components/RoleGuard';
import { TopNav, type NavItem } from '../../src/components/layout/TopNav';
import { useIsWide } from '../../src/components/layout/Screen';
import { palette } from '../../src/theme';

export default function SupervisorLayout() {
  const isWide = useIsWide();

  const navItems: NavItem[] = [
    { label: 'הקרנות שלי', href: '/overview' },
    { label: 'יומן ביקורת', href: '/fund-audit' },
    { label: 'הגדרות', href: '/my-settings' },
  ];

  return (
    <RoleGuard role="fundManager">
      {/* Route names are deliberately distinct from the admin group's:
          Expo Router shares one URL space across groups, so a second
          "dashboard"/"audit"/"settings" would collide. */}
      <View style={styles.root}>
        {isWide && <TopNav items={navItems} brand="קופת צדקה" />}
        <Tabs
          screenOptions={{
            headerShown: !isWide,
            tabBarStyle: isWide ? { display: 'none' } : undefined,
            sceneStyle: { backgroundColor: palette.page },
          }}
        >
          <Tabs.Screen
            name="overview"
            options={{
              title: 'הקרנות שלי',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="eye-outline" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="fund-audit"
            options={{
              title: 'יומן ביקורת',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="clipboard-list-outline" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="my-settings"
            options={{
              title: 'הגדרות',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="cog" color={color} size={size} />
              ),
            }}
          />
        </Tabs>
      </View>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.page },
});
