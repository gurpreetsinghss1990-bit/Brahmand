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
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { useVendorStore, DEFAULT_CATEGORIES } from '../../src/store/vendorStore';
import { useAuthStore } from '../../src/store/authStore';
import { VendorKYCModal } from '../../src/components/VendorKYCModal';

export default function VendorDashboardScreen() {
  const router = useRouter();
  const { myVendor, fetchMyVendor, updateVendor, updateBusinessProfile } = useVendorStore();
  const { logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [kycVisible, setKycVisible] = useState(false);
  
  // Edit modals
  const [editModal, setEditModal] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');

  useEffect(() => {
    // Refresh myVendor on mount and when this component re-renders.
    fetchMyVendor().catch((e) => console.warn('fetchMyVendor failed', e));
  }, [fetchMyVendor]);

  useEffect(() => {
    const onBackPress = () => {
      router.replace('/(tabs)/vendor');
      return true; // prevent default behavior
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => {
      subscription.remove();
    };
  }, [router]);

  const performLogout = async () => {
    await logout();
    router.replace('/');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      performLogout();
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => {
        performLogout();
      } },
    ]);
  };

  if (!myVendor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/vendor')}>
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
            onPress={() => router.replace('/(tabs)/vendor')}
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

  const handleEditDescription = () => {
    setEditValue(myVendor.business_description || '');
    setEditModal('business_description');
  };

  const handleEditCategories = () => {
    setEditCategories([...myVendor.categories]);
    setEditModal('categories');
  };

  const formatKycStatus = (status?: string) => {
    switch (status) {
      case 'verified':
        return 'Approved';
      case 'manual_review':
        return 'Admin Review';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending';
    }
  };

  const getKycChipColor = (status?: string) => {
    switch (status) {
      case 'verified':
        return '#DFF7E3';
      case 'manual_review':
        return '#FFF5D6';
      case 'rejected':
        return '#FAD6D6';
      default:
        return '#EDF4FF';
    }
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
        case 'business_description':
          updateData.business_description = editValue;
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

  const isVerified = myVendor?.kyc_status === 'verified';
  const isManualReview = myVendor?.kyc_status === 'manual_review';
  const isReviewOrVerified = isManualReview || isVerified;
  const isVendorApproved = isVerified;

  const handleTellBusiness = () => {
    router.push('/vendor/business-details');
  };

  const handleOpenKyc = () => {
    if (isReviewOrVerified) {
      router.push('/kyc');
      return;
    }
    setKycVisible(true);
  };

  type MenuItem = {
    icon: string;
    label: string;
    action: () => void | Promise<void>;
    emphasis?: boolean;
  };

  const menuItems: MenuItem[] = isReviewOrVerified
    ? [
        ...(isVerified
          ? [{ icon: 'create', label: 'Tell about your business', action: handleTellBusiness }]
          : []),
        { icon: '', label: 'KYC & Verification', action: handleOpenKyc, emphasis: true }
      ]
    : [
        { icon: 'create', label: 'Edit Business Name', action: handleEditBusinessName },
        { icon: 'document-text', label: 'Edit Business Description', action: handleEditDescription },
        { icon: 'location', label: 'Update Address', action: handleEditAddress },
        { icon: 'pricetags', label: 'Update Categories', action: handleEditCategories },
        { icon: 'call', label: 'Manage Contact Number', action: handleEditPhone },
        { icon: 'id-card', label: 'Complete KYC & Verification', action: handleOpenKyc },
      ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/vendor')}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendor Dashboard</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButtonHeader}>
          <Ionicons name="log-out" size={22} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Business Card */}
        <View style={styles.businessCard}>
          <View style={styles.businessIconContainer}>
            <Ionicons name="storefront" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.businessName}>{myVendor.business_name}</Text>
          <Text style={styles.businessOwner}>{myVendor.owner_name}</Text>
          {myVendor.business_description ? (
            <Text style={styles.businessDescription}>{myVendor.business_description}</Text>
          ) : null}

          {/* KYC Status Badge */}
          <View style={[styles.kycChip, { backgroundColor: getKycChipColor(myVendor.kyc_status) }]}> 
            <Text style={styles.kycChipText}>{formatKycStatus(myVendor.kyc_status)}</Text>
          </View>
          {myVendor.kyc_status === 'manual_review' && (
            <Text style={styles.kycReviewText}>Your application is under review.</Text>
          )}

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
              style={[
                styles.menuItem,
                item.emphasis && styles.menuItemEmphasis
              ]}
              onPress={item.action}
            >
              {item.emphasis ? (
                <Text style={styles.menuLabelEmphasis}>{item.label}  →</Text>
              ) : (
                <>
                  <View style={styles.menuIcon}>
                    <Ionicons name={item.icon as any} size={22} color={COLORS.primary} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
                </>
              )}
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editModal === 'business_name' && 'Edit Business Name'}
                {editModal === 'business_description' && 'Edit Business Description'}
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
                  {editModal === 'business_description' && 'Business Description'}
                  {editModal === 'address' && 'Full Address'}
                  {editModal === 'phone' && 'Phone Number'}
                </Text>
                <TextInput
                  style={[styles.input, (editModal === 'address' || editModal === 'business_description') && styles.textArea]}
                  value={editValue}
                  onChangeText={setEditValue}
                  multiline={editModal === 'address' || editModal === 'business_description'}
                  numberOfLines={editModal === 'address' || editModal === 'business_description' ? 3 : 1}
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
      </KeyboardAvoidingView>
      </Modal>

      <VendorKYCModal 
        visible={kycVisible}
        onClose={() => setKycVisible(false)}
        vendorId={myVendor.id}
        onKycUpdated={fetchMyVendor}
      />
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
    margin: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    minHeight: 160,
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
  businessDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  kycChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: SPACING.sm,
  },
  kycChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  kycReviewText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
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
  section: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
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
  menuLabelEmphasis: {
    flex: 1,
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  menuItemEmphasis: {
    borderWidth: 0,
    margin: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  menuIconButton: {
    padding: SPACING.xs,
  },
  menuBox: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  menuBoxText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  menuUploadButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
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
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  detectedItemText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  saveButton: {
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  logoutButtonHeader: {
    width: 24,
    alignItems: 'flex-end',
  },
  reviewNotice: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
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
