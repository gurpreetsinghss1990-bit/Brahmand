import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert,
  Modal,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { useVendorStore, DEFAULT_CATEGORIES } from '../../src/store/vendorStore';
import { updateVendor } from '../../src/services/api';

export default function VendorDashboardScreen() {
  const router = useRouter();
  const { myVendor, fetchMyVendor } = useVendorStore();
  const [loading, setLoading] = useState(false);
  
  // Edit modals
  const [editModal, setEditModal] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');

  useEffect(() => {
    fetchMyVendor();
  }, []);

  if (!myVendor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vendor Dashboard</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="storefront-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.errorText}>No business registered</Text>
          <TouchableOpacity 
            style={styles.registerBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.registerBtnText}>Register Your Business</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleEditBusinessName = () => {
    setEditValue(myVendor.business_name);
    setEditModal('business_name');
  };

  const handleEditAddress = () => {
    setEditValue(myVendor.full_address);
    setEditModal('address');
  };

  const handleEditPhone = () => {
    setEditValue(myVendor.phone_number);
    setEditModal('phone');
  };

  const handleEditCategories = () => {
    setEditCategories([...myVendor.categories]);
    setEditModal('categories');
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      let updateData: any = {};
      
      switch (editModal) {
        case 'business_name':
          updateData.business_name = editValue;
          break;
        case 'address':
          updateData.full_address = editValue;
          break;
        case 'phone':
          updateData.phone_number = editValue;
          break;
        case 'categories':
          if (editCategories.length === 0) {
            Alert.alert('Error', 'Please select at least one category');
            return;
          }
          if (editCategories.length > 5) {
            Alert.alert('Error', 'Maximum 5 categories allowed');
            return;
          }
          updateData.categories = editCategories;
          break;
      }
      
      await updateVendor(myVendor.id, updateData);
      await fetchMyVendor();
      setEditModal(null);
      Alert.alert('Success', 'Business details updated!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const addCategory = (cat: string) => {
    if (editCategories.length >= 5) {
      Alert.alert('Limit', 'Maximum 5 categories allowed');
      return;
    }
    if (!editCategories.includes(cat)) {
      setEditCategories([...editCategories, cat]);
    }
    setCategorySearch('');
  };

  const removeCategory = (cat: string) => {
    setEditCategories(editCategories.filter(c => c !== cat));
  };

  const filteredCategories = categorySearch
    ? DEFAULT_CATEGORIES.filter(c => 
        c.toLowerCase().includes(categorySearch.toLowerCase()) &&
        !editCategories.includes(c)
      ).slice(0, 5)
    : [];

  const menuItems = [
    { icon: 'create', label: 'Edit Business Name', action: handleEditBusinessName },
    { icon: 'location', label: 'Update Address', action: handleEditAddress },
    { icon: 'pricetags', label: 'Update Categories', action: handleEditCategories },
    { icon: 'call', label: 'Manage Contact Number', action: handleEditPhone },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendor Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Business Card */}
        <View style={styles.businessCard}>
          <View style={styles.businessIconContainer}>
            <Ionicons name="storefront" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.businessName}>{myVendor.business_name}</Text>
          <Text style={styles.businessOwner}>{myVendor.owner_name}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{myVendor.years_in_business || 0}</Text>
              <Text style={styles.statLabel}>Years</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{myVendor.categories?.length || 0}</Text>
              <Text style={styles.statLabel}>Categories</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{myVendor.photos?.length || 0}</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
          </View>

          {/* Categories */}
          <View style={styles.categoriesContainer}>
            {(myVendor.categories || []).map((cat, idx) => (
              <View key={idx} style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{cat}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Manage Business</Text>
        
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.action}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact Info */}
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="call" size={18} color={COLORS.primary} />
            <Text style={styles.infoText}>{myVendor.phone_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={18} color={COLORS.primary} />
            <Text style={styles.infoText}>{myVendor.full_address}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editModal === 'business_name' && 'Edit Business Name'}
                {editModal === 'address' && 'Update Address'}
                {editModal === 'phone' && 'Update Phone'}
                {editModal === 'categories' && 'Update Categories'}
              </Text>
              <TouchableOpacity onPress={() => setEditModal(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {editModal === 'categories' ? (
              <View>
                <Text style={styles.inputLabel}>Selected Categories ({editCategories.length}/5)</Text>
                <View style={styles.selectedCats}>
                  {editCategories.map((cat, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={styles.selectedCatChip}
                      onPress={() => removeCategory(cat)}
                    >
                      <Text style={styles.selectedCatText}>{cat}</Text>
                      <Ionicons name="close" size={14} color={COLORS.error} />
                    </TouchableOpacity>
                  ))}
                </View>
                
                <TextInput
                  style={styles.input}
                  placeholder="Search or add category..."
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                />
                
                {filteredCategories.length > 0 && (
                  <View style={styles.suggestions}>
                    {filteredCategories.map((cat, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.suggestionItem}
                        onPress={() => addCategory(cat)}
                      >
                        <Text style={styles.suggestionText}>{cat}</Text>
                        <Ionicons name="add" size={18} color={COLORS.primary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                
                {categorySearch && !filteredCategories.includes(categorySearch) && (
                  <TouchableOpacity
                    style={styles.addCustomBtn}
                    onPress={() => addCategory(categorySearch)}
                  >
                    <Ionicons name="add-circle" size={18} color={COLORS.primary} />
                    <Text style={styles.addCustomText}>Add "{categorySearch}" as new category</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View>
                <Text style={styles.inputLabel}>
                  {editModal === 'business_name' && 'Business Name'}
                  {editModal === 'address' && 'Full Address'}
                  {editModal === 'phone' && 'Phone Number'}
                </Text>
                <TextInput
                  style={[styles.input, editModal === 'address' && styles.textArea]}
                  value={editValue}
                  onChangeText={setEditValue}
                  multiline={editModal === 'address'}
                  numberOfLines={editModal === 'address' ? 3 : 1}
                  keyboardType={editModal === 'phone' ? 'phone-pad' : 'default'}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
              onPress={handleSaveEdit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  registerBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  registerBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  businessCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  businessIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  businessName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  businessOwner: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  categoryChip: {
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    margin: 2,
  },
  categoryChipText: {
    fontSize: 12,
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  menuContainer: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xl,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  infoText: {
    marginLeft: SPACING.sm,
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectedCats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.md,
  },
  selectedCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    margin: 2,
  },
  selectedCatText: {
    fontSize: 13,
    color: COLORS.primary,
    marginRight: 4,
  },
  suggestions: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  suggestionText: {
    fontSize: 14,
    color: COLORS.text,
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  addCustomText: {
    marginLeft: SPACING.xs,
    color: COLORS.primary,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
