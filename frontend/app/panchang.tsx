import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../src/constants/theme';

// Placeholder Panchang screen for full view
export default function PanchangScreen() {
  const router = useRouter();

  const panchangData = {
    date: new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    tithi: 'Ekadashi',
    paksha: 'Shukla Paksha',
    nakshatra: 'Rohini',
    yoga: 'Siddhi',
    karana: 'Bava',
    sunrise: '6:22 AM',
    sunset: '6:41 PM',
    moonrise: '10:30 PM',
    moonset: '9:15 AM',
    rahu_kaal: '3:00 PM - 4:30 PM',
    gulika_kaal: '12:00 PM - 1:30 PM',
    yamaganda: '7:30 AM - 9:00 AM',
    vrat: 'Ekadashi Vrat',
    hindu_month: 'Chaitra',
    samvat: '2082',
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Today's Panchang</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Date Card */}
        <View style={styles.dateCard}>
          <Ionicons name="calendar" size={24} color={COLORS.primary} />
          <Text style={styles.dateText}>{panchangData.date}</Text>
          <Text style={styles.samvatText}>Vikram Samvat {panchangData.samvat} | {panchangData.hindu_month}</Text>
        </View>

        {/* Main Panchang Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Panchang Details</Text>
          <View style={styles.card}>
            <InfoRow label="Tithi" value={panchangData.tithi} icon="moon" />
            <InfoRow label="Paksha" value={panchangData.paksha} icon="contrast" />
            <InfoRow label="Nakshatra" value={panchangData.nakshatra} icon="star" />
            <InfoRow label="Yoga" value={panchangData.yoga} icon="infinite" />
            <InfoRow label="Karana" value={panchangData.karana} icon="grid" />
          </View>
        </View>

        {/* Sun & Moon */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sun & Moon</Text>
          <View style={styles.card}>
            <InfoRow label="Sunrise" value={panchangData.sunrise} icon="sunny" />
            <InfoRow label="Sunset" value={panchangData.sunset} icon="sunny-outline" />
            <InfoRow label="Moonrise" value={panchangData.moonrise} icon="moon" />
            <InfoRow label="Moonset" value={panchangData.moonset} icon="moon-outline" />
          </View>
        </View>

        {/* Inauspicious Timings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inauspicious Timings</Text>
          <View style={styles.card}>
            <InfoRow label="Rahu Kaal" value={panchangData.rahu_kaal} icon="warning" />
            <InfoRow label="Gulika Kaal" value={panchangData.gulika_kaal} icon="alert-circle" />
            <InfoRow label="Yamaganda" value={panchangData.yamaganda} icon="alert" />
          </View>
        </View>

        {/* Vrat Info */}
        {panchangData.vrat && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Vrat</Text>
            <View style={styles.vratCard}>
              <Ionicons name="flower" size={24} color={COLORS.primary} />
              <Text style={styles.vratText}>{panchangData.vrat}</Text>
            </View>
          </View>
        )}

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
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  dateCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  samvatText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  section: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  vratCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  vratText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: SPACING.md,
  },
  bottomPadding: {
    height: SPACING.xl,
  },
});
