import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { useVendorStore, VENDOR_CATEGORIES } from '../../src/store/vendorStore';

export default function VendorDashboardScreen() {
  const router = useRouter();
  const { myVendor, updateMyVendor } = useVendorStore();
  const [editing, setEditing] = useState(false);

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

  const menuItems = [
    { icon: 'create', label: 'Edit Business Details', action: () => Alert.alert('Edit', 'Edit business details coming soon!') },
    { icon: 'images', label: 'Upload Photos', action: () => Alert.alert('Photos', 'Photo upload coming soon!') },
    { icon: 'location', label: 'Update Address', action: () => Alert.alert('Address', 'Address update coming soon!') },
    { icon: 'pricetags', label: 'Update Categories', action: () => Alert.alert('Categories', 'Category update coming soon!') },
    { icon: 'call', label: 'Manage Contact Number', action: () => Alert.alert('Contact', 'Contact update coming soon!') },
    { icon: 'megaphone', label: 'Promotion Options', action: () => Alert.alert('Promotions', 'Promotions coming soon!') },
    { icon: 'card', label: 'Subscription Plans', action: () => Alert.alert('Subscription', 'Subscription plans coming soon!') },
    { icon: 'analytics', label: 'Business Analytics', action: () => Alert.alert('Analytics', 'Analytics coming soon!') },
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
          <Text style={styles.businessName}>{myVendor.businessName}</Text>
          <Text style={styles.businessOwner}>{myVendor.ownerName}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{myVendor.yearsInBusiness || 0}</Text>
              <Text style={styles.statLabel}>Years</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{myVendor.categories.length}</Text>
              <Text style={styles.statLabel}>Categories</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
          </View>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Categories</Text>
          <View style={styles.categoriesContainer}>
            {myVendor.categories.map((cat, index) => (
              <View key={index} style={styles.categoryChip}>
                <Text style={styles.categoryText}>{cat}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manage Your Business</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItem}
              onPress={item.action}
            >
              <View style={styles.menuIconBg}>
                <Ionicons name={item.icon as any} size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
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
    paddingHorizontal: SPACING.lg,
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
    borderRadius: 18,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  businessName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  businessOwner: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.divider,
  },
  section: {
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    marginTop: 0,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  menuIconBg: {
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
});
