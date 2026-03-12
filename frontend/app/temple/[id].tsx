import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getTemple, getTemplePosts, followTemple, unfollowTemple } from '../../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

export default function TempleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [temple, setTemple] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    fetchTempleData();
  }, [id]);

  const fetchTempleData = async () => {
    try {
      const [templeRes, postsRes] = await Promise.all([
        getTemple(id!),
        getTemplePosts(id!).catch(() => ({ data: [] }))
      ]);
      setTemple(templeRes.data);
      setPosts(postsRes.data || []);
      setIsFollowing(templeRes.data?.is_following || false);
    } catch (error) {
      console.error('Error fetching temple:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    try {
      if (isFollowing) {
        await unfollowTemple(id!);
      } else {
        await followTemple(id!);
      }
      setIsFollowing(!isFollowing);
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!temple) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.textLight} />
          <Text style={styles.errorText}>Temple not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{temple.name}</Text>
        <TouchableOpacity onPress={handleFollowToggle}>
          <Ionicons 
            name={isFollowing ? "notifications" : "notifications-outline"} 
            size={24} 
            color={isFollowing ? COLORS.primary : COLORS.text} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Temple Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.templeIconLarge}>
            <Ionicons name="home" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.templeName}>{temple.name}</Text>
          {temple.deity && <Text style={styles.templeDeity}>{temple.deity}</Text>}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={COLORS.textSecondary} />
            <Text style={styles.locationText}>
              {temple.location?.area || temple.location?.city || 'Unknown location'}
            </Text>
          </View>
          {temple.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.verifiedText}>Verified Temple</Text>
            </View>
          )}
        </View>

        {/* Aarti Timings */}
        {temple.aarti_timings && Object.keys(temple.aarti_timings).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aarti Timings</Text>
            {Object.entries(temple.aarti_timings).map(([key, value]) => (
              <View key={key} style={styles.timingRow}>
                <Text style={styles.timingLabel}>{key}</Text>
                <Text style={styles.timingValue}>{String(value)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Description */}
        {temple.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.descriptionText}>{temple.description}</Text>
          </View>
        )}

        {/* Announcements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Announcements</Text>
          {posts.length === 0 ? (
            <Text style={styles.noPostsText}>No announcements yet</Text>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postContent}>{post.content}</Text>
                <Text style={styles.postDate}>
                  {new Date(post.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginHorizontal: SPACING.md,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  templeIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  templeName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  templeDeity: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    marginTop: SPACING.md,
  },
  verifiedText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  section: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  timingLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  timingValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  noPostsText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  postCard: {
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  postContent: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  postDate: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: SPACING.sm,
  },
});
