import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { BORDER_RADIUS, COLORS, SPACING } from '../../src/constants/theme';
import { useVendorStore, Vendor } from '../../src/store/vendorStore';
import { useAuthStore } from '../../src/store/authStore';
import { extractKycTextFromImage } from '../../src/services/api';
import { CollapsibleSection } from '../../src/components/CollapsibleSection';

const IMAGE_SLOTS = [0, 1, 2, 3, 4];

export default function VendorBusinessDetailsScreen() {
  const router = useRouter();
  const { myVendor, fetchMyVendor, uploadBusinessImage, updateBusinessProfile } = useVendorStore();
  const { isLoading: authLoading, isAuthenticated } = useAuthStore();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth' as any);
    }
  }, [authLoading, isAuthenticated, router]);

  const [loadingSlot, setLoadingSlot] = useState<number | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionExtractedItems, setVisionExtractedItems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Form states
  const [menuItems, setMenuItems] = useState<string[]>([]);
  const [menuInput, setMenuInput] = useState('');
  const [offersHomeDelivery, setOffersHomeDelivery] = useState(false);
  const [offersCashOnDelivery, setOffersCashOnDelivery] = useState(false);
  const [businessHours, setBusinessHours] = useState('');
  const [notes, setNotes] = useState('');
  const [offers, setOffers] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  useEffect(() => {
    fetchMyVendor().catch((error) => {
      console.warn('Failed to refresh vendor before business details', error);
    });
  }, [fetchMyVendor]);

  useEffect(() => {
    if (!myVendor) return;
    setMenuItems(myVendor.menu_items || []);
    setOffersHomeDelivery(Boolean(myVendor.offers_home_delivery));
    setOffersCashOnDelivery(Boolean(myVendor.offers_cash_on_delivery));
    setBusinessHours(myVendor.business_hours || '');
    setNotes(myVendor.notes || '');
    setOffers(myVendor.offers || '');
    setWebsiteLink(myVendor.website_link || '');
    setFacebook(myVendor.social_media?.facebook || '');
    setInstagram(myVendor.social_media?.instagram || '');
    setWhatsapp(myVendor.social_media?.whatsapp || '');
  }, [myVendor]);

  const galleryImages = useMemo(() => {
    const existing = [...(myVendor?.business_gallery_images || [])];
    while (existing.length < 5) {
      existing.push('');
    }
    return existing;
  }, [myVendor?.business_gallery_images]);

  const handleBack = () => {
    if (router.canGoBack && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/vendor/dashboard');
    }
  };

  const validateAccess = () => {
    if (!myVendor) {
      Alert.alert('Business not found', 'Please register your business first.');
      router.replace('/(tabs)/vendor');
      return false;
    }
    if ((myVendor as any).kyc_status !== 'verified') {
      Alert.alert('Not available', 'This section is available only for approved businesses.');
      router.replace('/vendor/dashboard');
      return false;
    }
    return true;
  };

  const pickAndUploadImage = async (slot: number) => {
    if (!validateAccess() || !myVendor) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library access is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const fileName = (asset as any).fileName || `business-${slot + 1}.jpg`;
    const mimeType = asset.mimeType || 'image/jpeg';

    try {
      setLoadingSlot(slot);
      await uploadBusinessImage(myVendor.id, slot, { uri: asset.uri, name: fileName, type: mimeType });
      await fetchMyVendor();
    } catch (error: any) {
      Alert.alert('Upload failed', error?.response?.data?.detail || 'Could not upload image.');
    } finally {
      setLoadingSlot(null);
    }
  };

  const addMenuItem = () => {
    const value = menuInput.trim();
    if (!value) return;
    if (menuItems.length >= 30) {
      Alert.alert('Limit reached', 'You can add up to 30 menu items.');
      return;
    }
    if (menuItems.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setMenuInput('');
      return;
    }
    setMenuItems([...menuItems, value]);
    setMenuInput('');
  };

  const removeMenuItem = (index: number) => {
    setMenuItems(menuItems.filter((_, i) => i !== index));
  };

  const handleAddExtractedItem = (item: string, idx: number) => {
    if (menuItems.length >= 30) {
      Alert.alert('Limit reached', 'Maximum 30 menu items allowed.');
      return;
    }
    setMenuItems([...menuItems, item]);
    setVisionExtractedItems(visionExtractedItems.filter((_, i) => i !== idx));
  };

  const handleOcrUpload = async () => {
    if (!validateAccess() || !myVendor) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library access is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const fileName = (asset as any).fileName || `menu-${Date.now()}.jpg`;
    const mimeType = asset.mimeType || 'image/jpeg';

    try {
      setVisionLoading(true);
      const response = await extractKycTextFromImage(myVendor.id, {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      });

      const extracted = response?.data?.raw_texts || [];
      const fallbackText = response?.data?.text || response?.data?.full_text || '';
      const source = extracted.length > 0 ? extracted.join('\n') : fallbackText;
      const parsed: string[] = source
        .split(/[\n;•●·,]/)
        .map((t: string) => t.trim())
        .filter((t: string): t is string => Boolean(t));
      const uniqueParsed = Array.from(new Set(parsed));
      setVisionExtractedItems(uniqueParsed);

      if (!uniqueParsed.length) {
        Alert.alert('No items found', 'Cloud Vision did not detect menu text. Please try another image.');
      }
    } catch (error: any) {
      console.error('[OCR] Menu OCR failed:', error);
      Alert.alert('Upload failed', error?.message || 'Could not process menu image.');
    } finally {
      setVisionLoading(false);
    }
  };

  const saveAllDetails = async () => {
    if (!validateAccess() || !myVendor) return;

    try {
      setSaving(true);
      await updateBusinessProfile(myVendor.id, {
        menu_items: menuItems,
        offers_home_delivery: offersHomeDelivery,
        offers_cash_on_delivery: offersCashOnDelivery,
        business_hours: businessHours,
        notes: notes,
        offers: offers,
        website_link: websiteLink,
        social_media: {
          facebook,
          instagram,
          whatsapp,
        },
      });
      Alert.alert('Saved', 'Business details updated successfully.');
    } catch (error: any) {
      Alert.alert('Save failed', error?.response?.data?.detail || 'Could not save business details.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !myVendor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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
        <Text style={styles.headerTitle}>Tell about your business</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.topTitle}>Select the things related to your business:</Text>

        {/* Section 1: Business Images */}
        <CollapsibleSection title="Business Images" icon="images" defaultExpanded={true}>
          <Text style={styles.sectionDescription}>Add photos of your shop, products, or services to attract customers</Text>
          <View style={styles.imageGrid}>
            {IMAGE_SLOTS.map((slot) => {
              const imageUrl = galleryImages[slot];
              const isUploading = loadingSlot === slot;
              return (
                <TouchableOpacity key={slot} style={styles.imageBox} onPress={() => pickAndUploadImage(slot)}>
                  {isUploading ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
                  ) : (
                    <Ionicons name="add" size={34} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </CollapsibleSection>

        {/* Section 2: Menu */}
        <CollapsibleSection title="Menu / Products" icon="restaurant" defaultExpanded={true}>
          <Text style={styles.sectionDescription}>List the dishes, items, or services you offer. Upload a menu image to auto-detect items.</Text>
          <TouchableOpacity style={styles.ocrButton} onPress={handleOcrUpload} disabled={visionLoading}>
            {visionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color="#fff" />
                <Text style={styles.ocrButtonText}>Upload Menu Image (OCR)</Text>
              </>
            )}
          </TouchableOpacity>

          {visionExtractedItems.length > 0 && (
            <View style={styles.extractedSection}>
              <Text style={styles.extractedTitle}>Detected items - tap + to add:</Text>
              {visionExtractedItems.map((item, idx) => (
                <TouchableOpacity key={`${item}-${idx}`} style={styles.extractedItem} onPress={() => handleAddExtractedItem(item, idx)}>
                  <Text style={styles.extractedText}>• {item}</Text>
                  <Ionicons name="add-circle" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setVisionExtractedItems([])}>
                <Text style={styles.clearText}>Clear all</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.menuInputRow}>
            <TextInput
              style={styles.menuInput}
              placeholder="Add menu item (e.g., Paneer Thali - ₹250)"
              placeholderTextColor={COLORS.textLight}
              value={menuInput}
              onChangeText={setMenuInput}
            />
            <TouchableOpacity style={styles.addButton} onPress={addMenuItem}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {menuItems.length > 0 && (
            <View style={styles.menuList}>
              {menuItems.map((item, idx) => (
                <View key={`${item}-${idx}`} style={styles.menuItem}>
                  <Text style={styles.menuItemText}>{item}</Text>
                  <TouchableOpacity onPress={() => removeMenuItem(idx)}>
                    <Ionicons name="close-circle" size={20} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </CollapsibleSection>

        {/* Section 3: Business Hours */}
        <CollapsibleSection title="Business Hours" icon="time" defaultExpanded={true}>
          <Text style={styles.sectionDescription}>Let customers know when you're open</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Mon-Sat: 9 AM - 9 PM, Sunday: Closed"
            placeholderTextColor={COLORS.textLight}
            value={businessHours}
            onChangeText={setBusinessHours}
            multiline
          />
        </CollapsibleSection>

        {/* Section 4: Offers & Deals */}
        <CollapsibleSection title="Offers & Deals" icon="pricetag" defaultExpanded={true}>
          <Text style={styles.sectionDescription}>Attract customers with special offers, discounts, or deals</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., 10% off on first order, Free delivery above ₹500"
            placeholderTextColor={COLORS.textLight}
            value={offers}
            onChangeText={setOffers}
            multiline
          />
        </CollapsibleSection>

        {/* Section 5: Delivery Options */}
        <CollapsibleSection title="Delivery Options" icon="bicycle" defaultExpanded={true}>
          <Text style={styles.sectionDescription}>Tell customers about your delivery services</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Home Delivery</Text>
            <View style={styles.toggleButtons}>
              <TouchableOpacity
                style={[styles.toggleButton, offersHomeDelivery && styles.toggleButtonActive]}
                onPress={() => setOffersHomeDelivery(true)}
              >
                <Text style={[styles.toggleText, offersHomeDelivery && styles.toggleTextActive]}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, !offersHomeDelivery && styles.toggleButtonActive]}
                onPress={() => setOffersHomeDelivery(false)}
              >
                <Text style={[styles.toggleText, !offersHomeDelivery && styles.toggleTextActive]}>No</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Cash on Delivery</Text>
            <View style={styles.toggleButtons}>
              <TouchableOpacity
                style={[styles.toggleButton, offersCashOnDelivery && styles.toggleButtonActive]}
                onPress={() => setOffersCashOnDelivery(true)}
              >
                <Text style={[styles.toggleText, offersCashOnDelivery && styles.toggleTextActive]}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, !offersCashOnDelivery && styles.toggleButtonActive]}
                onPress={() => setOffersCashOnDelivery(false)}
              >
                <Text style={[styles.toggleText, !offersCashOnDelivery && styles.toggleTextActive]}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </CollapsibleSection>

        {/* Section 6: Website & Social Media */}
        <CollapsibleSection title="Website & Social Media" icon="globe" defaultExpanded={true}>
          <Text style={styles.sectionDescription}>Connect with customers through your online presence</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Website (e.g., https://mybusiness.com)"
            placeholderTextColor={COLORS.textLight}
            value={websiteLink}
            onChangeText={setWebsiteLink}
            autoCapitalize="none"
            keyboardType="url"
          />
          
          <TextInput
            style={styles.textInput}
            placeholder="Facebook URL or Page ID"
            placeholderTextColor={COLORS.textLight}
            value={facebook}
            onChangeText={setFacebook}
            autoCapitalize="none"
          />
          
          <TextInput
            style={styles.textInput}
            placeholder="Instagram handle (e.g., @mybusiness)"
            placeholderTextColor={COLORS.textLight}
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
          />
          
          <TextInput
            style={styles.textInput}
            placeholder="WhatsApp number (e.g., 919876543210)"
            placeholderTextColor={COLORS.textLight}
            value={whatsapp}
            onChangeText={setWhatsapp}
            keyboardType="phone-pad"
          />
        </CollapsibleSection>

        {/* Section 7: Notes */}
        <CollapsibleSection title="Additional Notes" icon="document-text" defaultExpanded={true}>
          <Text style={styles.sectionDescription}>Any other information you'd like customers to know</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            placeholder="Any additional information about your business..."
            placeholderTextColor={COLORS.textLight}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </CollapsibleSection>

        <TouchableOpacity style={styles.saveButton} onPress={saveAllDetails} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save All Details</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.md },
  
  // Top title
  topTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 18,
  },
  
  // Image grid
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  imageBox: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  
  // OCR Section
  ocrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    marginTop: SPACING.sm,
  },
  ocrButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  
  extractedSection: { marginTop: SPACING.md, gap: SPACING.xs },
  extractedTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  extractedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  extractedText: { color: COLORS.text, flex: 1, fontSize: 13 },
  clearText: { color: COLORS.error, fontSize: 12, marginTop: SPACING.xs },
  
  // Menu input
  menuInputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  menuInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Menu list
  menuList: { marginTop: SPACING.sm, gap: SPACING.xs },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  menuItemText: { color: COLORS.text, flex: 1 },
  
  // Text inputs
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    marginTop: SPACING.sm,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  
  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  toggleLabel: { fontSize: 14, color: COLORS.text },
  toggleButtons: { flexDirection: 'row', gap: SPACING.sm },
  toggleButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
  },
  toggleButtonActive: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}12` },
  toggleText: { fontSize: 13, color: COLORS.textSecondary },
  toggleTextActive: { color: COLORS.primary, fontWeight: '600' },
  
  // Save
  saveButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
