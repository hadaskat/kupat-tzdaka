import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RoleGuard } from '../../src/components/RoleGuard';
import { TopNav, type NavItem } from '../../src/components/layout/TopNav';
import { useIsWide } from '../../src/components/layout/Screen';
import { palette } from '../../src/theme';

export default function ClientLayout() {
  const { t } = useTranslation();
  const isWide = useIsWide();

  const navItems: NavItem[] = [
    { label: t('client.home'), href: '/home' },
    { label: t('client.myDonations'), href: '/my-donations' },
    { label: t('client.myRequests'), href: '/requests', match: ['/requests'] },
    { label: t('client.profile'), href: '/profile' },
  ];

  return (
    <RoleGuard role="client">
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
            name="home"
            options={{
              title: t('client.home'),
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="home" color={color} size={size} />
              ),
            }}
          />
          {/* Donating uses the same public /donate screen as a guest would - it
              simply prefills the signed-in donor's details. */}
          <Tabs.Screen
            name="my-donations"
            options={{
              title: t('client.myDonations'),
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="history" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="requests"
            options={{
              title: t('client.myRequests'),
              // The nested Stack draws the header for this section.
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="clipboard-text" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t('client.profile'),
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="account" color={color} size={size} />
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
