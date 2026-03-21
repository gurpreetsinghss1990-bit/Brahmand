import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { discoverCommunities, getTemples, getNearbyEvents } from '../../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

interface Temple {
  id: string;
  temple_id: string;
  name: string;
  location: { area?: string; city?: string };
  deity?: string;
  follower_count: number;
}

interface Event {
  id: string;
  name: string;
  event_type: string;
  date: string;
  time: string;
  location: { area?: string; city?: string };
  distance?: string;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'temples' | 'events'>('temples');
  const [temples, setTemples] = useState<Temple[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [templeRes, eventRes] = await Promise.all([
        getTemples().catch(() => ({ data: [] })),
        getNearbyEvents().catch(() => ({ data: [] })),
      ]);
      setTemples(templeRes.data);
      setEvents(eventRes.data);
    } catch (error) {
      console.error('Error fetching discover data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'bhajan': return 'musical-notes';
      case 'garba': return 'people';
      case 'satsang': return 'book';
      case 'katha': return 'mic';
      case 'workshop': return 'school';
      case 'annadan': return 'restaurant';
      default: return 'calendar';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Switcher - Only Temples and Events */}
      <View style={styles.tabContainer}>
        {['temples', 'events'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Ionicons
              name={tab === 'temples' ? 'home' : 'calendar'}
              size={18}
              color={activeTab === tab ? COLORS.primary : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Temples Tab */}
        {activeTab === 'temples' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Temple Network</Text>
            <Text style={styles.sectionSubtitle}>Follow temples to receive updates and announcements</Text>
            
            {temples.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="home-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.emptyText}>No temples registered yet</Text>
                <Text style={styles.emptySubtext}>Be the first to add your local temple</Text>
              </View>
            ) : (
              temples.map((temple) => (
                <TouchableOpacity
                  key={temple.id}
                  style={styles.card}
                  onPress={() => router.push(`/temple/${temple.temple_id}`)}
                >
                  <View style={[styles.cardIcon, { backgroundColor: `${COLORS.warning}20` }]}>
                    <Ionicons name="home" size={24} color={COLORS.warning} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{temple.name}</Text>
                    <Text style={styles.cardSubtitle}>
                      {temple.location?.city || temple.location?.area} • {temple.follower_count} followers
                    </Text>
                    {temple.deity && (
                      <Text style={styles.deityText}>{temple.deity}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nearby Sanatan Events</Text>
            <Text style={styles.sectionSubtitle}>Discover spiritual events happening near you</Text>
            
            {events.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.emptyText}>No upcoming events</Text>
                <Text style={styles.emptySubtext}>Check back later for new events</Text>
              </View>
            ) : (
              events.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() => router.push(`/event/${event.id}`)}
                >
                  <View style={styles.eventHeader}>
                    <View style={[styles.eventIcon, { backgroundColor: `${COLORS.success}20` }]}>
                      <Ionicons name={getEventIcon(event.event_type)} size={20} color={COLORS.success} />
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventName}>{event.name}</Text>
                      <Text style={styles.eventType}>
                        {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.eventDetails}>
                    <View style={styles.eventDetail}>
                      <Ionicons name="calendar" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.eventDetailText}>{event.date}</Text>
                    </View>
                    <View style={styles.eventDetail}>
                      <Ionicons name="time" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.eventDetailText}>{event.time}</Text>
                    </View>
                    {event.distance && (
                      <View style={styles.eventDetail}>
                        <Ionicons name="location" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.eventDetailText}>{event.distance}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  tabActive: {
    backgroundColor: `${COLORS.primary}15`,
  },
  tabText: {
    marginLeft: SPACING.xs,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  card: {
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
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  deityText: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  eventCard: {
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
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  eventType: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  eventDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 52,
  },
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.md,
    marginBottom: SPACING.xs,
  },
  eventDetailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  bottomPadding: {
    height: SPACING.xl,
  },
});
