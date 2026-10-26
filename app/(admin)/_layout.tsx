import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RoleGuard } from '../../src/components/RoleGuard';
import { usePendingDonations } from '../../src/api/imports';
import { TopNav, type NavItem } from '../../src/components/layout/TopNav';
import { useIsWide } from '../../src/components/layout/Screen';
import { palette } from '../../src/theme';

export default function AdminLayout() {
  const { t } = useTranslation();
  const { donations: pending } = usePendingDonations();
  const isWide = useIsWide();

  const navItems: NavItem[] = [
    { label: t('admin.dashboard'), href: '/dashboard' },
    { label: 'ממתינות', href: '/pending', badge: pending.length },
    { label: t('admin.funds'), href: '/funds', match: ['/funds'] },
    { label: t('admin.requests'), href: '/requests', match: ['/requests'] },
    { label: 'כרטסת', href: '/people', match: ['/people'] },
    { label: 'הגדרות', href: '/settings' },
  ];

  // Wide screens get a desktop top bar; a bottom tab bar there reads as a
  // phone UI. Narrow screens keep the tab bar and drop the top nav.
  return (
    <RoleGuard role="superAdmin">
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
            name="dashboard"
            options={{
              title: t('admin.dashboard'),
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="view-dashboard" color={color} size={size} />
              ),
            }}
          />
          {/* The daily job: money is in the system but not yet in the books. */}
          <Tabs.Screen
            name="pending"
            options={{
              title: 'ממתינות',
              tabBarBadge: pending.length > 0 ? pending.length : undefined,
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="inbox-arrow-down" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="funds"
            options={{
              title: t('admin.funds'),
              // The nested Stack draws the header for this section.
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="cash-multiple" color={color} size={size} />
              ),
            }}
          />
          {/* Periodic rather than daily - reached from the settings menu. */}
          <Tabs.Screen
            name="import"
            options={{ title: t('admin.import'), href: null, headerShown: false }}
          />
          <Tabs.Screen
            name="requests"
            options={{
              title: t('admin.requests'),
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="clipboard-text-clock" color={color} size={size} />
              ),
            }}
          />
          {/* One unified card per person - the same human is often both a donor
              and a beneficiary (spec §4.7). */}
          <Tabs.Screen
            name="people"
            options={{
              title: 'כרטסת',
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="card-account-details" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'הגדרות',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="cog" color={color} size={size} />
              ),
            }}
          />
          {/* Reached from the settings menu - ten tab bar items would be
              unusable on a phone. */}
          <Tabs.Screen name="organization" options={{ title: 'הגדרות ארגון', href: null }} />
          <Tabs.Screen name="nedarim" options={{ title: 'נדרים פלוס', href: null }} />
          <Tabs.Screen name="users" options={{ title: 'ניהול משתמשים', href: null }} />
          <Tabs.Screen name="permissions" options={{ title: 'ניהול הרשאות', href: null }} />
          <Tabs.Screen name="audit" options={{ title: 'יומן ביקורת', href: null }} />
        </Tabs>
      </View>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.page },
});
