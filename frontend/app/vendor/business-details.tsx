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
import { useVendorStore } from '../../src/store/vendorStore';
import { extractKycTextFromImage } from '../../src/services/api';

const IMAGE_SLOTS = [0, 1, 2, 3, 4];

export default function VendorBusinessDetailsScreen() {
  const router = useRouter();
  const { myVendor, fetchMyVendor, uploadBusinessImage, updateBusinessProfile } = useVendorStore();

  const [loadingSlot, setLoadingSlot] = useState<number | null>(null);
  const [showMenuEditor, setShowMenuEditor] = useState(false);
  const [menuInput, setMenuInput] = useState('');
  const [menuItems, setMenuItems] = useState<string[]>([]);
  const [savingMenu, setSavingMenu] = useState(false);
  const [offersHomeDelivery, setOffersHomeDelivery] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionExtractedItems, setVisionExtractedItems] = useState<string[]>([]);

  useEffect(() => {
    fetchMyVendor().catch((error) => {
      console.warn('Failed to refresh vendor before business details', error);
    });
  }, [fetchMyVendor]);

  useEffect(() => {
    if (!myVendor) {
      return;
    }
    setMenuItems(myVendor.menu_items || []);
    setOffersHomeDelivery(Boolean(myVendor.offers_home_delivery));
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
    if (!validateAccess() || !myVendor) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library access is required to upload business images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    const fileName = (asset as any).fileName || `business-${slot + 1}.jpg`;
    const mimeType = asset.mimeType || 'image/jpeg';

    try {
      setLoadingSlot(slot);
      await uploadBusinessImage(myVendor.id, slot, {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      });
      await fetchMyVendor();
    } catch (error: any) {
      Alert.alert('Upload failed', error?.response?.data?.detail || 'Could not upload image.');
    } finally {
      setLoadingSlot(null);
    }
  };

  const addMenuItem = () => {
    const value = menuInput.trim();
    if (!value) {
      return;
    }
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

  const saveMenuAndDelivery = async () => {
    if (!validateAccess() || !myVendor) {
      return;
    }

    try {
      setSavingMenu(true);
      await updateBusinessProfile(myVendor.id, {
        menu_items: menuItems,
        offers_home_delivery: offersHomeDelivery,
      });
      Alert.alert('Saved', 'Business details updated successfully.');
    } catch (error: any) {
      Alert.alert('Save failed', error?.response?.data?.detail || 'Could not save business details.');
    } finally {
      setSavingMenu(false);
    }
  };

  const handleOcrUpload = async () => {
    if (!validateAccess() || !myVendor) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library access is required to upload menu images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

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
      console.warn('Menu OCR failed', error);
      Alert.alert('Upload failed', 'Could not process menu image.');
    } finally {
      setVisionLoading(false);
    }
  };

  if (!myVendor) {
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
        <Text style={styles.sectionTitle}>Upload 5 business images</Text>
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

        <TouchableOpacity style={styles.ocrUploadButton} onPress={handleOcrUpload}>
          {visionLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.ocrUploadButtonText}>Upload Menu Image (OCR)</Text>
            </>
          )}
        </TouchableOpacity>

        {visionExtractedItems.length > 0 && (
          <View style={styles.detectedItemsCard}>
            <Text style={styles.detectedItemsTitle}>Detected menu items from image:</Text>
            {visionExtractedItems.map((item, idx) => (
              <View key={`${item}-${idx}`} style={styles.detectedItemRow}>
                <Text style={styles.detectedItemText}>• {item}</Text>
                <TouchableOpacity onPress={() => {
                  const newItems = [...menuItems, item];
                  setMenuItems(newItems);
                  setVisionExtractedItems(visionExtractedItems.filter((_, i) => i !== idx));
                }}>
                  <Ionicons name="add-circle" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.clearOcrButton} onPress={() => setVisionExtractedItems([])}>
              <Text style={styles.clearOcrButtonText}>Clear detected items</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.menuToggleButton} onPress={() => setShowMenuEditor((prev) => !prev)}>
          <Text style={styles.menuToggleText}>{showMenuEditor ? 'Hide menu list' : 'Add menu items you offer'}</Text>
          <Ionicons name={showMenuEditor ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.primary} />
        </TouchableOpacity>

        {showMenuEditor && (
          <View style={styles.menuEditorCard}>
            <View style={styles.menuInputRow}>
              <TextInput
                style={styles.menuInput}
                placeholder="e.g. Paneer Thali - ₹250"
                placeholderTextColor={COLORS.textLight}
                value={menuInput}
                onChangeText={setMenuInput}
              />
              <TouchableOpacity style={styles.addItemButton} onPress={addMenuItem}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.menuList}>
              {menuItems.length === 0 ? (
                <Text style={styles.emptyText}>No menu items added yet.</Text>
              ) : (
                menuItems.map((item, index) => (
                  <View key={`${item}-${index}`} style={styles.menuItemRow}>
                    <Text style={styles.menuItemText}>{item}</Text>
                    <TouchableOpacity onPress={() => removeMenuItem(index)}>
                      <Ionicons name="close-circle" size={20} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Do you offer home delivery?</Text>
        <View style={styles.deliveryToggleRow}>
          <TouchableOpacity
            style={[styles.toggleOption, offersHomeDelivery && styles.toggleOptionActive]}
            onPress={() => setOffersHomeDelivery(true)}
          >
            <Text style={[styles.toggleText, offersHomeDelivery && styles.toggleTextActive]}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOption, !offersHomeDelivery && styles.toggleOptionActive]}
            onPress={() => setOffersHomeDelivery(false)}
          >
            <Text style={[styles.toggleText, !offersHomeDelivery && styles.toggleTextActive]}>No</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={saveMenuAndDelivery} disabled={savingMenu}>
          {savingMenu ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save business details</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  imageBox: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  menuToggleButton: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  menuToggleText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  menuEditorCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  menuInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
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
  addItemButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuList: {
    gap: SPACING.xs,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingVertical: SPACING.xs,
  },
  menuItemText: {
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  deliveryToggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  toggleOption: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  toggleOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}12`,
  },
  toggleText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.primary,
  },
  ocrUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    marginTop: SPACING.sm,
  },
  ocrUploadButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  detectedItemsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  detectedItemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  detectedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  detectedItemText: {
    color: COLORS.text,
    flex: 1,
    fontSize: 13,
  },
  clearOcrButton: {
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  clearOcrButtonText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
