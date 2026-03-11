import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCommunities } from '../../src/services/api';
import { Community } from '../../src/types';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

export default function CommunitiesScreen() {
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCommunities = useCallback(async () => {
    try {
      const response = await getCommunities();
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

  const getCommunityIcon = (type: string) => {
    switch (type) {
      case 'area':
        return 'home';
      case 'city':
        return 'business';
      case 'state':
        return 'map';
      case 'country':
        return 'flag';
      default:
        return 'people';
    }
  };

  const getCommunityColor = (type: string) => {
    switch (type) {
      case 'area':
        return COLORS.success;
      case 'city':
        return COLORS.info;
      case 'state':
        return COLORS.warning;
      case 'country':
        return COLORS.primary;
      default:
        return COLORS.textSecondary;
    }
  };

  const renderCommunity = ({ item }: { item: Community }) => (
    <TouchableOpacity
      style={styles.communityCard}
      onPress={() => router.push(`/community/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${getCommunityColor(item.type)}20` }]}>
        <Ionicons name={getCommunityIcon(item.type)} size={24} color={getCommunityColor(item.type)} />
      </View>
      <View style={styles.communityInfo}>
        <Text style={styles.communityName}>{item.name}</Text>
        <View style={styles.communityMeta}>
          <View style={styles.memberCount}>
            <Ionicons name="people" size={14} color={COLORS.textSecondary} />
            <Text style={styles.memberText}>{item.member_count} members</Text>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: `${getCommunityColor(item.type)}20` }]}>
            <Text style={[styles.typeText, { color: getCommunityColor(item.type) }]}>
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
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
      {communities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>No Communities Yet</Text>
          <Text style={styles.emptyText}>Set up your location to join local communities</Text>
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
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  memberText: {
    marginLeft: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  typeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
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
