import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getCommunity, getCommunityMessages, sendCommunityMessage, createHelpRequest } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { Avatar } from '../../src/components/Avatar';
import { RequestFormModal } from '../../src/components/RequestFormModal';

const TABS = ['Chat', 'Help', 'Blood', 'Medical', 'Financial', 'Petition'];

interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  sender_photo?: string;
  created_at: string;
  message_type?: string;
}

interface Community {
  id: string;
  name: string;
  member_count: number;
  code: string;
}

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);
  
  const [community, setCommunity] = useState<Community | null>(null);
  const [activeTab, setActiveTab] = useState('Chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<'Help' | 'Blood' | 'Medical' | 'Financial' | 'Petition'>('Help');

  useEffect(() => {
    fetchCommunity();
  }, [id]);

  useEffect(() => {
    if (community) {
      fetchMessages();
    }
  }, [activeTab, community]);

  const fetchCommunity = async () => {
    try {
      const response = await getCommunity(id!);
      setCommunity(response.data);
    } catch (error) {
      console.error('Error fetching community:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const subgroupType = activeTab.toLowerCase();
      const response = await getCommunityMessages(id!, subgroupType);
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    try {
      const subgroupType = activeTab.toLowerCase();
      await sendCommunityMessage(id!, subgroupType, newMessage.trim());
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleAddRequest = () => {
    if (activeTab === 'Chat') return;
    setRequestType(activeTab as any);
    setShowRequestModal(true);
  };

  const handleSubmitRequest = async (data: any) => {
    try {
      // Map request type to API format
      const typeMapping: Record<string, string> = {
        'help': 'other',
        'blood': 'blood',
        'medical': 'medical',
        'financial': 'financial',
        'petition': 'other',
        'food': 'food'
      };
      
      const helpType = typeMapping[data.type?.toLowerCase()] || 'other';
      
      // Create help request via API
      await createHelpRequest({
        type: helpType as any,
        title: data.title || `${activeTab} Request`,
        description: data.description,
        community_level: (data.visibility === 'national' ? 'country' : data.visibility) as any,
        contact_number: data.contact_number,
        urgency: 'normal',
        blood_group: data.blood_group,
        hospital_name: data.hospital_name,
        amount: data.amount
      });
      
      // Also post as a message to the community for visibility
      const subgroupType = activeTab.toLowerCase();
      const content = formatRequestAsMessage(data);
      await sendCommunityMessage(id!, subgroupType, content, 'request');
      
      Alert.alert('Success', 'Your help request has been submitted!');
      fetchMessages();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit request');
      throw error;
    }
  };

  const formatRequestAsMessage = (data: any) => {
    let message = `📢 ${data.type?.toUpperCase()} REQUEST\n`;
    if (data.title) message += `\n📌 ${data.title}`;
    if (data.blood_group) message += `\n🩸 Blood Group: ${data.blood_group}`;
    if (data.hospital_name) message += `\n🏥 Hospital: ${data.hospital_name}`;
    if (data.location) message += `\n📍 Location: ${data.location}`;
    if (data.amount) message += `\n💰 Amount: ₹${data.amount}`;
    message += `\n\n${data.description}`;
    message += `\n\n📞 Contact: ${data.contact_number}`;
    return message;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === user?.id;
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        {!isOwnMessage && (
          <Avatar name={item.sender_name} photo={item.sender_photo} size={32} />
        )}
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
        ]}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>{item.sender_name}</Text>
          )}
          <Text style={[
            styles.messageText,
            isOwnMessage && styles.ownMessageText
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isOwnMessage && styles.ownMessageTime
          ]}>
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
      </View>
    );
  }

  if (!community) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Community not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.communityName}>{community.name}</Text>
          <Text style={styles.memberCount}>{community.member_count} members</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.codeLabel}>Code</Text>
          <Text style={styles.codeText}>{community.code}</Text>
        </View>
      </View>

      {/* Top Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {activeTab !== 'Chat' && (
          <TouchableOpacity style={styles.addButton} onPress={handleAddRequest}>
            <Ionicons name="add" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages List */}
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMessages(); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons 
                name={activeTab === 'Chat' ? 'chatbubbles-outline' : 'document-text-outline'} 
                size={48} 
                color={COLORS.textLight} 
              />
              <Text style={styles.emptyText}>
                {activeTab === 'Chat' 
                  ? 'No messages yet. Start the conversation!' 
                  : `No ${activeTab.toLowerCase()} requests yet`}
              </Text>
            </View>
          }
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
        />

        {/* Input Area - Only show for Chat tab */}
        {activeTab === 'Chat' && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.textLight}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity 
              style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Help Request Prompt - Show for non-Chat tabs */}
        {activeTab !== 'Chat' && messages.length === 0 && (
          <View style={styles.helpRequestPrompt}>
            <Text style={styles.helpPromptText}>
              Need {activeTab.toLowerCase()} help? Tap the + button above to create a structured request.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Request Form Modal */}
      <RequestFormModal
        visible={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        requestType={requestType}
        onSubmit={handleSubmitRequest}
      />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
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
  },
  communityName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  memberCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  codeLabel: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingVertical: SPACING.sm,
  },
  tabsScroll: {
    flex: 1,
  },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginLeft: SPACING.sm,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: `${COLORS.primary}15`,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  addButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
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
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.xs,
  },
  ownMessageBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 3,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    maxHeight: 100,
    fontSize: 15,
    color: COLORS.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
  helpRequestPrompt: {
    padding: SPACING.md,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  helpPromptText: {
    fontSize: 13,
    color: COLORS.primary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
