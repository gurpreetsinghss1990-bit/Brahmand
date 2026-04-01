import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
  BackHandler,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { useVendorStore } from '../../src/store/vendorStore';
import { formatDistance } from '../../src/utils/formatDistance';
import VoiceOrder from '../../src/components/VoiceOrder';

const TRUST_LABELS = {
  trusted: { label: 'Trusted Vendor', color: COLORS.success, icon: 'shield-checkmark' },
  frequent: { label: 'Frequently Used by Community', color: COLORS.info, icon: 'trending-up' },
  verified_local: { label: 'Verified Local Business', color: COLORS.primary, icon: 'location' },
};

export default function VendorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const actionBarBottomInset = Math.max(insets.bottom, SPACING.sm);
  const actionBarHeight = 64 + actionBarBottomInset;
  const { vendors, fetchMyVendor } = useVendorStore();
  
  const vendor = vendors.find(v => v.id === id);

  const handleBack = () => {
    router.replace('/(tabs)/vendor');
  };

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/vendor');
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  React.useEffect(() => {
    if (id && !vendor) {
      fetchMyVendor().catch((e) => {
        console.warn('Failed to refresh my vendor on profile load', e);
      });
    }
  }, [id, vendor, fetchMyVendor]);

  if (!vendor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
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

  const trustInfo = vendor.kyc_status === 'verified'
    ? { label: 'Approved Vendor', color: COLORS.success, icon: 'shield-checkmark' }
    : TRUST_LABELS.frequent;
  const galleryImages = (vendor.business_gallery_images || vendor.photos || []).filter((photo) => !!photo);
  const vendorCategories = Array.isArray(vendor.categories) ? vendor.categories : [];
  const menuItems = Array.isArray(vendor.menu_items) ? vendor.menu_items : [];

  const handleCall = () => {
    Linking.openURL(`tel:${vendor.phone_number}`);
  };

  const handleDirections = () => {
    if (vendor.location_link) {
      Linking.openURL(vendor.location_link);
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
        <TouchableOpacity onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{vendor.business_name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Photo */}
        <View style={styles.coverPhoto}>
          {galleryImages.length > 0 ? (
            <Image source={{ uri: galleryImages[0] }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="storefront" size={60} color={COLORS.primary} />
            </View>
          )}
        </View>

        {/* Business Info */}
        <View style={styles.infoSection}>
          <Text style={styles.businessName}>{vendor.business_name}</Text>
          <Text style={styles.ownerName}>by {vendor.owner_name}</Text>
          
          {/* Trust Badge */}
          <View style={[styles.trustBadge, { backgroundColor: `${trustInfo.color ?? COLORS.text}15` }]}>
            <Ionicons name={trustInfo.icon as any} size={16} color={trustInfo.color} />
            <Text style={[styles.trustText, { color: trustInfo.color }]}>{trustInfo.label}</Text>
          </View>

          {/* Years in Business */}
          {vendor.years_in_business !== undefined && (
            <View style={styles.metaRow}>
              <Ionicons name="time" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{vendor.years_in_business} years in business</Text>
            </View>
          )}

          {/* Distance */}
          <View style={styles.metaRow}>
            <Ionicons name="location" size={16} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>{formatDistance(vendor.distance)}</Text>
          </View>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Categories</Text>
          <View style={styles.categoriesContainer}>
            {vendorCategories.map((cat, index) => (
              <View key={index} style={styles.categoryChip}>
                <Text style={styles.categoryText}>{cat}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Gallery Photos */}
        {galleryImages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gallery</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {galleryImages.map((photo, index) => (
                <Image key={index} source={{ uri: photo }} style={styles.galleryPhoto} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <Text style={styles.addressText}>{vendor.full_address}</Text>
        </View>

        {/* Menu */}
        {menuItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Menu</Text>
            {menuItems.map((item, index) => (
              <Text key={`${item}-${index}`} style={styles.hoursText}>• {item}</Text>
            ))}
            
            <View style={{ marginTop: SPACING.md }}>
              <VoiceOrder 
                menuItems={menuItems} 
                vendorPhone={vendor.phone_number}
                vendorName={vendor.business_name}
              />
            </View>
          </View>
        )}

        {/* Business Hours */}
        {vendor.business_hours && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="time" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Business Hours</Text>
            </View>
            <Text style={styles.descriptionText}>{vendor.business_hours}</Text>
          </View>
        )}

        {/* Offers & Deals */}
        {vendor.offers && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="pricetag" size={18} color={COLORS.warning} />
              <Text style={styles.sectionTitle}>Offers & Deals</Text>
            </View>
            <Text style={styles.descriptionText}>{vendor.offers}</Text>
          </View>
        )}

        {/* Delivery Options */}
        <View style={styles.deliverySection}>
          {(vendor.offers_home_delivery || vendor.offers_cash_on_delivery) && (
            <Text style={styles.sectionTitle}>Delivery Options</Text>
          )}
          {vendor.offers_home_delivery && (
            <View style={styles.deliveryBadge}>
              <Ionicons name="bicycle" size={16} color={COLORS.success} />
              <Text style={styles.deliveryText}>Home Delivery</Text>
            </View>
          )}
          {vendor.offers_cash_on_delivery && (
            <View style={styles.deliveryBadge}>
              <Ionicons name="cash" size={16} color={COLORS.success} />
              <Text style={styles.deliveryText}>Cash on Delivery</Text>
            </View>
          )}
        </View>

        {/* Website & Social Media */}
        {(vendor.website_link || vendor.social_media?.facebook || vendor.social_media?.instagram || vendor.social_media?.whatsapp) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connect</Text>
            
            {vendor.website_link && (
              <TouchableOpacity style={styles.socialRow} onPress={() => vendor.website_link && Linking.openURL(vendor.website_link)}>
                <Ionicons name="globe" size={18} color={COLORS.primary} />
                <Text style={styles.linkText}>{vendor.website_link}</Text>
              </TouchableOpacity>
            )}
            
            {vendor.social_media?.facebook && (
              <TouchableOpacity style={styles.socialRow} onPress={() => vendor.social_media?.facebook && Linking.openURL(vendor.social_media.facebook)}>
                <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                <Text style={styles.linkText}>Facebook</Text>
              </TouchableOpacity>
            )}
            
            {vendor.social_media?.instagram && (
              <TouchableOpacity style={styles.socialRow} onPress={() => {
                const handle = vendor.social_media?.instagram?.replace('@', '');
                Linking.openURL(`https://instagram.com/${handle}`);
              }}>
                <Ionicons name="logo-instagram" size={18} color="#E4405F" />
                <Text style={styles.linkText}>{vendor.social_media.instagram}</Text>
              </TouchableOpacity>
            )}
            
            {vendor.social_media?.whatsapp && (
              <TouchableOpacity style={styles.socialRow} onPress={() => vendor.social_media?.whatsapp && Linking.openURL(`https://wa.me/${vendor.social_media.whatsapp}`)}>
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                <Text style={styles.linkText}>WhatsApp</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Notes */}
        {vendor.notes && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="document-text" size={18} color={COLORS.textSecondary} />
              <Text style={styles.sectionTitle}>Additional Notes</Text>
            </View>
            <Text style={styles.descriptionText}>{vendor.notes}</Text>
          </View>
        )}

        <View style={{ height: actionBarHeight + SPACING.lg }} />
      </ScrollView>

      {/* Fixed Action Row */}
      <View style={[styles.callButtonContainer, { paddingBottom: actionBarBottomInset }]}>
        <TouchableOpacity style={styles.callActionButton} onPress={handleCall}>
          <Ionicons name="call" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.directionsActionButton, styles.flexAction]} onPress={handleDirections}>
          <Ionicons name="navigate" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Get Directions</Text>
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
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
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
  },
  galleryPhoto: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
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
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuIconButton: {
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}20`,
    padding: 8,
  },
  menuBox: {
    backgroundColor: `${COLORS.secondary}10`,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  menuBoxText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  menuUploadButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    alignSelf: 'stretch',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuUploadButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  detectedItemsContainer: {
    marginTop: SPACING.sm,
  },
  detectedItemsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  detectedItemText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  saveButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.success,
    alignSelf: 'stretch',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  offerText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.warning,
    fontWeight: '500',
  },
  callButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 64,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  flexAction: {
    flex: 1,
  },
  callActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  directionsActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.info,
    minHeight: 48,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
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
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  deliverySection: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  deliveryText: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '500',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  linkText: {
    fontSize: 14,
    color: COLORS.primary,
    flex: 1,
  },
});
