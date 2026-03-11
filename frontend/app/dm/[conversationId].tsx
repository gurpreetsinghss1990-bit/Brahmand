import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  Platform, 
  ActivityIndicator,
  Keyboard,
  Dimensions,
  KeyboardAvoidingView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sendDirectMessage, getConversations, getDirectMessages } from '../../src/services/api';
import { subscribeToMessages, ChatMessage } from '../../src/services/firebase/chatService';
import { useAuthStore } from '../../src/store/authStore';
import { Conversation } from '../../src/types';
import { Avatar } from '../../src/components/Avatar';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import api from '../../src/services/api';

export default function DirectMessageScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);
  const [viewHeight, setViewHeight] = useState(Dimensions.get('window').height);
  const [hasMarkedRead, setHasMarkedRead] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // Mark messages as read when opening chat
  const markMessagesAsRead = useCallback(async () => {
    if (!conversationId || hasMarkedRead) return;
    
    try {
      await api.post(`/dm/${conversationId}/read`);
      setHasMarkedRead(true);
      console.log('[Chat] Messages marked as read');
    } catch (error) {
      console.error('[Chat] Error marking messages as read:', error);
    }
  }, [conversationId, hasMarkedRead]);

  // Handle viewport resize for iOS Safari keyboard
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // iOS Safari specific viewport handling
      const handleViewportResize = () => {
        if (window.visualViewport) {
          const newHeight = window.visualViewport.height;
          const offset = window.innerHeight - newHeight;
          setViewHeight(newHeight);
          setKeyboardOffset(offset > 50 ? offset : 0);
          // Scroll to bottom when keyboard opens
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        }
      };

      const handleResize = () => {
        if (window.visualViewport) {
          setViewHeight(window.visualViewport.height);
        } else {
          setViewHeight(window.innerHeight);
        }
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      };

      // Initial setup
      handleResize();
      
      // Listen to visual viewport changes (iOS Safari)
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleViewportResize);
        window.visualViewport.addEventListener('scroll', handleViewportResize);
      }
      window.addEventListener('resize', handleResize);

      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleViewportResize);
          window.visualViewport.removeEventListener('scroll', handleViewportResize);
        }
        window.removeEventListener('resize', handleResize);
      };
    } else {
      // Native keyboard handling
      const showSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        (e) => {
          setKeyboardOffset(e.endCoordinates.height);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      );
      const hideSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        () => setKeyboardOffset(0)
      );
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }
  }, []);

  // Fetch conversation details
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

  // Fetch messages via REST API
  const fetchMessagesViaAPI = useCallback(async () => {
    try {
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
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (error) {
      console.error('[Chat] Error fetching messages:', error);
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchConversation();
    fetchMessagesViaAPI();
    
    let unsubscribe: (() => void) | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let realtimeWorking = false;
    
    try {
      unsubscribe = subscribeToMessages(
        conversationId!,
        (updatedMessages) => {
          setMessages(updatedMessages);
          setLoading(false);
          setIsRealtime(true);
          realtimeWorking = true;
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          // Mark messages as read when received
          markMessagesAsRead();
        },
        () => {
          if (!pollingInterval) {
            pollingInterval = setInterval(fetchMessagesViaAPI, 2000);
          }
        }
      );
    } catch (error) {
      console.error('[Chat] Real-time setup failed:', error);
    }
    
    setTimeout(() => {
      if (!realtimeWorking && !pollingInterval) {
        pollingInterval = setInterval(fetchMessagesViaAPI, 2000);
      }
    }, 3000);

    // Mark messages as read after initial load
    setTimeout(() => markMessagesAsRead(), 1000);

    return () => {
      if (unsubscribe) unsubscribe();
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [conversationId, fetchConversation, fetchMessagesViaAPI, markMessagesAsRead]);

  const handleSend = async () => {
    if (!newMessage.trim() || !conversation) return;
    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);
    
    try {
      await sendDirectMessage(conversation.user.sl_id, messageText);
      setTimeout(() => fetchMessagesViaAPI(), 300);
    } catch (error: any) {
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

  // Message status indicator component
  const MessageStatus = ({ status, isOwn }: { status?: string; isOwn: boolean }) => {
    if (!isOwn) return null;
    
    const color = isOwn ? 'rgba(255,255,255,0.7)' : COLORS.textLight;
    
    if (status === 'read') {
      // Double tick (read)
      return (
        <View style={styles.statusContainer}>
          <Ionicons name="checkmark-done" size={14} color={color} />
        </View>
      );
    }
    
    // Single tick (delivered)
    return (
      <View style={styles.statusContainer}>
        <Ionicons name="checkmark" size={14} color={color} />
      </View>
    );
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
          <View style={styles.messageFooter}>
            <Text style={[styles.timeText, isOwnMessage && styles.ownTimeText]}>
              {formatTime(item.created_at)}
            </Text>
            <MessageStatus status={(item as any).status} isOwn={isOwnMessage} />
          </View>
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

  const bottomPadding = Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 8);

  // Calculate container style based on platform
  const containerStyle = Platform.OS === 'web' 
    ? [styles.container, { height: viewHeight, maxHeight: viewHeight }]
    : styles.container;

  const renderContent = () => (
    <>
      {/* Safe area top */}
      <View style={{ height: insets.top, backgroundColor: COLORS.surface }} />
      
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

      {/* Messages - takes remaining space */}
      <View style={styles.messagesWrapper}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.emptyText}>Start your conversation</Text>
            </View>
          }
        />
      </View>

      {/* Input - anchored at bottom */}
      <View style={[styles.inputContainer, { paddingBottom: bottomPadding }]}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
          placeholderTextColor={COLORS.textLight}
          onFocus={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300)}
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
    </>
  );

  // For web, use direct height-controlled container
  if (Platform.OS === 'web') {
    return (
      <View style={containerStyle}>
        {renderContent()}
      </View>
    );
  }

  // For native, use KeyboardAvoidingView
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {renderContent()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    display: 'flex',
    flexDirection: 'column',
    ...(Platform.OS === 'web' ? {
      position: 'absolute' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
    } : {}),
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
    flexShrink: 0,
  },
  backButton: {
    marginRight: SPACING.md,
    padding: 4,
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
  messagesWrapper: {
    flex: 1,
    overflow: 'hidden',
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
  },
  ownTimeText: {
    color: 'rgba(255,255,255,0.7)',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  statusContainer: {
    marginLeft: 2,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    flexShrink: 0,
    minHeight: 60,
    maxHeight: 60,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
    height: 44,
    maxHeight: 44,
    minHeight: 44,
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
