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
import { getCommunity, getCommunityMessages, sendCommunityMessage, createCommunityRequest, getCommunityRequests } from '../../src/services/api';
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

interface CommunityRequest {
  id: string;
  user_id: string;
  user_name?: string;
  request_type: string;
  title: string;
  description: string;
  contact_number: string;
  urgency_level: string;
  status: string;
  created_at: string;
  blood_group?: string;
  hospital_name?: string;
  location?: string;
  amount?: number;
  support_needed?: string;
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
  const [requests, setRequests] = useState<CommunityRequest[]>([]);
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
      fetchData();
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

  const fetchData = async () => {
    try {
      if (activeTab === 'Chat') {
        // Fetch chat messages
        const response = await getCommunityMessages(id!, 'chat');
        setMessages(response.data || []);
        setRequests([]);
      } else {
        // Fetch community requests for this tab type
        const requestTypeMap: Record<string, string> = {
          'Help': 'help',
          'Blood': 'blood',
          'Medical': 'medical',
          'Financial': 'financial',
          'Petition': 'petition'
        };
        const response = await getCommunityRequests({
          type: requestTypeMap[activeTab],
          community_id: id,
          limit: 50
        });
        setRequests(response.data || []);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessages([]);
      setRequests([]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Automatically open form when tapping non-Chat tab
    if (tab !== 'Chat') {
      setRequestType(tab as any);
      setShowRequestModal(true);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    try {
      await sendCommunityMessage(id!, 'chat', newMessage.trim());
      setNewMessage('');
      fetchData();
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
      console.log('Submitting community request:', data);
      
      // Ensure minimum length requirements
      const title = data.title || `${data.request_type} Request`;
      const description = data.description || 'Request created from community tab';
      
      // Create community request via API
      await createCommunityRequest({
        community_id: id,
        request_type: data.request_type,
        visibility_level: data.visibility_level || 'area',
        title: title.length >= 2 ? title : `${data.request_type} Request`,
        description: description.length >= 10 ? description : description.padEnd(10, '.'),
        contact_number: data.contact_number,
        urgency_level: data.urgency_level || 'low',
        blood_group: data.blood_group,
        hospital_name: data.hospital_name,
        location: data.location,
        amount: data.amount,
        support_needed: data.support_needed,
        contact_person_name: data.contact_person_name,
      });
      
      Alert.alert('Success', 'Your request has been posted!');
      // Refresh the data to show the new request
      fetchData();
    } catch (error: any) {
      console.error('Error submitting request:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit request');
      throw error;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return COLORS.error;
      case 'high': return '#E67E22';
      case 'medium': return COLORS.warning;
      default: return COLORS.success;
    }
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

  const renderRequest = ({ item }: { item: CommunityRequest }) => {
    const isOwn = item.user_id === user?.id;
    
    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requestTypeContainer}>
            <View style={[
              styles.urgencyBadge,
              { backgroundColor: `${getUrgencyColor(item.urgency_level)}20` }
            ]}>
              <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(item.urgency_level) }]} />
              <Text style={[styles.urgencyText, { color: getUrgencyColor(item.urgency_level) }]}>
                {item.urgency_level.toUpperCase()}
              </Text>
            </View>
            {item.request_type === 'blood' && item.blood_group && (
              <View style={styles.bloodBadge}>
                <Ionicons name="water" size={14} color="#E74C3C" />
                <Text style={styles.bloodText}>{item.blood_group}</Text>
              </View>
            )}
          </View>
          <Text style={styles.requestDate}>{formatDate(item.created_at)}</Text>
        </View>
        
        <Text style={styles.requestTitle}>{item.title}</Text>
        <Text style={styles.requestDescription} numberOfLines={3}>{item.description}</Text>
        
        {item.hospital_name && (
          <View style={styles.requestDetail}>
            <Ionicons name="medical" size={14} color={COLORS.textSecondary} />
            <Text style={styles.requestDetailText}>{item.hospital_name}</Text>
          </View>
        )}
        
        {item.location && (
          <View style={styles.requestDetail}>
            <Ionicons name="location" size={14} color={COLORS.textSecondary} />
            <Text style={styles.requestDetailText}>{item.location}</Text>
          </View>
        )}
        
        {item.amount && (
          <View style={styles.requestDetail}>
            <Ionicons name="cash" size={14} color={COLORS.textSecondary} />
            <Text style={styles.requestDetailText}>Rs {item.amount.toLocaleString()}</Text>
          </View>
        )}
        
        <View style={styles.requestFooter}>
          <TouchableOpacity style={styles.contactButton}>
            <Ionicons name="call" size={16} color={COLORS.primary} />
            <Text style={styles.contactButtonText}>{item.contact_number}</Text>
          </TouchableOpacity>
          
          {item.status === 'active' && (
            <View style={styles.activeStatus}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Active</Text>
            </View>
          )}
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
              onPress={() => handleTabChange(tab)}
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

      {/* Content */}
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {activeTab === 'Chat' ? (
          // Chat Messages
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            inverted={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
              </View>
            }
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
          />
        ) : (
          // Request List
          <FlatList
            data={requests}
            renderItem={renderRequest}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.requestsList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.emptyText}>No {activeTab.toLowerCase()} requests yet</Text>
                <TouchableOpacity 
                  style={styles.createRequestBtn}
                  onPress={handleAddRequest}
                >
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.createRequestBtnText}>Create {activeTab} Request</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}

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
  requestsList: {
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
  createRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    marginTop: SPACING.lg,
  },
  createRequestBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: SPACING.xs,
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
  // Request card styles
  requestCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  requestTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bloodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEDEC',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bloodText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E74C3C',
    marginLeft: 4,
  },
  requestDate: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  requestDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  requestDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requestDetailText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  contactButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  activeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 4,
  },
  activeText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '500',
  },
});
