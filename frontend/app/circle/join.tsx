import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { joinCircle } from '../../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

export default function JoinCircleScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleJoin = async () => {
    if (!code.trim()) {
      setMessage({ type: 'error', text: 'Please enter a circle code' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await joinCircle(code.trim());
      setMessage({ type: 'success', text: `Request sent to join ${response.data.circle}!` });
      setCode('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to join circle' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Circle</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="enter" size={64} color={COLORS.primary} />
          </View>

          <Text style={styles.description}>
            Enter the circle code shared by the admin to request to join their circle.
          </Text>

          <Input
            label="Circle Code"
            placeholder="e.g., FAMILY123"
            value={code}
            onChangeText={(text) => {
              setCode(text.toUpperCase());
              setMessage({ type: '', text: '' });
            }}
            autoCapitalize="characters"
          />

          {message.text ? (
            <Text style={[styles.message, message.type === 'error' ? styles.errorText : styles.successText]}>
              {message.text}
            </Text>
          ) : null}

          <Button
            title="Request to Join"
            onPress={handleJoin}
            loading={loading}
            disabled={!code.trim()}
            style={styles.button}
          />

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={COLORS.info} />
            <Text style={styles.infoText}>
              The circle admin will review your request. Once approved, you'll be able to access the circle.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 20,
  },
  message: {
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.error,
  },
  successText: {
    color: COLORS.success,
  },
  button: {
    marginTop: SPACING.lg,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.info}15`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.xl,
  },
  infoText: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 13,
    color: COLORS.info,
    lineHeight: 18,
  },
});
