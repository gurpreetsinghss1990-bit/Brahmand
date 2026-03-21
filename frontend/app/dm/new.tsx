import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { searchUserBySLId, sendDirectMessage } from '../../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { Avatar } from '../../src/components/Avatar';

export default function NewDMScreen() {
  const router = useRouter();
  const [slId, setSlId] = useState('');
  const [message, setMessage] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!slId.trim()) return;

    setSearching(true);
    setError('');
    setFoundUser(null);

    try {
      const response = await searchUserBySLId(slId.trim());
      setFoundUser(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'User not found');
    } finally {
      setSearching(false);
    }
  };

  const handleSend = async () => {
    if (!foundUser || !message.trim()) return;

    setSending(true);
    try {
      const response = await sendDirectMessage(foundUser.sl_id, message.trim());
      // Navigate to the chat conversation
      router.replace(`/dm/${response.data.chat_id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send message');
      setSending(false);
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
          <Text style={styles.headerTitle}>New Message</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          {/* Search Section */}
          <Text style={styles.label}>Enter Sanatan Lok ID</Text>
          <View style={styles.searchRow}>
            <View style={styles.searchInput}>
              <Input
                placeholder="e.g., SL-458921"
                value={slId}
                onChangeText={(text) => {
                  setSlId(text.toUpperCase());
                  setFoundUser(null);
                  setError('');
                }}
                autoCapitalize="characters"
              />
            </View>
            <TouchableOpacity
              style={[styles.searchButton, !slId.trim() && styles.searchButtonDisabled]}
              onPress={handleSearch}
              disabled={!slId.trim() || searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color={COLORS.textWhite} />
              ) : (
                <Ionicons name="search" size={20} color={COLORS.textWhite} />
              )}
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Found User */}
          {foundUser && (
            <View style={styles.userCard}>
              <Avatar name={foundUser.name} photo={foundUser.photo} size={50} />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{foundUser.name}</Text>
                <Text style={styles.userSlId}>{foundUser.sl_id}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            </View>
          )}

          {/* Message Input */}
          {foundUser && (
            <View style={styles.messageSection}>
              <Input
                label="Message"
                placeholder="Type your message..."
                value={message}
                onChangeText={setMessage}
                multiline
                style={styles.messageInput}
              />
              <Button
                title="Send Message"
                onPress={handleSend}
                loading={sending}
                disabled={!message.trim()}
              />
            </View>
          )}

          {/* Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={COLORS.info} />
            <Text style={styles.infoText}>
              You can only message someone if you have their Sanatan Lok ID. This ensures privacy and prevents spam.
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  searchInput: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  searchButton: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  error: {
    color: COLORS.error,
    marginTop: SPACING.sm,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.lg,
  },
  userInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  userSlId: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  messageSection: {
    marginTop: SPACING.lg,
  },
  messageInput: {
    height: 100,
    textAlignVertical: 'top',
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
