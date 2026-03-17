import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/authStore';
import { getCircles, getCommunities, createCommunityRequest, getCommunityRequests, getMyCommunityRequests, resolveCommunityRequest } from '../../src/services/api';
import { RequestFormModal } from '../../src/components/RequestFormModal';

// Top tabs for Chat section
const TOP_TABS = ['Community', 'Private Chat'];

// Community sub-tabs
const COMMUNITY_TABS = ['Chat', 'Help', 'Blood', 'Medical', 'Financial', 'Petition'];

interface Circle {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  last_message?: string;
  last_message_time?: string;
}

interface Community {
  id: string;
  name: string;
  type: string;
  label?: string;
  member_count: number;
  is_default?: boolean;
}

interface CommunityRequest {
  id: string;
  user_id: string;
  request_type: string;
  title: string;
  description: string;
  contact_number: string;
  urgency_level: string;
  status: string;
  created_at: string;
  blood_group?: string;
  hospital_name?: string;
  amount?: number;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  // Top tab state (Community vs Private Chat)
  const [activeTopTab, setActiveTopTab] = useState('Community');
  
  // Community sub-tab state
  const [activeCommunityTab, setActiveCommunityTab] = useState('Chat');
  
  // Data states
  const [communities, setCommunities] = useState<Community[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [requests, setRequests] = useState<CommunityRequest[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Request form modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<'Help' | 'Blood' | 'Medical' | 'Financial' | 'Petition'>('Help');

  const fetchData = useCallback(async () => {
    try {
      if (activeTopTab === 'Community') {
        if (activeCommunityTab === 'Chat') {
          // Fetch communities list
          const res = await getCommunities();
          setCommunities(res.data || []);
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
            type: requestTypeMap[activeCommunityTab],
            limit: 50
          });
          setRequests(response.data || []);
        }
      } else {
        // Private Chat - fetch circles/groups
        const res = await getCircles();
        setCircles(res.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTopTab, activeCommunityTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCommunityTabChange = async (tab: string) => {
    setActiveCommunityTab(tab);
    if (tab !== 'Chat') {
      // Check for existing active request before opening modal
      try {
        const response = await getMyCommunityRequests();
        const myRequests = response.data || [];
        const hasActive = myRequests.some((req: any) => req.status === 'active');
        
        if (hasActive) {
          Alert.alert(
            'Active Request Exists',
            'You already have an active help request. Please mark it as fulfilled before creating a new one.'
          );
          return;
        }
      } catch (error) {
        console.error('Error checking active requests:', error);
      }
      
      setRequestType(tab as any);
      setShowRequestModal(true);
    }
  };

  const handleSubmitRequest = async (data: any) => {
    try {
      const title = data.title || `${data.request_type} Request`;
      const description = data.description || 'Request created from community tab';
      
      await createCommunityRequest({
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
      fetchData();
    } catch (error: any) {
      console.error('Error submitting request:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit request');
      throw error;
    }
  };

  const handleResolveRequest = async (requestId: string) => {
    Alert.alert(
      'Mark as Fulfilled',
      'Are you sure you want to mark this request as fulfilled?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await resolveCommunityRequest(requestId);
              Alert.alert('Success', 'Request marked as fulfilled!');
              fetchData();
            } catch (error: any) {
              console.error('Error resolving request:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to resolve request');
            }
          }
        }
      ]
    );
  };

  const getCommunityIcon = (type: string) => {
    switch (type) {
      case 'home_area': return 'home';
      case 'office_area': return 'business';
      case 'city': return 'location';
      case 'state': return 'map';
      case 'country': return 'flag';
      default: return 'people';
    }
  };

  const getCommunityColor = (type: string) => {
    switch (type) {
      case 'home_area': return COLORS.success;
      case 'office_area': return COLORS.info;
      case 'city': return '#9B59B6';
      case 'state': return COLORS.warning;
      case 'country': return COLORS.primary;
      default: return COLORS.textSecondary;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return COLORS.error;
      case 'high': return '#E67E22';
      case 'medium': return COLORS.warning;
      default: return COLORS.success;
    }
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

  const renderCommunity = ({ item }: { item: Community }) => (
    <View>
      {item.label && (
        <Text style={[styles.communityLabel, { color: getCommunityColor(item.type) }]}>
          {item.label}
        </Text>
      )}
      <TouchableOpacity
        style={styles.communityCard}
        onPress={() => router.push(`/community/${item.id}`)}
      >
        <View style={[styles.communityIcon, { backgroundColor: `${getCommunityColor(item.type)}15` }]}>
          <Ionicons name={getCommunityIcon(item.type)} size={24} color={getCommunityColor(item.type)} />
        </View>
        <View style={styles.communityInfo}>
          <Text style={styles.communityName}>{item.name}</Text>
          <Text style={styles.communityStats}>{item.member_count} members</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
      </TouchableOpacity>
    </View>
  );

  const renderCircle = ({ item }: { item: Circle }) => (
    <TouchableOpacity
      style={styles.circleCard}
      onPress={() => router.push(`/circle/${item.id}`)}
    >
      <View style={styles.circleAvatar}>
        <Ionicons name="people" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.circleInfo}>
        <Text style={styles.circleName}>{item.name}</Text>
        <Text style={styles.circleLastMessage} numberOfLines={1}>
          {item.last_message || 'No messages yet'}
        </Text>
      </View>
      <View style={styles.circleRight}>
        <Text style={styles.circleTime}>{item.last_message_time || ''}</Text>
        <Text style={styles.circleMemberCount}>{item.member_count} members</Text>
      </View>
    </TouchableOpacity>
  );

  const renderRequest = ({ item }: { item: CommunityRequest }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={[
          styles.urgencyBadge,
          { backgroundColor: `${getUrgencyColor(item.urgency_level)}20` }
        ]}>
          <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(item.urgency_level) }]} />
          <Text style={[styles.urgencyText, { color: getUrgencyColor(item.urgency_level) }]}>
            {item.urgency_level.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.requestDate}>{formatDate(item.created_at)}</Text>
      </View>
      
      <Text style={styles.requestTitle}>{item.title}</Text>
      <Text style={styles.requestDescription} numberOfLines={2}>{item.description}</Text>
      
      <View style={styles.requestFooter}>
        <TouchableOpacity style={styles.contactButton}>
          <Ionicons name="call" size={14} color={COLORS.primary} />
          <Text style={styles.contactButtonText}>{item.contact_number}</Text>
        </TouchableOpacity>
        
        {item.status === 'active' && (
          <TouchableOpacity 
            style={styles.fulfillButton}
            onPress={() => handleResolveRequest(item.id)}
          >
            <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
            <Text style={styles.fulfillButtonText}>Fulfilled</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmptyPrivateChat = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="chatbubble-ellipses" size={48} color={COLORS.textLight} />
      </View>
      <Text style={styles.emptyTitle}>Private Chats</Text>
      <Text style={styles.emptyText}>Your private conversations and group chats will appear here</Text>
      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => router.push('/create-circle')}
      >
        <Ionicons name="add-circle" size={20} color="#FFFFFF" />
        <Text style={styles.createButtonText}>Create Group</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Top Tabs: Community | Private Chat */}
      <View style={styles.topTabsContainer}>
        {TOP_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.topTab, activeTopTab === tab && styles.topTabActive]}
            onPress={() => setActiveTopTab(tab)}
          >
            <Text style={[styles.topTabText, activeTopTab === tab && styles.topTabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Community Tab Content */}
      {activeTopTab === 'Community' && (
        <>
          {/* Community Sub-tabs */}
          <View style={styles.subTabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {COMMUNITY_TABS.map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.subTab, activeCommunityTab === tab && styles.subTabActive]}
                  onPress={() => handleCommunityTabChange(tab)}
                >
                  <Text style={[styles.subTabText, activeCommunityTab === tab && styles.subTabTextActive]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {activeCommunityTab !== 'Chat' && (
              <TouchableOpacity 
                style={styles.addButton} 
                onPress={() => {
                  setRequestType(activeCommunityTab as any);
                  setShowRequestModal(true);
                }}
              >
                <Ionicons name="add" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Community Content */}
          {activeCommunityTab === 'Chat' ? (
            <FlatList
              data={communities}
              renderItem={renderCommunity}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={48} color={COLORS.textLight} />
                  <Text style={styles.emptyTitle}>No Communities</Text>
                  <Text style={styles.emptyText}>Set up your location to join communities</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={requests}
              renderItem={renderRequest}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={48} color={COLORS.textLight} />
                  <Text style={styles.emptyTitle}>No {activeCommunityTab} Requests</Text>
                  <Text style={styles.emptyText}>Be the first to create a request</Text>
                  <TouchableOpacity 
                    style={styles.createButton}
                    onPress={() => {
                      setRequestType(activeCommunityTab as any);
                      setShowRequestModal(true);
                    }}
                  >
                    <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.createButtonText}>Create {activeCommunityTab} Request</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </>
      )}

      {/* Private Chat Tab Content */}
      {activeTopTab === 'Private Chat' && (
        <FlatList
          data={circles}
          renderItem={renderCircle}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
          }
          ListEmptyComponent={renderEmptyPrivateChat}
        />
      )}

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
  // Top Tabs (Community | Private Chat)
  topTabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  topTab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  topTabActive: {
    borderBottomColor: COLORS.primary,
  },
  topTabText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  topTabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  // Sub Tabs (Chat | Help | Blood...)
  subTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingVertical: SPACING.sm,
  },
  subTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginLeft: SPACING.sm,
    borderRadius: 20,
  },
  subTabActive: {
    backgroundColor: `${COLORS.primary}15`,
  },
  subTabText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  subTabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  addButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  // Community Card
  communityLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 4,
  },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 16,
    marginBottom: 12,
  },
  communityIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  communityStats: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Circle Card
  circleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 16,
    marginBottom: 12,
  },
  circleAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  circleInfo: {
    flex: 1,
  },
  circleName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  circleLastMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  circleRight: {
    alignItems: 'flex-end',
  },
  circleTime: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  circleMemberCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Request Card
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
  requestDate: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  requestTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  requestDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 16,
  },
  contactButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 12,
  },
  fulfillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 16,
  },
  fulfillButtonText: {
    color: COLORS.success,
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 12,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    marginTop: SPACING.lg,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
});
