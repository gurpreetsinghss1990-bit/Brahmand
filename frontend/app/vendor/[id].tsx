import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Linking,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { useVendorStore } from '../../src/store/vendorStore';

const TRUST_LABELS = {
  trusted: { label: 'Trusted Vendor', color: COLORS.success, icon: 'shield-checkmark' },
  frequent: { label: 'Frequently Used by Community', color: COLORS.info, icon: 'trending-up' },
  verified_local: { label: 'Verified Local Business', color: COLORS.primary, icon: 'location' },
};

export default function VendorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { vendors } = useVendorStore();
  
  const vendor = vendors.find(v => v.id === id);

  if (!vendor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="storefront-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.errorText}>Vendor not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const trustInfo = TRUST_LABELS[vendor.trustLabel];

  const handleCall = () => {
    Linking.openURL(`tel:${vendor.phoneNumber}`);
  };

  const handleDirections = () => {
    if (vendor.locationLink) {
      Linking.openURL(vendor.locationLink);
    } else if (vendor.latitude && vendor.longitude) {
      Linking.openURL(`https://maps.google.com/?q=${vendor.latitude},${vendor.longitude}`);
    } else {
      Alert.alert('No Location', 'Location not available for this vendor.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{vendor.businessName}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Photo */}
        <View style={styles.coverPhoto}>
          {vendor.coverPhoto ? (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image" size={40} color={COLORS.textLight} />
            </View>
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="storefront" size={60} color={COLORS.primary} />
            </View>
          )}
        </View>

        {/* Business Info */}
        <View style={styles.infoSection}>
          <Text style={styles.businessName}>{vendor.businessName}</Text>
          <Text style={styles.ownerName}>by {vendor.ownerName}</Text>
          
          {/* Trust Badge */}
          <View style={[styles.trustBadge, { backgroundColor: `${trustInfo.color}15` }]}>
            <Ionicons name={trustInfo.icon as any} size={16} color={trustInfo.color} />
            <Text style={[styles.trustText, { color: trustInfo.color }]}>{trustInfo.label}</Text>
          </View>

          {/* Years in Business */}
          {vendor.yearsInBusiness && (
            <View style={styles.metaRow}>
              <Ionicons name="time" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{vendor.yearsInBusiness} years in business</Text>
            </View>
          )}

          {/* Distance */}
          <View style={styles.metaRow}>
            <Ionicons name="location" size={16} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>{vendor.distance?.toFixed(1)} km away</Text>
          </View>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Categories</Text>
          <View style={styles.categoriesContainer}>
            {vendor.categories.map((cat, index) => (
              <View key={index} style={styles.categoryChip}>
                <Text style={styles.categoryText}>{cat}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <Text style={styles.addressText}>{vendor.address}</Text>
          <TouchableOpacity style={styles.directionsButton} onPress={handleDirections}>
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
            <Text style={styles.directionsText}>Get Directions</Text>
          </TouchableOpacity>
        </View>

        {/* Gallery Photos */}
        {vendor.galleryPhotos && vendor.galleryPhotos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gallery</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {vendor.galleryPhotos.map((photo, index) => (
                <View key={index} style={styles.galleryPhoto}>
                  <Ionicons name="image" size={24} color={COLORS.textLight} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Opening Hours */}
        {vendor.openingHours && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Opening Hours</Text>
            <Text style={styles.hoursText}>{vendor.openingHours}</Text>
          </View>
        )}

        {/* Offers */}
        {vendor.offers && (
          <View style={styles.offerSection}>
            <Ionicons name="pricetag" size={20} color={COLORS.warning} />
            <Text style={styles.offerText}>{vendor.offers}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Call Button */}
      <View style={styles.callButtonContainer}>
        <TouchableOpacity style={styles.callButton} onPress={handleCall}>
          <Ionicons name="call" size={22} color="#FFFFFF" />
          <Text style={styles.callButtonText}>Call Now</Text>
        </TouchableOpacity>
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
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
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
  coverPhoto: {
    height: 180,
    backgroundColor: COLORS.surface,
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}10`,
  },
  infoSection: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  businessName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  ownerName: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: SPACING.md,
  },
  trustText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  metaText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  section: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryChip: {
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
  },
  categoryText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  addressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.info,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: 6,
  },
  directionsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  galleryPhoto: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  hoursText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  offerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  offerText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.warning,
    fontWeight: '500',
  },
  callButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
