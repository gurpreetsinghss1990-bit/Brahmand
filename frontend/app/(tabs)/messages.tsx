import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getConversations } from '../../src/services/api';
import { Conversation } from '../../src/types';
import { Avatar } from '../../src/components/Avatar';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

// Extended conversation type with status
interface ConversationWithStatus extends Conversation {
  last_message_status?: 'delivered' | 'read';
  last_message_sender_id?: string;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await getConversations();
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Message status indicator component
  const MessageStatus = ({ status, isSentByMe }: { status?: string; isSentByMe: boolean }) => {
    if (!isSentByMe) return null;
    
    if (status === 'read') {
      return <Ionicons name="checkmark-done" size={16} color={COLORS.primary} style={styles.statusIcon} />;
    }
    return <Ionicons name="checkmark" size={16} color={COLORS.textLight} style={styles.statusIcon} />;
  };

  const renderConversation = ({ item }: { item: ConversationWithStatus }) => {
    // Check if the last message was sent by current user
    const isSentByMe = item.last_message_sender_id === user?.id;
    
    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => router.push(`/dm/${item.conversation_id || item.chat_id}`)}
        activeOpacity={0.7}
      >
        <Avatar name={item.user.name} photo={item.user.photo} size={50} />
        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={styles.userName}>{item.user.name}</Text>
            {item.last_message_at && (
              <Text style={styles.timeText}>{formatTime(item.last_message_at)}</Text>
            )}
          </View>
          <Text style={styles.slId}>{item.user.sl_id}</Text>
          {item.last_message && (
            <View style={styles.lastMessageRow}>
              {isSentByMe && (
                <MessageStatus status={item.last_message_status} isSentByMe={true} />
              )}
              <Text style={styles.lastMessage} numberOfLines={1}>
                {isSentByMe ? 'You: ' : ''}{item.last_message}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* New Message Button */}
      <TouchableOpacity
        style={styles.newMessageButton}
        onPress={() => router.push('/dm/new')}
      >
        <Ionicons name="create" size={20} color={COLORS.textWhite} />
        <Text style={styles.newMessageText}>New Message</Text>
      </TouchableOpacity>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>No Messages Yet</Text>
          <Text style={styles.emptyText}>
            Start a conversation by entering someone's Sanatan Lok ID
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.conversation_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
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
  newMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
  },
  newMessageText: {
    color: COLORS.textWhite,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  listContent: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  conversationInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  timeText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  slId: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  lastMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    flex: 1,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusIcon: {
    marginRight: 4,
  },
  separator: {
    height: SPACING.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
