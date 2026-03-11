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
  Dimensions
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

const HEADER_HEIGHT = 70;

export default function DirectMessageScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);
  const [containerHeight, setContainerHeight] = useState(Dimensions.get('window').height);

  // iOS Safari viewport fix - inject CSS and handle resize
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Inject CSS to fix iOS Safari issues
      const styleId = 'ios-safari-fix';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          html, body {
            height: 100%;
            overflow: hidden;
            position: fixed;
            width: 100%;
          }
          #root {
            height: 100%;
            overflow: hidden;
          }
        `;
        document.head.appendChild(style);
      }

      // Handle visual viewport changes (iOS Safari keyboard)
      const updateHeight = () => {
        if (window.visualViewport) {
          setContainerHeight(window.visualViewport.height);
        } else {
          setContainerHeight(window.innerHeight);
        }
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);
      };

      // Initial height
      updateHeight();

      // Listen for viewport changes
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateHeight);
        window.visualViewport.addEventListener('scroll', updateHeight);
      }
      window.addEventListener('resize', updateHeight);

      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', updateHeight);
          window.visualViewport.removeEventListener('scroll', updateHeight);
        }
        window.removeEventListener('resize', updateHeight);
      };
    } else {
      // Native keyboard handling
      const showSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        () => {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      );
      return () => showSub.remove();
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

    return () => {
      if (unsubscribe) unsubscribe();
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [conversationId, fetchConversation, fetchMessagesViaAPI]);

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

  // Calculate heights
  const safeTop = insets.top || (Platform.OS === 'web' ? 0 : 44);
  const safeBottom = insets.bottom || (Platform.OS === 'web' ? 0 : 34);
  const inputHeight = 60 + safeBottom;
  const availableHeight = Platform.OS === 'web' 
    ? containerHeight 
    : Dimensions.get('window').height;
  const messagesHeight = availableHeight - safeTop - HEADER_HEIGHT - inputHeight;

  return (
    <View style={[
      styles.container,
      Platform.OS === 'web' && { height: containerHeight, maxHeight: containerHeight }
    ]}>
      {/* Safe area top padding */}
      <View style={{ height: safeTop, backgroundColor: COLORS.surface }} />
      
      {/* Header */}
      <View style={[styles.header, { height: HEADER_HEIGHT }]}>
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

      {/* Messages - Fixed height container */}
      <View style={{ height: messagesHeight, flex: 0 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.emptyText}>Start your conversation</Text>
            </View>
          }
        />
      </View>

      {/* Input - Fixed at bottom */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(safeBottom, 8) }]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
          placeholderTextColor={COLORS.textLight}
          onFocus={() => {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
          }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    ...(Platform.OS === 'web' ? {
      overflow: 'hidden' as const,
      display: 'flex' as const,
      flexDirection: 'column' as const,
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
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
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
    fontSize: 16, // 16px prevents iOS Safari zoom
    color: COLORS.text,
    maxHeight: 100,
    minHeight: 40,
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
