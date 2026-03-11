import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sendDirectMessage, getConversations, getDirectMessages } from '../../src/services/api';
import { subscribeToMessages, ChatMessage } from '../../src/services/firebase/chatService';
import { useAuthStore } from '../../src/store/authStore';
import { Conversation } from '../../src/types';
import { Avatar } from '../../src/components/Avatar';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

export default function DirectMessageScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);

  // Fetch conversation details (only once)
  const fetchConversation = useCallback(async () => {
    try {
      const convResponse = await getConversations();
      const conv = convResponse.data.find((c: Conversation) => 
        c.conversation_id === conversationId || c.chat_id === conversationId
      );
      if (conv) setConversation(conv);
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  }, [conversationId]);

  // Fetch messages via REST API (fallback)
  const fetchMessagesViaAPI = useCallback(async () => {
    try {
      console.log('[Chat] Fetching messages via REST API');
      const response = await getDirectMessages(conversationId!);
      const apiMessages = response.data.map((msg: any) => ({
        id: msg.id,
        sender_id: msg.sender_id || '',
        sender_name: msg.sender_name || 'Unknown',
        sender_photo: msg.sender_photo,
        text: msg.text || msg.content || '',
        content: msg.content || msg.text || '',
        created_at: msg.created_at || msg.timestamp || '',
        timestamp: msg.timestamp || msg.created_at || '',
      }));
      setMessages(apiMessages);
      setLoading(false);
      setIsRealtime(false);
      
      // Auto-scroll
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('[Chat] Error fetching messages via API:', error);
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    // Fetch conversation details
    fetchConversation();
    
    let unsubscribe: (() => void) | null = null;
    let fallbackTimeout: NodeJS.Timeout | null = null;
    
    // Set up real-time Firestore listener for messages
    // Path: chats/{chatId}/messages
    try {
      unsubscribe = subscribeToMessages(
        conversationId!,
        (updatedMessages) => {
          console.log('[Chat] Real-time update received:', updatedMessages.length, 'messages');
          setMessages(updatedMessages);
          setLoading(false);
          setIsRealtime(true);
          
          // Clear fallback timeout if real-time is working
          if (fallbackTimeout) {
            clearTimeout(fallbackTimeout);
            fallbackTimeout = null;
          }
          
          // Auto-scroll to bottom when new message arrives
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        },
        (error) => {
          console.error('[Chat] Real-time listener error:', error);
          // Fall back to REST API
          fetchMessagesViaAPI();
        }
      );
    } catch (error) {
      console.error('[Chat] Failed to set up real-time listener:', error);
      fetchMessagesViaAPI();
    }
    
    // Fallback: If no real-time update received within 3 seconds, use REST API
    fallbackTimeout = setTimeout(() => {
      if (loading) {
        console.log('[Chat] Real-time timeout, falling back to REST API');
        fetchMessagesViaAPI();
      }
    }, 3000);

    // Cleanup: unsubscribe from Firestore listener when leaving screen
    return () => {
      console.log('[Chat] Unsubscribing from chat:', conversationId);
      if (unsubscribe) {
        unsubscribe();
      }
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
    };
  }, [conversationId, fetchConversation, fetchMessagesViaAPI, loading]);

  const handleSend = async () => {
    if (!newMessage.trim() || !conversation) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX
    setSending(true);
    
    try {
      await sendDirectMessage(conversation.user.sl_id, messageText);
      // If not real-time, fetch messages after sending
      if (!isRealtime) {
        setTimeout(() => fetchMessagesViaAPI(), 500);
      }
    } catch (error: any) {
      // Restore the message if sending failed
      setNewMessage(messageText);
      alert(error.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.sender_id === user?.id;

    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        {!isOwnMessage && (
          <Avatar name={item.sender_name} photo={item.sender_photo} size={36} />
        )}
        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {item.text || item.content}
          </Text>
          <Text style={[styles.timeText, isOwnMessage && styles.ownTimeText]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Connecting to chat...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        {conversation && (
          <>
            <Avatar name={conversation.user.name} photo={conversation.user.photo} size={40} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{conversation.user.name}</Text>
              <View style={styles.statusRow}>
                <Text style={styles.headerSubtitle}>{conversation.user.sl_id}</Text>
                {isRealtime && (
                  <View style={styles.realtimeBadge}>
                    <View style={styles.realtimeDot} />
                    <Text style={styles.realtimeText}>Live</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.emptyText}>Start your conversation</Text>
              <Text style={styles.emptySubtext}>Messages will appear in real-time</Text>
            </View>
          }
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
            placeholderTextColor={COLORS.textLight}
          />
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.textWhite} />
            ) : (
              <Ionicons name="send" size={20} color={COLORS.textWhite} />
            )}
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textSecondary,
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
  },
  headerInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.primary,
  },
  realtimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  realtimeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 4,
  },
  realtimeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4CAF50',
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderBottomLeftRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    marginLeft: SPACING.sm,
  },
  ownMessageBubble: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: BORDER_RADIUS.lg,
    borderBottomRightRadius: BORDER_RADIUS.sm,
    marginLeft: 0,
  },
  messageText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  ownMessageText: {
    color: COLORS.textWhite,
  },
  timeText: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownTimeText: {
    color: 'rgba(255,255,255,0.7)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 4,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    marginTop: SPACING.xs,
    fontSize: 12,
    color: COLORS.textLight,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: COLORS.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
