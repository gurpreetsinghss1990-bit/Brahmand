import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  FlatList 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getTemples, getNearbyEvents } from '../../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

const TABS = ['Nearby', 'Aarti', 'Volunteers', 'Events', 'Donations'];

export default function TempleScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Nearby');
  const [temples, setTemples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await getTemples();
      setTemples(res.data || []);
    } catch (error) {
      console.error('Error fetching temples:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderTemple = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.templeCard}
      onPress={() => router.push(`/temple/${item.id}`)}
    >
      <View style={styles.templeIcon}>
        <Ionicons name="home" size={28} color={COLORS.primary} />
      </View>
      <View style={styles.templeInfo}>
        <Text style={styles.templeName}>{item.name}</Text>
        <Text style={styles.templeLocation}>
          {item.location?.area || item.location?.city || 'Location'}
        </Text>
        <Text style={styles.templeDeity}>{item.deity || 'Temple'}</Text>
      </View>
      {item.is_verified && (
        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Top Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="filter" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Temple List */}
      <FlatList
        data={temples}
        renderItem={renderTemple}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="home-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No temples found nearby</Text>
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
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingVertical: SPACING.sm,
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
  headerActions: {
    flexDirection: 'row',
    paddingRight: SPACING.md,
  },
  headerIcon: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  listContent: {
    padding: SPACING.md,
  },
  templeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 16,
    marginBottom: 12,
  },
  templeIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  templeInfo: {
    flex: 1,
  },
  templeName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  templeLocation: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  templeDeity: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  verifiedBadge: {
    marginRight: SPACING.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
});
