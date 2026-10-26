import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export function ScreenPlaceholder({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <Text variant="titleLarge">{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
