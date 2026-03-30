import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { askProkeralaAstrology, getProkeralaAstrology } from '../src/services/api';
import { BORDER_RADIUS, COLORS, SPACING } from '../src/constants/theme';
import { useAuthStore } from '../src/store/authStore';
// Astrology should use saved birth coordinates only; do not fetch device GPS here

type InfoRowType = {
  label: string;
  value: string;
};

type DetailSection = {
  key: string;
  title: string;
  rows: InfoRowType[];
};

const HOROSCOPE_ENDPOINTS = 'birth_details,mangal_dosha,kaal_sarp_dosha';
const KUNDLI_ENDPOINTS = 'birth_details,kundli_advanced,planet_position';

const AYANAMSA_OPTIONS = [
  { value: 1, label: 'Lahiri' },
  { value: 3, label: 'Raman' },
  { value: 5, label: 'KP' },
];

export default function AstrologyScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { user } = useAuthStore();
  const isKundliMode = mode === 'kundli';
  const endpointSet = isKundliMode ? KUNDLI_ENDPOINTS : HOROSCOPE_ENDPOINTS;
  const rawBirthLat = (user as any)?.place_of_birth_latitude;
  const rawBirthLng = (user as any)?.place_of_birth_longitude;
  const userBirthLat =
    typeof rawBirthLat === 'number' ? rawBirthLat : rawBirthLat ? Number(rawBirthLat) : undefined;
  const userBirthLng =
    typeof rawBirthLng === 'number' ? rawBirthLng : rawBirthLng ? Number(rawBirthLng) : undefined;
  const [ayanamsa, setAyanamsa] = useState(1);
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatMessages, setChatMessages] = useState<{ question: string; answer: string }[]>([]);
  const isMountedRef = React.useRef(true);
  const glowAnim = useRef(new Animated.Value(0.92)).current;

  const handleBack = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  const fetchBaseAstrology = useCallback(async (forceRefresh = false) => {
    try {
      if (!isMountedRef.current) return;
      setError('');
      const response = await getProkeralaAstrology({
        lat: typeof userBirthLat === 'number' ? userBirthLat : undefined,
        lng: typeof userBirthLng === 'number' ? userBirthLng : undefined,
        ayanamsa,
        la: 'en',
        endpoints: endpointSet,
        force_refresh: forceRefresh,
      });
      if (isMountedRef.current) {
        setPayload(response.data || null);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load astrology');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [ayanamsa, endpointSet, userBirthLat, userBirthLng]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchBaseAstrology(false);
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchBaseAstrology]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.08,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.94,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [glowAnim]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBaseAstrology(true);
  };

  const detailSections: DetailSection[] = useMemo(() => {
    return Array.isArray(payload?.detail_sections) ? payload.detail_sections : [];
  }, [payload?.detail_sections]);
  const birthSection = detailSections.find((section) => section.key === 'birth_details');
  const kundliSection = detailSections.find((section) => section.key === 'kundli_advanced');
  const planetSection = detailSections.find((section) => section.key === 'planet_position');
  const birthPlaceFromPayload = birthSection?.rows.find((row) =>
    row.label.toLowerCase().includes('birth place')
  )?.value;
  const birthSnapshotRows: InfoRowType[] = [
    { label: isKundliMode ? 'DOB' : 'Date of Birth', value: (user as any)?.date_of_birth || 'Birth date unavailable' },
    { label: isKundliMode ? 'DOT' : 'Birth Time', value: (user as any)?.time_of_birth || 'Birth time unavailable' },
    { label: isKundliMode ? 'DOP' : 'Birth Place', value: birthPlaceFromPayload || (user as any)?.place_of_birth || 'Birth place unavailable' },
  ];
  const missingBirthDetails = error.toLowerCase().includes('date of birth and time of birth are required');
  const missingCoordinates = error.toLowerCase().includes('latitude/longitude missing');

  const submitQuestion = async () => {
    const trimmed = question.trim();
    if (!trimmed || chatLoading) return;

    setChatLoading(true);
    setChatError('');
    try {
      const response = await askProkeralaAstrology({
        question: trimmed,
        astrology: payload,
        ayanamsa,
        la: 'en',
      });
      if (isMountedRef.current) {
        setChatMessages((current) => [{ question: trimmed, answer: response.data?.answer || 'No answer returned.' }, ...current]);
        setQuestion('');
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setChatError(err?.response?.data?.detail || err?.message || 'Failed to ask AI');
      }
    } finally {
      if (isMountedRef.current) setChatLoading(false);
    }
  };

  const InfoRow = ({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading Horoscope...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isKundliMode ? 'Kundli' : 'Horoscope'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Birth Snapshot</Text>
          <Text style={styles.heroTitle}>
            {isKundliMode ? 'Saved birth details used for your kundli' : 'Saved birth details used for astrology'}
          </Text>
          <Text style={styles.heroSubtext}>
            {isKundliMode
              ? 'Detailed kundli and planet positions are fetched using your saved birth location.'
              : 'Horoscope calculations now follow your saved birth location instead of device location.'}
          </Text>
          <View style={styles.snapshotList}>
            {birthSnapshotRows.map((row) => (
              <InfoRow key={row.label} label={row.label} value={row.value} icon="sparkles" />
            ))}
          </View>
        </View>

        {error ? (
          <View style={styles.section}>
            <View style={styles.errorCard}>
              <Ionicons name="warning" size={20} color={COLORS.primary} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
            {missingBirthDetails ? (
              <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/profile/edit')}>
                <Ionicons name="create-outline" size={16} color={COLORS.surface} />
                <Text style={styles.ctaButtonText}>Add Birth Details In Profile</Text>
              </TouchableOpacity>
            ) : null}
            {missingCoordinates ? (
              <TouchableOpacity style={styles.secondaryCtaButton} onPress={() => router.push('/profile/edit')}>
                <Ionicons name="location-outline" size={16} color={COLORS.primary} />
                <Text style={styles.secondaryCtaButtonText}>Save Birth Place Again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isKundliMode ? 'Ask Groq About Your Kundli' : 'Ask Groq AI'}</Text>
          <View style={styles.card}>
            <Animated.View
              pointerEvents="none"
              style={[styles.chatAura, { transform: [{ scale: glowAnim }] }]}
            />
            <View style={styles.chatOrbs}>
              <Animated.View style={[styles.chatOrb, styles.chatOrbPrimary, { transform: [{ scale: glowAnim }] }]} />
              <Animated.View style={[styles.chatOrb, styles.chatOrbSecondary, { transform: [{ scale: glowAnim }] }]} />
              <Animated.View style={[styles.chatOrb, styles.chatOrbAccent, { transform: [{ scale: glowAnim }] }]} />
            </View>
            <Text style={styles.helperText}>
              {isKundliMode
                ? 'Birth details, detailed kundli, and planet positions are fetched in the background. Ask Groq to explain them clearly.'
                : 'Birth details, Mangal Dosha, and Kaal Sarp Dosha are fetched in the background. Ask Groq to explain them in simple words.'}
            </Text>
            <View style={styles.chatFeed}>
              {chatMessages.length ? (
                chatMessages.map((message, index) => (
                  <View key={`${message.question}-${index}`} style={styles.chatBubbleWrap}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userBubbleText}>{message.question}</Text>
                    </View>
                    <View style={styles.aiBubble}>
                      <Text style={styles.chatAnswer}>{message.answer}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.helperText}>
                  {isKundliMode
                    ? 'Ask things like "Explain my detailed kundli" or "What do my planet positions mean?"'
                    : 'Ask things like "Do I have Mangal Dosha?" or "Explain my Kaal Sarp Dosha in simple language."'}
                </Text>
              )}
            </View>
            <View style={styles.askRow}>
              <TextInput
                style={styles.questionInput}
                placeholder={isKundliMode ? 'Ask Groq about your kundli' : 'Ask Groq AI about your horoscope'}
                placeholderTextColor={COLORS.textLight}
                value={question}
                onChangeText={setQuestion}
                multiline
              />
              <TouchableOpacity style={styles.askButton} onPress={submitQuestion} disabled={chatLoading}>
                {chatLoading ? (
                  <ActivityIndicator size="small" color={COLORS.surface} />
                ) : (
                  <Ionicons name="send" size={18} color={COLORS.surface} />
                )}
              </TouchableOpacity>
            </View>
            {chatError ? <Text style={styles.inlineErrorText}>{chatError}</Text> : null}
          </View>
        </View>

        {isKundliMode && (kundliSection?.rows.length || planetSection?.rows.length) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fetched In Background</Text>
            <View style={styles.card}>
              {kundliSection?.rows.length ? (
                <>
                  <Text style={styles.backgroundBlockTitle}>Detailed Kundli</Text>
                  {kundliSection.rows.map((row) => (
                    <InfoRow key={`kundli-${row.label}`} label={row.label} value={row.value} icon="star" />
                  ))}
                </>
              ) : null}
              {planetSection?.rows.length ? (
                <>
                  <Text style={[styles.backgroundBlockTitle, kundliSection?.rows.length ? styles.backgroundBlockTitleSpaced : null]}>
                    Planet Positions
                  </Text>
                  {planetSection.rows.map((row) => (
                    <InfoRow key={`planet-${row.label}`} label={row.label} value={row.value} icon="planet" />
                  ))}
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginHorizontal: SPACING.sm,
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  heroCard: {
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#F6D4B8',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.primary,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 6,
    maxWidth: '80%',
  },
  heroSubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  snapshotList: {
    marginTop: SPACING.md,
  },
  heroBadge: {
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  section: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}14`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  infoLabel: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: `${COLORS.primary}14`,
  },
  errorText: {
    flex: 1,
    marginLeft: SPACING.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  ctaButton: {
    marginTop: SPACING.sm,
    minHeight: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaButtonText: {
    color: COLORS.surface,
    fontWeight: '700',
  },
  secondaryCtaButton: {
    marginTop: SPACING.sm,
    minHeight: 44,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.surface,
  },
  secondaryCtaButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  helperText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    zIndex: 1,
  },
  chatAura: {
    position: 'absolute',
    top: -34,
    right: -18,
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(255, 153, 51, 0.12)',
  },
  chatOrbs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.sm,
    zIndex: 1,
  },
  chatOrb: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chatOrbPrimary: {
    backgroundColor: COLORS.primary,
  },
  chatOrbSecondary: {
    backgroundColor: '#F59E0B',
  },
  chatOrbAccent: {
    backgroundColor: '#FB923C',
  },
  questionInput: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.text,
    textAlignVertical: 'center',
    backgroundColor: '#FFFDF9',
  },
  askRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  askButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineErrorText: {
    color: COLORS.error,
    marginTop: SPACING.sm,
    fontSize: 13,
  },
  chatFeed: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
    zIndex: 1,
  },
  chatBubbleWrap: {
    gap: SPACING.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  userBubbleText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  aiBubble: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backgroundBlockTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  backgroundBlockTitleSpaced: {
    marginTop: SPACING.md,
  },
  chatQuestion: {
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  chatAnswer: {
    color: COLORS.text,
    lineHeight: 22,
  },
  endpointGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
  },
  endpointChip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: `${COLORS.primary}10`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}35`,
  },
  endpointChipText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  bottomPadding: {
    height: SPACING.xl,
  },
});
