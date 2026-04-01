import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '../src/constants/theme';

export default function MantraJaapScreen() {
  const router = useRouter();
  const [jaapName, setJaapName] = useState('');
  const [timesCount, setTimesCount] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  }, []);

  const handleBack = () => {
    // Use setTimeout to ensure navigation happens after render
    setTimeout(() => {
      const canGoBack = router.canGoBack();
      if (canGoBack) {
        router.back();
      } else {
        router.replace('/(tabs)/messages' as any);
      }
    }, 100);
  };

  const handleCreateJaap = async () => {
    if (!jaapName.trim()) {
      Alert.alert('Missing Info', 'Please enter a Jaap Name');
      return;
    }
    if (!timesCount.trim()) {
      Alert.alert('Missing Info', 'Please enter how many times to chant');
      return;
    }
    if (!selectedDate.trim()) {
      Alert.alert('Missing Info', 'Please select a date');
      return;
    }

    setCreating(true);
    try {
      // Here you would call your API to create the Jaap group
      // For now, just show success
      Alert.alert(
        'Jaap Created!',
        `Your "${jaapName}" jaap for ${timesCount} times on ${selectedDate} has been created!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to create Jaap');
    } finally {
      setCreating(false);
    }
  };

  const quickDates = [
    { label: 'Today', value: new Date().toLocaleDateString('en-GB') },
    { label: 'Tomorrow', value: new Date(Date.now() + 86400000).toLocaleDateString('en-GB') },
    { label: 'Monday', value: 'Next Monday' },
    { label: 'Friday', value: 'Next Friday' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Mantra Jaap</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="sparkles" size={32} color={COLORS.primary} />
          <Text style={styles.infoTitle}>Create a Jaap Group</Text>
          <Text style={styles.infoText}>
            Start a group chanting session and invite others to join you in spiritual practice.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <Text style={styles.label}>Jaap Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Om Namah Shivaya, Hare Rama"
            placeholderTextColor={COLORS.textLight}
            value={jaapName}
            onChangeText={setJaapName}
          />

          <Text style={styles.label}>How many times?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 108, 1008, 21"
            placeholderTextColor={COLORS.textLight}
            value={timesCount}
            onChangeText={setTimesCount}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 30/03/2026"
            placeholderTextColor={COLORS.textLight}
            value={selectedDate}
            onChangeText={setSelectedDate}
          />

          {/* Quick Date Buttons */}
          <Text style={styles.quickLabel}>Quick Select:</Text>
          <View style={styles.quickDates}>
            {quickDates.map((date, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quickDateButton,
                  selectedDate === date.value && styles.quickDateButtonActive,
                ]}
                onPress={() => setSelectedDate(date.value)}
              >
                <Text
                  style={[
                    styles.quickDateText,
                    selectedDate === date.value && styles.quickDateTextActive,
                  ]}
                >
                  {date.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={handleCreateJaap}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.createButtonText}>Create Jaap Group</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info Note */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={20} color={COLORS.info} />
          <Text style={styles.noteText}>
            After creating, share the Jaap group with your community members to join the chanting session.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  infoCard: {
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  quickLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  quickDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  quickDateButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  quickDateButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}15`,
  },
  quickDateText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  quickDateTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: `${COLORS.info}10`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
