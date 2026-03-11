import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { discoverCommunities, joinCommunityByCode } from '../../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

interface DiscoverCommunity {
  id: string;
  name: string;
  type: string;
  code: string;
  member_count: number;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const [communities, setCommunities] = useState<DiscoverCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchCommunities = useCallback(async () => {
    try {
      const response = await discoverCommunities();
      setCommunities(response.data);
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCommunities();
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;

    setJoining(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await joinCommunityByCode(joinCode.trim());
      setMessage({ type: 'success', text: `Joined ${response.data.community}!` });
      setJoinCode('');
      fetchCommunities();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to join community' });
    } finally {
      setJoining(false);
    }
  };

  const getCommunityIcon = (type: string) => {
    switch (type) {
      case 'area': return 'home';
      case 'city': return 'business';
      case 'state': return 'map';
      case 'country': return 'flag';
      default: return 'people';
    }
  };

  const renderCommunity = ({ item }: { item: DiscoverCommunity }) => (
    <TouchableOpacity
      style={styles.communityCard}
      onPress={() => router.push(`/community/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={getCommunityIcon(item.type)} size={24} color={COLORS.primary} />
      </View>
      <View style={styles.communityInfo}>
        <Text style={styles.communityName}>{item.name}</Text>
        <View style={styles.communityMeta}>
          <Ionicons name="people" size={14} color={COLORS.textSecondary} />
          <Text style={styles.memberText}>{item.member_count} members</Text>
          <Text style={styles.codeText}>Code: {item.code}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Join by Code Section */}
      <View style={styles.joinSection}>
        <Text style={styles.sectionTitle}>Join Community by Code</Text>
        <View style={styles.joinRow}>
          <TextInput
            style={styles.codeInput}
            placeholder="Enter community code"
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
            placeholderTextColor={COLORS.textLight}
          />
          <TouchableOpacity
            style={[styles.joinButton, !joinCode.trim() && styles.joinButtonDisabled]}
            onPress={handleJoinByCode}
            disabled={!joinCode.trim() || joining}
          >
            {joining ? (
              <ActivityIndicator size="small" color={COLORS.textWhite} />
            ) : (
              <Ionicons name="enter" size={20} color={COLORS.textWhite} />
            )}
          </TouchableOpacity>
        </View>
        {message.text ? (
          <Text style={[styles.message, message.type === 'error' ? styles.errorText : styles.successText]}>
            {message.text}
          </Text>
        ) : null}
      </View>

      {/* Popular Communities */}
      <Text style={styles.sectionTitle}>Popular Communities</Text>
      
      {communities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="compass-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>No Communities Found</Text>
          <Text style={styles.emptyText}>Be the first to create a community in your area!</Text>
        </View>
      ) : (
        <FlatList
          data={communities}
          renderItem={renderCommunity}
          keyExtractor={(item) => item.id}
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
  joinSection: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  joinRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  codeInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: COLORS.text,
  },
  joinButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  message: {
    marginTop: SPACING.sm,
    fontSize: 13,
  },
  errorText: {
    color: COLORS.error,
  },
  successText: {
    color: COLORS.success,
  },
  listContent: {
    padding: SPACING.md,
  },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}15`,
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
    marginBottom: SPACING.xs,
  },
  communityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberText: {
    marginLeft: 4,
    marginRight: SPACING.md,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  codeText: {
    fontSize: 11,
    color: COLORS.textLight,
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
