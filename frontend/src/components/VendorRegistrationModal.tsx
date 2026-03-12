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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { VENDOR_CATEGORIES } from '../store/vendorStore';

interface VendorRegistrationModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const VendorRegistrationModal: React.FC<VendorRegistrationModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [locationLink, setLocationLink] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const filteredCategories = VENDOR_CATEGORIES.filter(
    cat => cat.toLowerCase().includes(categorySearch.toLowerCase()) &&
    !selectedCategories.includes(cat)
  );

  const resetForm = () => {
    setBusinessName('');
    setOwnerName('');
    setPhoneNumber('');
    setYearsInBusiness('');
    setSelectedCategories([]);
    setAddress('');
    setLocationLink('');
    setLatitude(null);
    setLongitude(null);
    setCategorySearch('');
  };

  const addCategory = (category: string) => {
    if (selectedCategories.length >= 5) {
      Alert.alert('Limit Reached', 'You can select up to 5 categories.');
      return;
    }
    setSelectedCategories([...selectedCategories, category]);
    setCategorySearch('');
    setShowCategoryDropdown(false);
  };

  const removeCategory = (category: string) => {
    setSelectedCategories(selectedCategories.filter(c => c !== category));
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);
      setLocationLink(`https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`);
      Alert.alert('Success', 'Location captured successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to get location.');
    }
  };

  const handleSubmit = async () => {
    if (!businessName.trim() || !ownerName.trim() || !phoneNumber.trim() || !yearsInBusiness) {
      Alert.alert('Missing Information', 'Please fill all required fields.');
      return;
    }

    if (selectedCategories.length === 0) {
      Alert.alert('Missing Categories', 'Please select at least one business category.');
      return;
    }

    if (!address.trim()) {
      Alert.alert('Missing Address', 'Please enter your business address.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        phoneNumber: phoneNumber.trim(),
        yearsInBusiness: parseInt(yearsInBusiness) || 0,
        categories: selectedCategories,
        address: address.trim(),
        locationLink,
        latitude,
        longitude,
      });
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error registering vendor:', error);
      Alert.alert('Error', 'Failed to register. Please try again.');
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
              <Text style={styles.headerTitle}>Register Your Business</Text>
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

            {/* Phone Number */}
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              placeholderTextColor={COLORS.textLight}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />

            {/* Years in Business */}
            <Text style={styles.label}>Years in Business *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter years (e.g., 5)"
              placeholderTextColor={COLORS.textLight}
              value={yearsInBusiness}
              onChangeText={setYearsInBusiness}
              keyboardType="number-pad"
            />

            {/* Business Categories */}
            <Text style={styles.label}>Business Categories * (Select up to 5)</Text>
            
            {/* Selected Categories */}
            {selectedCategories.length > 0 && (
              <View style={styles.selectedCategories}>
                {selectedCategories.map((cat) => (
                  <View key={cat} style={styles.categoryTag}>
                    <Text style={styles.categoryTagText}>{cat}</Text>
                    <TouchableOpacity onPress={() => removeCategory(cat)}>
                      <Ionicons name="close-circle" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Category Search */}
            <View style={styles.categorySearchContainer}>
              <Ionicons name="search" size={18} color={COLORS.textLight} />
              <TextInput
                style={styles.categorySearchInput}
                placeholder="Search categories (Gym, Yoga, Restaurant...)"
                placeholderTextColor={COLORS.textLight}
                value={categorySearch}
                onChangeText={(text) => {
                  setCategorySearch(text);
                  setShowCategoryDropdown(true);
                }}
                onFocus={() => setShowCategoryDropdown(true)}
              />
            </View>

            {/* Category Dropdown */}
            {showCategoryDropdown && filteredCategories.length > 0 && (
              <View style={styles.categoryDropdown}>
                {filteredCategories.slice(0, 6).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={styles.categoryOption}
                    onPress={() => addCategory(cat)}
                  >
                    <Text style={styles.categoryOptionText}>{cat}</Text>
                    <Ionicons name="add" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Address */}
            <Text style={styles.label}>Full Address *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter complete business address"
              placeholderTextColor={COLORS.textLight}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Location */}
            <Text style={styles.label}>Location Link</Text>
            <View style={styles.locationContainer}>
              <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
                <Ionicons name="locate" size={18} color={COLORS.primary} />
                <Text style={styles.locationButtonText}>Get Current Location</Text>
              </TouchableOpacity>
              {latitude && longitude && (
                <View style={styles.locationInfo}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.locationInfoText}>Location captured</Text>
                </View>
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
                <Text style={styles.submitBtnText}>Register Business</Text>
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
  selectedCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    gap: 4,
  },
  categoryTagText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  categorySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  categorySearchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 15,
    color: COLORS.text,
  },
  categoryDropdown: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginTop: SPACING.xs,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  categoryOptionText: {
    fontSize: 14,
    color: COLORS.text,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: 6,
  },
  locationButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationInfoText: {
    fontSize: 13,
    color: COLORS.success,
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
