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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface RequestFormModalProps {
  visible: boolean;
  onClose: () => void;
  requestType: 'Help' | 'Blood' | 'Medical' | 'Financial' | 'Petition';
  onSubmit: (data: any) => Promise<void>;
}

const VISIBILITY_OPTIONS = [
  { key: 'area', label: 'My Area Community', icon: 'home' },
  { key: 'city', label: 'My City Community', icon: 'location' },
  { key: 'state', label: 'My State Community', icon: 'map' },
  { key: 'national', label: 'National Community', icon: 'flag' },
];

const URGENCY_OPTIONS = [
  { key: 'normal', label: 'Low', color: COLORS.success },
  { key: 'urgent', label: 'Medium', color: COLORS.warning },
  { key: 'critical', label: 'High', color: COLORS.error },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const RequestFormModal: React.FC<RequestFormModalProps> = ({
  visible,
  onClose,
  requestType,
  onSubmit,
}) => {
  const [loading, setLoading] = useState(false);
  const [visibility, setVisibility] = useState('area');
  const [urgency, setUrgency] = useState('normal');
  
  // Common fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  
  // Blood specific
  const [bloodGroup, setBloodGroup] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [location, setLocation] = useState('');
  
  // Financial specific
  const [amount, setAmount] = useState('');
  
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setContactNumber('');
    setBloodGroup('');
    setHospitalName('');
    setLocation('');
    setAmount('');
    setVisibility('area');
    setUrgency('normal');
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const data = {
        type: requestType.toLowerCase(),
        visibility,
        urgency,
        title,
        description,
        contact_number: contactNumber,
        ...(requestType === 'Blood' && { blood_group: bloodGroup, hospital_name: hospitalName, location }),
        ...(requestType === 'Financial' && { amount: parseFloat(amount) || 0 }),
      };
      await onSubmit(data);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error submitting request:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (requestType) {
      case 'Blood': return 'Blood Request';
      case 'Medical': return 'Medical Help Request';
      case 'Financial': return 'Financial Help Request';
      case 'Petition': return 'Create Petition';
      default: return 'Help Request';
    }
  };

  const getIcon = () => {
    switch (requestType) {
      case 'Blood': return 'water';
      case 'Medical': return 'medkit';
      case 'Financial': return 'cash';
      case 'Petition': return 'document-text';
      default: return 'hand-left';
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
              <View style={[styles.iconBg, { backgroundColor: `${COLORS.error}15` }]}>
                <Ionicons name={getIcon()} size={20} color={COLORS.error} />
              </View>
              <Text style={styles.headerTitle}>{getTitle()}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Visibility Selector */}
            <Text style={styles.label}>Post Request Visibility</Text>
            <View style={styles.visibilityContainer}>
              {VISIBILITY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.visibilityOption,
                    visibility === option.key && styles.visibilityOptionSelected,
                  ]}
                  onPress={() => setVisibility(option.key)}
                >
                  <View style={styles.radioOuter}>
                    {visibility === option.key && <View style={styles.radioInner} />}
                  </View>
                  <Ionicons 
                    name={option.icon as any} 
                    size={18} 
                    color={visibility === option.key ? COLORS.primary : COLORS.textSecondary} 
                  />
                  <Text style={[
                    styles.visibilityText,
                    visibility === option.key && styles.visibilityTextSelected,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Blood Group Selector (for Blood requests) */}
            {requestType === 'Blood' && (
              <>
                <Text style={styles.label}>Blood Group *</Text>
                <View style={styles.bloodGroupContainer}>
                  {BLOOD_GROUPS.map((bg) => (
                    <TouchableOpacity
                      key={bg}
                      style={[
                        styles.bloodGroupBtn,
                        bloodGroup === bg && styles.bloodGroupBtnSelected,
                      ]}
                      onPress={() => setBloodGroup(bg)}
                    >
                      <Text style={[
                        styles.bloodGroupText,
                        bloodGroup === bg && styles.bloodGroupTextSelected,
                      ]}>
                        {bg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Hospital Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter hospital name"
                  placeholderTextColor={COLORS.textLight}
                  value={hospitalName}
                  onChangeText={setHospitalName}
                />

                <Text style={styles.label}>Location *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter address/location"
                  placeholderTextColor={COLORS.textLight}
                  value={location}
                  onChangeText={setLocation}
                />
              </>
            )}

            {/* Urgency Level */}
            <Text style={styles.label}>Urgency Level</Text>
            <View style={styles.urgencyContainer}>
              {URGENCY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.urgencyBtn,
                    urgency === option.key && { backgroundColor: `${option.color}15`, borderColor: option.color },
                  ]}
                  onPress={() => setUrgency(option.key)}
                >
                  <View style={[
                    styles.urgencyDot,
                    { backgroundColor: option.color },
                  ]} />
                  <Text style={[
                    styles.urgencyText,
                    urgency === option.key && { color: option.color, fontWeight: '600' },
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount (for Financial requests) */}
            {requestType === 'Financial' && (
              <>
                <Text style={styles.label}>Amount Required (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter amount"
                  placeholderTextColor={COLORS.textLight}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
              </>
            )}

            {/* Title (for Petition and Help) */}
            {(requestType === 'Petition' || requestType === 'Help') && (
              <>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter title"
                  placeholderTextColor={COLORS.textLight}
                  value={title}
                  onChangeText={setTitle}
                />
              </>
            )}

            {/* Description */}
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your request in detail..."
              placeholderTextColor={COLORS.textLight}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
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

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Post Request</Text>
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
    height: 100,
    paddingTop: SPACING.md,
  },
  visibilityContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  visibilityOptionSelected: {
    backgroundColor: `${COLORS.primary}10`,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  visibilityText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  visibilityTextSelected: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  bloodGroupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  bloodGroupBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  bloodGroupBtnSelected: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  bloodGroupText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  bloodGroupTextSelected: {
    color: '#FFFFFF',
  },
  urgencyContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  urgencyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  urgencyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
