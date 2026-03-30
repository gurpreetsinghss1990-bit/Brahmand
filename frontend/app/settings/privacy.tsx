import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import api from '../../src/services/api';

interface PrivacySettings {
  read_receipts: boolean;
  online_status: boolean;
  profile_photo: string;
}

export default function PrivacySettingsScreen() {
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

  const [settings, setSettings] = useState<PrivacySettings>({
    read_receipts: true,
    online_status: true,
    profile_photo: 'everyone',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/user/privacy-settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching privacy settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof PrivacySettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setSaving(true);

    try {
      await api.put('/user/privacy-settings', newSettings);
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      // Revert on error
      setSettings(settings);
      Alert.alert('Error', 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        {saving && <ActivityIndicator size="small" color={COLORS.primary} />}
      </View>

      {/* Settings */}
      <View style={styles.content}>
        {/* Read Receipts */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Messages</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIconContainer}>
                <Ionicons name="checkmark-done" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Read Receipts</Text>
                <Text style={styles.settingDescription}>
                  When enabled, senders will see double ticks when you have read their messages
                </Text>
              </View>
            </View>
            <Switch
              value={settings.read_receipts}
              onValueChange={(value) => updateSetting('read_receipts', value)}
              trackColor={{ false: COLORS.divider, true: `${COLORS.primary}80` }}
              thumbColor={settings.read_receipts ? COLORS.primary : '#f4f3f4'}
            />
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={16} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>
              If you turn off read receipts, you will not be able to see read receipts from others.
            </Text>
          </View>
        </View>

        {/* Online Status */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Activity</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIconContainer}>
                <Ionicons name="ellipse" size={20} color="#4CAF50" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Online Status</Text>
                <Text style={styles.settingDescription}>
                  Show when you are active on Sanatan Lok
                </Text>
              </View>
            </View>
            <Switch
              value={settings.online_status}
              onValueChange={(value) => updateSetting('online_status', value)}
              trackColor={{ false: COLORS.divider, true: `${COLORS.primary}80` }}
              thumbColor={settings.online_status ? COLORS.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Status Indicators Legend */}
        <View style={styles.legendSection}>
          <Text style={styles.sectionTitle}>Message Status Guide</Text>
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <Ionicons name="checkmark" size={18} color={COLORS.textSecondary} />
              <Text style={styles.legendText}>Single tick = Message delivered</Text>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="checkmark-done" size={18} color={COLORS.primary} />
              <Text style={styles.legendText}>Double tick = Message read</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backButton: {
    marginRight: SPACING.md,
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  settingSection: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  settingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  settingDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
    lineHeight: 18,
  },
  legendSection: {
    marginTop: SPACING.md,
  },
  legendContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  legendText: {
    fontSize: 14,
    color: COLORS.text,
    marginLeft: SPACING.md,
  },
});
