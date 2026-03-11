import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getCommunities, getTodaysWisdom, getTodaysPanchang, getCommunityStats, getVerificationStatus } from '../../src/services/api';
import { Community } from '../../src/types';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

interface WisdomQuote {
  quote: string;
  source: string;
}

interface PanchangData {
  tithi: string;
  sunrise: string;
  sunset: string;
  vrat: string | null;
  paksha: string;
}

interface CommunityWithStats extends Community {
  new_messages?: number;
  label?: string;
  is_default?: boolean;
  sort_order?: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const [communities, setCommunities] = useState<CommunityWithStats[]>([]);
  const [wisdom, setWisdom] = useState<WisdomQuote | null>(null);
  const [panchang, setPanchang] = useState<PanchangData | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [communitiesRes, wisdomRes, panchangRes, verificationRes] = await Promise.all([
        getCommunities(),
        getTodaysWisdom(),
        getTodaysPanchang(),
        getVerificationStatus()
      ]);
      
      // Fetch stats for each community
      const communitiesWithStats = await Promise.all(
        communitiesRes.data.map(async (c: Community) => {
          try {
            const stats = await getCommunityStats(c.id);
            return { ...c, new_messages: stats.data.new_messages };
          } catch {
            return { ...c, new_messages: 0 };
          }
        })
      );
      
      setCommunities(communitiesWithStats);
      setWisdom(wisdomRes.data);
      setPanchang(panchangRes.data);
      setIsVerified(verificationRes.data.is_verified);
      
      // Animate wisdom card
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fadeAnim]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fadeAnim.setValue(0);
    fetchData();
  };

  const getCommunityIcon = (type: string) => {
    switch (type) {
      case 'home_area': return 'home';
      case 'office_area': return 'business';
      case 'area': return 'home';
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
      case 'area': return COLORS.success;
      case 'city': return '#9B59B6'; // Purple
      case 'state': return COLORS.warning;
      case 'country': return COLORS.primary;
      default: return COLORS.textSecondary;
    }
  };

  const renderCommunity = ({ item }: { item: CommunityWithStats }) => (
    <View>
      {/* Label above card */}
      {item.label && (
        <Text style={[styles.communityLabel, { color: getCommunityColor(item.type) }]}>
          {item.label}
        </Text>
      )}
      <TouchableOpacity
        style={styles.communityCard}
        onPress={() => router.push(`/community/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.communityIcon, { backgroundColor: `${getCommunityColor(item.type)}20` }]}>
          <Ionicons name={getCommunityIcon(item.type)} size={24} color={getCommunityColor(item.type)} />
        </View>
        <View style={styles.communityInfo}>
          <Text style={styles.communityName}>{item.name}</Text>
          <Text style={styles.communityStats}>
            {item.new_messages ? `${item.new_messages} new messages` : `${item.member_count} members`}
          </Text>
        </View>
        {item.is_default && (
          <View style={styles.defaultBadge}>
            <Ionicons name="lock-closed" size={12} color={COLORS.textLight} />
          </View>
        )}
        {item.new_messages ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.new_messages}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
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
    <View style={styles.container}>
      <FlatList
        data={communities}
        renderItem={renderCommunity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListHeaderComponent={
          <>
            {/* Today's Wisdom Card */}
            <Animated.View style={[styles.wisdomContainer, { opacity: fadeAnim }]}>
              <LinearGradient
                colors={['#FF9F43', '#FF6B00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.wisdomCard}
              >
                <View style={styles.wisdomHeader}>
                  <Text style={styles.lotusIcon}>🪷</Text>
                  <Text style={styles.wisdomTitle}>Today's Wisdom</Text>
                </View>
                {wisdom && (
                  <>
                    <Text style={styles.wisdomQuote}>"{wisdom.quote}"</Text>
                    <Text style={styles.wisdomSource}>– {wisdom.source}</Text>
                  </>
                )}
              </LinearGradient>
            </Animated.View>

            {/* Verification Banner */}
            {!isVerified && (
              <TouchableOpacity 
                style={styles.verificationBanner}
                onPress={() => router.push('/verification')}
              >
                <View style={styles.verificationIcon}>
                  <Ionicons name="shield-checkmark" size={24} color={COLORS.warning} />
                </View>
                <View style={styles.verificationInfo}>
                  <Text style={styles.verificationTitle}>Community Verification</Text>
                  <Text style={styles.verificationText}>
                    Verify to participate in community discussions
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.warning} />
              </TouchableOpacity>
            )}

            {/* Communities Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Communities</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/discover')}>
                <Text style={styles.seeAllText}>Discover</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListFooterComponent={
          <>
            {/* Today's Panchang Card */}
            {panchang && (
              <TouchableOpacity style={styles.panchangCard} onPress={() => router.push('/panchang')}>
                <View style={styles.panchangHeader}>
                  <Ionicons name="sunny" size={20} color={COLORS.primary} />
                  <Text style={styles.panchangTitle}>Today in Sanatan</Text>
                </View>
                <View style={styles.panchangGrid}>
                  <View style={styles.panchangItem}>
                    <Text style={styles.panchangLabel}>Tithi</Text>
                    <Text style={styles.panchangValue}>{panchang.tithi}</Text>
                  </View>
                  <View style={styles.panchangItem}>
                    <Text style={styles.panchangLabel}>Sunrise</Text>
                    <Text style={styles.panchangValue}>{panchang.sunrise}</Text>
                  </View>
                  <View style={styles.panchangItem}>
                    <Text style={styles.panchangLabel}>Sunset</Text>
                    <Text style={styles.panchangValue}>{panchang.sunset}</Text>
                  </View>
                  {panchang.vrat && (
                    <View style={styles.panchangItem}>
                      <Text style={styles.panchangLabel}>Vrat</Text>
                      <Text style={[styles.panchangValue, styles.vratText]}>{panchang.vrat}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.panchangFooter}>
                  <Text style={styles.panchangFooterText}>Tap for full Panchang</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                </View>
              </TouchableOpacity>
            )}
            <View style={styles.bottomPadding} />
          </>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Communities Yet</Text>
            <Text style={styles.emptyText}>Set up your location to join local communities</Text>
          </View>
        }
      />
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
    paddingHorizontal: SPACING.md,
  },
  // Wisdom Card Styles
  wisdomContainer: {
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  wisdomCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  wisdomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  lotusIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  wisdomTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  wisdomQuote: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },
  wisdomSource: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
  },
  // Verification Banner
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.warning}15`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: `${COLORS.warning}30`,
  },
  verificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.warning}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  verificationInfo: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  verificationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  // Community Card Styles
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
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
    marginBottom: 2,
  },
  communityStats: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  badge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: SPACING.sm,
  },
  badgeText: {
    color: COLORS.textWhite,
    fontSize: 12,
    fontWeight: '600',
  },
  defaultBadge: {
    marginRight: SPACING.sm,
  },
  separator: {
    height: SPACING.sm,
  },
  // Panchang Card Styles
  panchangCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  panchangHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  panchangTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  panchangGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  panchangItem: {
    width: '50%',
    paddingVertical: SPACING.sm,
  },
  panchangLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  panchangValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  vratText: {
    color: COLORS.primary,
  },
  panchangFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  panchangFooterText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginRight: SPACING.xs,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
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
  bottomPadding: {
    height: SPACING.xl,
  },
});
