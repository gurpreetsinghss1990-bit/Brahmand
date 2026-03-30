import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

function NotificationsSettingsScreen() {
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.replace('/profile');
  }, [router]);

  useEffect(() => {
    const backAction = () => {
      handleBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [handleBack]);

  const [receivePush, setReceivePush] = useState(true);
  const [receiveEmail, setReceiveEmail] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Push Notifications</Text>
          <Switch
            value={receivePush}
            onValueChange={setReceivePush}
            trackColor={{ false: COLORS.divider, true: `${COLORS.primary}80` }}
            thumbColor={receivePush ? COLORS.primary : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Email Notifications</Text>
          <Switch
            value={receiveEmail}
            onValueChange={setReceiveEmail}
            trackColor={{ false: COLORS.divider, true: `${COLORS.primary}80` }}
            thumbColor={receiveEmail ? COLORS.primary : '#f4f3f4'}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default NotificationsSettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    padding: SPACING.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  settingLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
});
