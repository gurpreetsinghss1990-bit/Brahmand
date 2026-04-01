import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { getProkeralaPanchang, askProkeralaAstrology, reverseGeocode, forwardGeocode } from '../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../src/constants/theme';
import { useAuthStore } from '../src/store/authStore';
import LocationService from '../src/services/location';

type PanchangRow = {
  label: string;
  value: string;
};

const DEFAULT_ENDPOINTS = 'panchang_advanced,choghadiya,tara_bala,chandra_bala,auspicious_yoga,gowri_nalla_neram,auspicious_period,inauspicious_period';

export default function PanchangScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string; needsLocation?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const userLocation = (user as any)?.home_location;
  const initialLocationLabel = [
    (user as any)?.location?.area,
    (user as any)?.location?.city,
    (user as any)?.location?.state,
  ].filter(Boolean).join(', ') || 'Current location unavailable';
  const [customLocation, setCustomLocation] = useState('');
  const [activeCoords, setActiveCoords] = useState<{ lat?: number; lng?: number }>({
    lat: userLocation?.latitude,
    lng: userLocation?.longitude,
  });
  const [activeLocationLabel, setActiveLocationLabel] = useState(initialLocationLabel);
  const [locationLoading, setLocationLoading] = useState(false);
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

  const parsedLat = useMemo(() => {
    const value = Number(params.lat);
    return Number.isFinite(value) ? value : undefined;
  }, [params.lat]);

  const parsedLng = useMemo(() => {
    const value = Number(params.lng);
    return Number.isFinite(value) ? value : undefined;
  }, [params.lng]);

  const reverseGeocodeLabel = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await reverseGeocode(lat, lng);
      const data = response?.data || {};
      return [data.area, data.city, data.state].filter(Boolean).join(', ') || data.display_name || 'Current location';
    } catch {
      return 'Current location';
    }
  }, []);

  const resolveCoordinatesFromText = useCallback(async (placeText: string) => {
    const candidates = [placeText, `${placeText}, India`, `${placeText}, Bharat`];

    for (const candidate of candidates) {
      try {
        const results = await Location.geocodeAsync(candidate);
        if (Array.isArray(results) && results.length > 0) {
          return { lat: results[0].latitude, lng: results[0].longitude };
        }
      } catch {
        // Try next fallback source
      }
    }

    try {
      const response = await forwardGeocode(placeText);
      const data = response?.data || {};
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return { lat: data.latitude, lng: data.longitude };
      }
    } catch {
      // Continue to direct fallback
    }

    const q = encodeURIComponent(placeText);
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${q}`);
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    return null;
  }, []);

  const requestCurrentLocationForPanchang = useCallback(async (showPromptOnFailure = false) => {
    try {
      const permissionGranted = await LocationService.ensureForegroundPermission();
      if (!permissionGranted) {
        if (showPromptOnFailure) {
          Alert.alert(
            'Location Permission Needed',
            'Please allow location access in Safari settings to fetch Panchang for your current place.'
          );
        }
        return null;
      }

      const location = await LocationService.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 10000,
      });

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      return { lat, lng };
    } catch {
      if (showPromptOnFailure) {
        Alert.alert('Location Error', 'Could not fetch your current location. Please enable location and try again.');
      }
      return null;
    }
  }, []);

  const handleBack = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  const fetchBasePanchang = useCallback(async (forceRefresh = false, coords?: { lat?: number; lng?: number }) => {
    try {
      if (!isMountedRef.current) return;
      setError('');
      const lat = coords?.lat ?? activeCoords.lat;
      const lng = coords?.lng ?? activeCoords.lng;
      const response = await getProkeralaPanchang({
        lat: typeof lat === 'number' ? lat : undefined,
        lng: typeof lng === 'number' ? lng : undefined,
        endpoints: DEFAULT_ENDPOINTS,
        force_refresh: forceRefresh,
      });
      if (isMountedRef.current) {
        setPayload(response.data || null);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load Panchang');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeCoords.lat, activeCoords.lng]);

  useEffect(() => {
    isMountedRef.current = true;

    const initializePanchang = async () => {
      let initialCoords: { lat?: number; lng?: number } | null = null;

      if (typeof parsedLat === 'number' && typeof parsedLng === 'number') {
        initialCoords = { lat: parsedLat, lng: parsedLng };
      } else if (typeof activeCoords.lat === 'number' && typeof activeCoords.lng === 'number') {
        initialCoords = { lat: activeCoords.lat, lng: activeCoords.lng };
      } else {
        initialCoords = await requestCurrentLocationForPanchang(Platform.OS === 'web' || params.needsLocation === '1');
      }

      if (initialCoords && typeof initialCoords.lat === 'number' && typeof initialCoords.lng === 'number') {
        setActiveCoords(initialCoords);
        const label = await reverseGeocodeLabel(initialCoords.lat, initialCoords.lng);
        if (isMountedRef.current) {
          setActiveLocationLabel(label || 'Current location');
        }
        await fetchBasePanchang(false, initialCoords);
        return;
      }

      await fetchBasePanchang(false);
    };

    initializePanchang();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchBasePanchang, params.needsLocation, parsedLat, parsedLng, activeCoords.lat, activeCoords.lng, requestCurrentLocationForPanchang, reverseGeocodeLabel]);

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
    fetchBasePanchang(true);
  };

  const summary = payload?.summary ?? {};
  const panchangSource = payload?.sources?.panchang_advanced?.data ?? payload?.sources?.panchang_advanced ?? {};
  const detailSections = Array.isArray(payload?.detail_sections) ? payload.detail_sections : [];

  const displayDate = payload?.date
    ? new Date(payload.date).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  const formatClock = (value: any): string | null => {
    if (!value) return null;
    const raw = String(value);
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    const match = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    if (match) {
      const [, hh, mm] = match;
      const hour = Number(hh);
      const suffix = hour >= 12 ? 'PM' : 'AM';
      const normalized = hour % 12 || 12;
      return `${normalized}:${mm} ${suffix}`;
    }
    return raw;
  };

  const extractNamedIntervalParts = (value: any): { name: string | null; start: string | null; end: string | null } => {
    if (!value || typeof value !== 'object') {
      return { name: null, start: null, end: null };
    }

    const name =
      (typeof value?.name === 'string' && value.name.trim()) ||
      (typeof value?.title === 'string' && value.title.trim()) ||
      (typeof value?.result === 'string' && value.result.trim()) ||
      (typeof value?.status === 'string' && value.status.trim()) ||
      null;

    const start =
      formatClock(value?.start) ||
      formatClock(value?.start_time) ||
      formatClock(value?.from) ||
      null;
    const end =
      formatClock(value?.end) ||
      formatClock(value?.end_time) ||
      formatClock(value?.to) ||
      null;

    if (name || start || end) {
      return { name, start, end };
    }

    for (const nestedKey of ['current', 'details', 'value', 'data', 'item', 'active', 'present']) {
      const nestedValue = value?.[nestedKey];
      if (nestedValue && typeof nestedValue === 'object') {
        const nestedParts = extractNamedIntervalParts(nestedValue);
        if (nestedParts.name || nestedParts.start || nestedParts.end) {
          return nestedParts;
        }
      }
    }

    for (const nestedValue of Object.values(value)) {
      if (nestedValue && typeof nestedValue === 'object') {
        const nestedParts = extractNamedIntervalParts(nestedValue);
        if (nestedParts.name || nestedParts.start || nestedParts.end) {
          return nestedParts;
        }
      }
    }

    return { name: null, start: null, end: null };
  };

  const getNamedPanchangValue = (field: string): string | null => {
    const raw = panchangSource?.[field];
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return null;
    if (typeof item !== 'object') return String(item);
    const { name, start, end } = extractNamedIntervalParts(item);
    if (name && start && end) return `${name} (${start} - ${end})`;
    if (name && end) return `${name} until ${end}`;
    if (name) return String(name);
    if (start && end) return `${start} - ${end}`;
    return null;
  };
  const overviewRows: PanchangRow[] = (
    Array.isArray(summary.overview) ? summary.overview : []
  ).map((row: PanchangRow) => {
    const label = row.label.toLowerCase();
    if (label === 'tithi') {
      return { ...row, value: getNamedPanchangValue('tithi') || row.value };
    }
    if (label === 'nakshatra') {
      return { ...row, value: getNamedPanchangValue('nakshatra') || row.value };
    }
    if (label === 'yoga') {
      return { ...row, value: getNamedPanchangValue('yoga') || row.value };
    }
    if (label === 'karana') {
      return { ...row, value: getNamedPanchangValue('karana') || row.value };
    }
    return row;
  });
  const timingRows: PanchangRow[] = (
    Array.isArray(summary.timings) ? summary.timings : []
  ).filter((row: PanchangRow) =>
    ['sunrise', 'sunset', 'moonrise', 'moonset'].includes(row.label.toLowerCase())
  );

  const toTitle = (value: string) =>
    value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const buildPeriodRows = (source: any, fallbackLabel: string): PanchangRow[] => {
    const rows: PanchangRow[] = [];
    const seen = new Set<string>();

    const visit = (node: any, prefix?: string, typeInfo?: string) => {
      if (!node || rows.length >= 8) return;

      if (Array.isArray(node)) {
        node.forEach((item) => visit(item, prefix));
        return;
      }

      if (typeof node !== 'object') return;

      // Get type info (Auspicious/Inauspicious) from node
      const nodeType = node?.type === 'Auspicious' || node?.type === 'Inauspicious' ? node.type : typeInfo;
      const typePrefix = nodeType ? `[${nodeType}] ` : '';

      const explicitName =
        (typeof node?.name === 'string' && node.name.trim()) ||
        (typeof node?.title === 'string' && node.title.trim()) ||
        (typeof node?.label === 'string' && node.label.trim()) ||
        null;
      
      // Handle period array format (from prokerala API: { period: [{ start, end }] })
      const periodArray = node?.period;
      if (Array.isArray(periodArray) && periodArray.length > 0) {
        periodArray.forEach((periodItem: any) => {
          const pStart =
            formatClock(periodItem?.start) ||
            formatClock(periodItem?.start_time) ||
            formatClock(periodItem?.from) ||
            null;
          const pEnd =
            formatClock(periodItem?.end) ||
            formatClock(periodItem?.end_time) ||
            formatClock(periodItem?.to) ||
            null;
          
          const label = explicitName || prefix || fallbackLabel;
          const fullLabel = typePrefix + label;
          
          if (label && (pStart || pEnd)) {
            const value = pStart && pEnd ? `${pStart} - ${pEnd}` : pStart || pEnd || '';
            const key = `${fullLabel}:${value}`;
            if (!seen.has(key) && value) {
              seen.add(key);
              rows.push({ label: fullLabel, value });
            }
          }
        });
      }

      // Also check for direct start/end fields
      const start =
        formatClock(node?.start) ||
        formatClock(node?.start_time) ||
        formatClock(node?.from) ||
        formatClock(node?.begin) ||
        null;
      const end =
        formatClock(node?.end) ||
        formatClock(node?.end_time) ||
        formatClock(node?.to) ||
        formatClock(node?.finish) ||
        null;

      const label = explicitName || prefix || fallbackLabel;
      const fullLabel = typePrefix + label;
      if (label && (start || end) && !periodArray?.length) {
        const value = start && end ? `${start} - ${end}` : start || end || '';
        const key = `${fullLabel}:${value}`;
        if (!seen.has(key) && value) {
          seen.add(key);
          rows.push({ label: fullLabel, value });
        }
      }

      // Pass type info to nested objects
      const nestedType = nodeType || (explicitName ? nodeType : undefined);
      
      const preferredKeys = ['periods', 'items', 'data', 'details', 'current', 'active', 'present', 'value', 'list', 'muhurat'];
      preferredKeys.forEach((key) => {
        const nestedValue = node?.[key];
        if (nestedValue && typeof nestedValue === 'object') {
          visit(nestedValue, explicitName || prefix, nestedType);
        }
      });

      Object.entries(node).forEach(([key, nestedValue]) => {
        if (preferredKeys.includes(key) || !nestedValue || typeof nestedValue !== 'object') {
          return;
        }
        visit(nestedValue, explicitName || prefix || toTitle(key), nestedType);
      });
    };

    visit(source);
    return rows;
  };

  const flattenDisplayRows = (value: any, prefix = ''): PanchangRow[] => {
    const rows: PanchangRow[] = [];

    if (value === null || value === undefined || value === '' || rows.length >= 12) {
      return rows;
    }

    if (Array.isArray(value)) {
      value.slice(0, 8).forEach((item, index) => {
        rows.push(...flattenDisplayRows(item, prefix || `${index + 1}`));
      });
      return rows.slice(0, 12);
    }

    if (typeof value !== 'object') {
      if (prefix) {
        rows.push({ label: prefix, value: String(value) });
      }
      return rows;
    }

    const start =
      formatClock(value?.start) ||
      formatClock(value?.start_time) ||
      formatClock(value?.from) ||
      null;
    const end =
      formatClock(value?.end) ||
      formatClock(value?.end_time) ||
      formatClock(value?.to) ||
      null;

    if (prefix && (start || end)) {
      rows.push({ label: prefix, value: start && end ? `${start} - ${end}` : start || end || '' });
      return rows;
    }

    Object.entries(value).forEach(([key, item]) => {
      if (rows.length >= 12) return;
      const nextLabel = prefix ? `${prefix} ${toTitle(key)}` : toTitle(key);
      if (item && typeof item === 'object') {
        rows.push(...flattenDisplayRows(item, nextLabel));
      } else if (item !== null && item !== undefined && item !== '') {
        rows.push({ label: nextLabel, value: String(item) });
      }
    });

    return rows.slice(0, 12);
  };

  const dedupeRows = (rows: PanchangRow[]) => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const normalizedLabel = row.label.trim();
      const normalizedValue = row.value.trim();
      if (!normalizedLabel || !normalizedValue) return false;
      const key = `${normalizedLabel.toLowerCase()}::${normalizedValue.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const summaryAuspiciousRows: PanchangRow[] = (
    Array.isArray(summary.insights) ? summary.insights : []
  ).filter((row: PanchangRow) => row.label.toLowerCase().includes('auspicious'));
  const detailAuspiciousRows: PanchangRow[] =
    detailSections.find((section: any) => section?.key === 'auspicious_period')?.rows ?? [];

  const rawAuspiciousRows = buildPeriodRows(
    payload?.sources?.auspicious_period?.data ?? payload?.sources?.auspicious_period,
    'Auspicious Period'
  );
  const fallbackAuspiciousRows = flattenDisplayRows(
    payload?.sources?.auspicious_period?.data ?? payload?.sources?.auspicious_period,
    'Auspicious'
  );
  const auspiciousPeriodRows = dedupeRows([
    ...detailAuspiciousRows,
    ...rawAuspiciousRows,
    ...fallbackAuspiciousRows,
    ...summaryAuspiciousRows,
  ]).slice(0, 8);

  const detailInauspiciousRows: PanchangRow[] =
    detailSections.find((section: any) => section?.key === 'inauspicious_period')?.rows ?? [];
  const rawInauspiciousRows = buildPeriodRows(
    payload?.sources?.inauspicious_period?.data ?? payload?.sources?.inauspicious_period,
    'Inauspicious Period'
  );
  const fallbackInauspiciousRows = flattenDisplayRows(
    payload?.sources?.inauspicious_period?.data ?? payload?.sources?.inauspicious_period,
    'Inauspicious'
  );
  const summaryInauspiciousRows: PanchangRow[] = (
    Array.isArray(summary.timings) ? summary.timings : []
  ).filter((row: PanchangRow) => {
    const label = row.label.toLowerCase();
    return label.includes('rahu') || label.includes('gulika') || label.includes('yamaganda');
  });
  const inauspiciousPeriodRows = dedupeRows([
    ...detailInauspiciousRows,
    ...rawInauspiciousRows,
    ...fallbackInauspiciousRows,
    ...summaryInauspiciousRows,
  ]).slice(0, 8);

  const fallbackPanchangRows = dedupeRows(
    flattenDisplayRows(panchangSource, 'Panchang')
  ).slice(0, 12);

  const providerErrorMessages = useMemo(() => {
    const errors = payload?.errors;
    if (!errors || typeof errors !== 'object') {
      return [] as string[];
    }

    return Object.entries(errors)
      .map(([key, value]) => {
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        return text ? `${key}: ${text}` : null;
      })
      .filter((item): item is string => !!item)
      .slice(0, 3);
  }, [payload]);

  const hasDisplayRows =
    timingRows.length > 0 ||
    overviewRows.length > 0 ||
    auspiciousPeriodRows.length > 0 ||
    inauspiciousPeriodRows.length > 0 ||
    fallbackPanchangRows.length > 0;

  const handleCustomLocationSubmit = async () => {
    const placeText = customLocation.trim();
    if (!placeText || locationLoading) return;

    setLocationLoading(true);
    setError('');
    try {
      const result = await resolveCoordinatesFromText(placeText);
      const lat = result?.lat;
      const lng = result?.lng;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        setError('Could not find coordinates for that location.');
        return;
      }

      const nextCoords = { lat, lng };
      setActiveCoords(nextCoords);
      setActiveLocationLabel(placeText);
      await fetchBasePanchang(true, nextCoords);
    } finally {
      setLocationLoading(false);
    }
  };

  const submitQuestion = async () => {
    const trimmed = question.trim();
    if (!trimmed || chatLoading) return;

    setChatLoading(true);
    setChatError('');
    try {
      const response = await askProkeralaAstrology({
        question: trimmed,
        astrology: {
          kind: 'panchang',
          payload,
        },
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
          <Text style={styles.loadingText}>Loading Panchang...</Text>
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
        <Text style={styles.headerTitle}>Today&apos;s Panchang</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 132 + insets.bottom }}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Today&apos;s Panchang:</Text>
          <Text style={styles.heroTitleCompact}>{displayDate}</Text>
          <Text style={styles.heroSubtext}>Location: {activeLocationLabel}</Text>
          <View style={styles.customLocationRow}>
            <TextInput
              style={styles.customLocationInput}
              placeholder="Enter custom location"
              placeholderTextColor={COLORS.textLight}
              value={customLocation}
              onChangeText={setCustomLocation}
            />
            <TouchableOpacity
              style={styles.customLocationButton}
              onPress={handleCustomLocationSubmit}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color={COLORS.surface} />
              ) : (
                <Text style={styles.customLocationButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {error ? (
          <View style={styles.section}>
            <View style={styles.errorCard}>
              <Ionicons name="warning" size={20} color={COLORS.primary} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        ) : null}

        {chatMessages.length || chatError ? (
          <View style={styles.section}>
            <View style={styles.card}>
              <Animated.View pointerEvents="none" style={[styles.chatAura, { transform: [{ scale: glowAnim }] }]} />
              <View style={styles.chatOrbs}>
                <Animated.View style={[styles.chatOrb, styles.chatOrbPrimary, { transform: [{ scale: glowAnim }] }]} />
                <Animated.View style={[styles.chatOrb, styles.chatOrbSecondary, { transform: [{ scale: glowAnim }] }]} />
                <Animated.View style={[styles.chatOrb, styles.chatOrbAccent, { transform: [{ scale: glowAnim }] }]} />
              </View>
              <View style={styles.chatFeed}>
                {chatMessages.map((message, index) => (
                  <View key={`${message.question}-${index}`} style={styles.chatBubbleWrap}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userBubbleText}>{message.question}</Text>
                    </View>
                    <View style={styles.aiBubble}>
                      <Text style={styles.chatAnswer}>{message.answer}</Text>
                    </View>
                  </View>
                ))}
              </View>
              {chatError ? <Text style={styles.inlineErrorText}>{chatError}</Text> : null}
            </View>
          </View>
        ) : null}

        {timingRows.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timings</Text>
            <View style={styles.card}>
              {timingRows.map((row) => (
                <InfoRow key={`timing-${row.label}`} label={row.label} value={row.value} icon="time" />
              ))}
            </View>
          </View>
        ) : null}

        {overviewRows.length || auspiciousPeriodRows.length || inauspiciousPeriodRows.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detailed Panchang</Text>
            <View style={styles.card}>
              {overviewRows.length ? (
                <>
                  <Text style={styles.backgroundBlockTitle}>Core Details</Text>
                  {overviewRows.map((row) => (
                    <InfoRow key={`overview-${row.label}`} label={row.label} value={row.value} icon="sparkles" />
                  ))}
                </>
              ) : null}
              {auspiciousPeriodRows.length ? (
                <>
                  <Text style={[styles.backgroundBlockTitle, overviewRows.length ? styles.backgroundBlockTitleSpaced : null]}>
                    Auspicious Time
                  </Text>
                  {auspiciousPeriodRows.map((row) => (
                    <InfoRow key={`insight-${row.label}`} label={row.label} value={row.value} icon="star" />
                  ))}
                </>
              ) : null}
              {inauspiciousPeriodRows.length ? (
                <>
                  <Text
                    style={[
                      styles.backgroundBlockTitle,
                      overviewRows.length || auspiciousPeriodRows.length ? styles.backgroundBlockTitleSpaced : null,
                    ]}
                  >
                    Inauspicious Time
                  </Text>
                  {inauspiciousPeriodRows.map((row) => (
                    <InfoRow key={`inauspicious-${row.label}`} label={row.label} value={row.value} icon="warning" />
                  ))}
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        {!timingRows.length && !overviewRows.length && !auspiciousPeriodRows.length && !inauspiciousPeriodRows.length && fallbackPanchangRows.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Panchang Details</Text>
            <View style={styles.card}>
              {fallbackPanchangRows.map((row) => (
                <InfoRow key={`fallback-${row.label}-${row.value}`} label={row.label} value={row.value} icon="sparkles" />
              ))}
            </View>
          </View>
        ) : null}

        {!hasDisplayRows ? (
          <View style={styles.section}>
            <View style={styles.emptyCard}>
              <Ionicons name="information-circle" size={20} color={COLORS.primary} />
              <Text style={styles.emptyTitle}>Panchang details are temporarily unavailable</Text>
              <Text style={styles.emptyText}>
                Try pull-to-refresh, or enter a custom location like Delhi, Mumbai, or Kolkata.
              </Text>
              {providerErrorMessages.length ? (
                <View style={styles.emptyErrorList}>
                  {providerErrorMessages.map((message, index) => (
                    <Text key={`provider-error-${index}`} style={styles.emptyErrorText}>
                      • {message}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.stickyComposerWrap, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
        <View style={styles.askRow}>
          <TextInput
            style={styles.questionInput}
            placeholder="Ask AI"
            placeholderTextColor={COLORS.textLight}
            value={question}
            onChangeText={setQuestion}
            multiline
          />
          <TouchableOpacity style={styles.askButton} onPress={submitQuestion} disabled={chatLoading}>
            {chatLoading ? (
              <ActivityIndicator size="small" color={COLORS.surface} />
            ) : (
              <Text style={styles.askButtonText}>Enter</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
    maxWidth: '88%',
  },
  heroTitleCompact: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  heroSubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  customLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  customLocationInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    backgroundColor: '#FFFDF9',
  },
  customLocationButton: {
    minWidth: 88,
    minHeight: 46,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  customLocationButtonText: {
    color: COLORS.surface,
    fontWeight: '700',
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
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.divider,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyErrorList: {
    marginTop: SPACING.xs,
    gap: 4,
  },
  emptyErrorText: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 18,
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
  },
  askButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 72,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  askButtonText: {
    color: COLORS.surface,
    fontWeight: '700',
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
  chatAnswer: {
    color: COLORS.text,
    lineHeight: 22,
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
  stickyComposerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
});
