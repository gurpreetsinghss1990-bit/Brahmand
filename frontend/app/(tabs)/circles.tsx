import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCircles } from '../../src/services/api';
import { Circle } from '../../src/types';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

export default function CirclesScreen() {
  const router = useRouter();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCircles = useCallback(async () => {
    try {
      const response = await getCircles();
      setCircles(response.data);
    } catch (error) {
      console.error('Error fetching circles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCircles();
  }, [fetchCircles]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCircles();
  };

  const renderCircle = ({ item }: { item: Circle }) => (
    <TouchableOpacity
      style={styles.circleCard}
      onPress={() => router.push(`/chat/circle/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="ellipse" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.circleInfo}>
        <Text style={styles.circleName}>{item.name}</Text>
        <View style={styles.circleMeta}>
          <View style={styles.memberCount}>
            <Ionicons name="people" size={14} color={COLORS.textSecondary} />
            <Text style={styles.memberText}>{item.member_count} members</Text>
          </View>
          <Text style={styles.codeText}>Code: {item.code}</Text>
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
      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/circle/create')}
        >
          <Ionicons name="add-circle" size={20} color={COLORS.textWhite} />
          <Text style={styles.actionText}>Create Circle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonOutline]}
          onPress={() => router.push('/circle/join')}
        >
          <Ionicons name="enter" size={20} color={COLORS.primary} />
          <Text style={[styles.actionText, styles.actionTextOutline]}>Join Circle</Text>
        </TouchableOpacity>
      </View>

      {circles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="ellipse-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>No Circles Yet</Text>
          <Text style={styles.emptyText}>
            Create a circle for your family, friends, or temple community
          </Text>
        </View>
      ) : (
        <FlatList
          data={circles}
          renderItem={renderCircle}
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
  actionRow: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
  },
  actionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  actionText: {
    color: COLORS.textWhite,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  actionTextOutline: {
    color: COLORS.primary,
  },
  listContent: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  circleCard: {
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
  circleInfo: {
    flex: 1,
  },
  circleName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  circleMeta: {
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
