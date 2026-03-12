import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { createCircle } from '../../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

type PrivacyType = 'private' | 'invite_code';

export default function CreateCircleScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyType>('private');
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
      const response = await createCircle({
        name: name.trim(),
        description: description.trim() || undefined,
        privacy
      });
      setCreatedCircle(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create circle');
    } finally {
      setLoading(false);
    }
  };

  const PrivacyOption = ({ value, title, subtitle, icon }: { value: PrivacyType; title: string; subtitle: string; icon: string }) => (
    <TouchableOpacity
      style={[styles.privacyOption, privacy === value && styles.privacyOptionSelected]}
      onPress={() => setPrivacy(value)}
      activeOpacity={0.7}
    >
      <View style={[styles.privacyIcon, privacy === value && styles.privacyIconSelected]}>
        <Ionicons name={icon as any} size={24} color={privacy === value ? COLORS.textWhite : COLORS.textSecondary} />
      </View>
      <View style={styles.privacyContent}>
        <Text style={[styles.privacyTitle, privacy === value && styles.privacyTitleSelected]}>{title}</Text>
        <Text style={styles.privacySubtitle}>{subtitle}</Text>
      </View>
      {privacy === value && (
        <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
      )}
    </TouchableOpacity>
  );

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

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {!createdCircle ? (
            <>
              <View style={styles.iconContainer}>
                <Ionicons name="ellipse" size={64} color={COLORS.primary} />
              </View>

              <Text style={styles.description}>
                Create a private circle for your family, friends, temple community, or any group.
              </Text>

              <Input
                label="Circle Name *"
                placeholder="e.g., Family Circle, Temple Friends"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError('');
                }}
                error={error}
              />

              <Input
                label="Description (Optional)"
                placeholder="What is this circle about?"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.sectionTitle}>Privacy Settings</Text>

              <PrivacyOption
                value="private"
                title="Private"
                subtitle="Members need admin approval to join"
                icon="lock-closed"
              />

              <PrivacyOption
                value="invite_code"
                title="Invite Code"
                subtitle="Anyone with the code can join directly"
                icon="key"
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

              {createdCircle.description && (
                <Text style={styles.circleDescription}>{createdCircle.description}</Text>
              )}

              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>Circle Code</Text>
                <Text style={styles.codeText}>{createdCircle.code}</Text>
                <Text style={styles.codeHint}>
                  Share this code with others so they can join your circle
                </Text>
              </View>

              <View style={styles.privacyBadge}>
                <Ionicons 
                  name={createdCircle.privacy === 'private' ? 'lock-closed' : 'key'} 
                  size={16} 
                  color={COLORS.textSecondary} 
                />
                <Text style={styles.privacyBadgeText}>
                  {createdCircle.privacy === 'private' ? 'Private - Approval required' : 'Open - Code join allowed'}
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
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  privacyOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  privacyIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  privacyIconSelected: {
    backgroundColor: COLORS.primary,
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  privacyTitleSelected: {
    color: COLORS.primary,
  },
  privacySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
    marginBottom: SPACING.xs,
  },
  circleDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  codeCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
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
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.lg,
  },
  privacyBadgeText: {
    marginLeft: SPACING.xs,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  closeButton: {
    marginTop: SPACING.sm,
    width: '100%',
  },
});
