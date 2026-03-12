import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface VendorRegistrationModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

const CATEGORIES = ['Pooja', 'Grocery', 'Restaurant', 'Festival', 'Other'];

export const VendorRegistrationModal: React.FC<VendorRegistrationModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);

  const resetForm = () => {
    setBusinessName('');
    setOwnerName('');
    setCategory('');
    setAddress('');
    setContactNumber('');
    setDeliveryAvailable(false);
    setPhotos([]);
  };

  const pickImage = async () => {
    if (photos.length >= 3) {
      alert('Maximum 3 photos allowed');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera roll permission needed');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhotos([...photos, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!businessName.trim() || !ownerName.trim() || !category || !contactNumber.trim()) {
      alert('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        business_name: businessName.trim(),
        owner_name: ownerName.trim(),
        category,
        address: address.trim(),
        contact_number: contactNumber.trim(),
        delivery_available: deliveryAvailable,
        photos,
      });
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error registering vendor:', error);
      alert('Failed to register vendor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBg}>
                <Ionicons name="storefront" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.headerTitle}>Register Vendor</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Business Name */}
            <Text style={styles.label}>Business Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter business name"
              placeholderTextColor={COLORS.textLight}
              value={businessName}
              onChangeText={setBusinessName}
            />

            {/* Owner Name */}
            <Text style={styles.label}>Owner Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter owner name"
              placeholderTextColor={COLORS.textLight}
              value={ownerName}
              onChangeText={setOwnerName}
            />

            {/* Category */}
            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryContainer}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryBtn,
                    category === cat && styles.categoryBtnSelected,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      category === cat && styles.categoryTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Address */}
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter business address"
              placeholderTextColor={COLORS.textLight}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Contact Number */}
            <Text style={styles.label}>Contact Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter contact number"
              placeholderTextColor={COLORS.textLight}
              value={contactNumber}
              onChangeText={setContactNumber}
              keyboardType="phone-pad"
            />

            {/* Delivery Available */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Delivery Available</Text>
              <Switch
                value={deliveryAvailable}
                onValueChange={setDeliveryAvailable}
                trackColor={{ false: COLORS.divider, true: `${COLORS.primary}50` }}
                thumbColor={deliveryAvailable ? COLORS.primary : '#f4f3f4'}
              />
            </View>

            {/* Business Photos */}
            <Text style={styles.label}>Business Photos (Max 3)</Text>
            <View style={styles.photosContainer}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoWrapper}>
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="image" size={24} color={COLORS.primary} />
                  </View>
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={20} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 3 && (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                  <Ionicons name="add" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Register Vendor</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  form: {
    padding: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  textArea: {
    height: 80,
    paddingTop: SPACING.md,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  categoryBtnSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    fontSize: 14,
    color: COLORS.text,
  },
  categoryTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  switchLabel: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  photoWrapper: {
    position: 'relative',
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
