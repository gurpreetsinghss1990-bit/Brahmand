import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { createCircle } from '../../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

export default function CreateCircleScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdCircle, setCreatedCircle] = useState<any>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a circle name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await createCircle(name.trim());
      setCreatedCircle(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create circle');
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
          <Text style={styles.headerTitle}>Create Circle</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          {!createdCircle ? (
            <>
              <View style={styles.iconContainer}>
                <Ionicons name="ellipse" size={64} color={COLORS.primary} />
              </View>

              <Text style={styles.description}>
                Create a private circle for your family, friends, temple community, or any group.
              </Text>

              <Input
                label="Circle Name"
                placeholder="e.g., Family Circle, Temple Friends"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError('');
                }}
                error={error}
              />

              <Button
                title="Create Circle"
                onPress={handleCreate}
                loading={loading}
                disabled={!name.trim()}
                style={styles.button}
              />

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={COLORS.info} />
                <Text style={styles.infoText}>
                  You'll be the admin of this circle. Share the circle code with others to let them join.
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
              </View>
              <Text style={styles.successTitle}>Circle Created!</Text>
              <Text style={styles.circleName}>{createdCircle.name}</Text>

              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>Circle Code</Text>
                <Text style={styles.codeText}>{createdCircle.code}</Text>
                <Text style={styles.codeHint}>
                  Share this code with others so they can join your circle
                </Text>
              </View>

              <Button
                title="Go to Circle"
                onPress={() => {
                  router.back();
                  setTimeout(() => {
                    router.push(`/chat/circle/${createdCircle.id}`);
                  }, 100);
                }}
                style={styles.button}
              />

              <Button
                title="Close"
                onPress={() => router.back()}
                variant="outline"
                style={styles.closeButton}
              />
            </View>
          )}
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
  successContainer: {
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  circleName: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.xl,
  },
  codeCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  codeLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  codeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  codeHint: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  closeButton: {
    marginTop: SPACING.sm,
    width: '100%',
  },
});
