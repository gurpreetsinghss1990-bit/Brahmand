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
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useHelpRequestStore, HelpRequest } from '../store/helpRequestStore';
import { useAuthStore } from '../store/authStore';

interface HelpRequestFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: HelpRequest) => Promise<void>;
  defaultType?: 'blood' | 'medical' | 'financial' | 'other';
}

const HELP_TYPES = [
  { key: 'blood', label: 'Blood', icon: 'water', color: '#E53935' },
  { key: 'medical', label: 'Medical', icon: 'medkit', color: '#1976D2' },
  { key: 'financial', label: 'Financial', icon: 'cash', color: '#43A047' },
  { key: 'other', label: 'Other', icon: 'hand-left', color: COLORS.primary },
];

const URGENCY_LEVELS = [
  { key: 'low', label: 'Low', color: COLORS.success },
  { key: 'medium', label: 'Medium', color: COLORS.warning },
  { key: 'urgent', label: 'Urgent', color: COLORS.error },
];

const VISIBILITY_OPTIONS = [
  { key: 'area', label: 'My Area Community', icon: 'home' },
  { key: 'city', label: 'My City Community', icon: 'location' },
  { key: 'state', label: 'My State Community', icon: 'map' },
  { key: 'national', label: 'National Community', icon: 'flag' },
];

export const HelpRequestForm: React.FC<HelpRequestFormProps> = ({
  visible,
  onClose,
  onSubmit,
  defaultType = 'other',
}) => {
  const { user } = useAuthStore();
  const { activeRequest, hasActiveRequest, setActiveRequest } = useHelpRequestStore();
  
  const [loading, setLoading] = useState(false);
  const [helpType, setHelpType] = useState<'blood' | 'medical' | 'financial' | 'other'>(defaultType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'urgent'>('medium');
  const [contactNumber, setContactNumber] = useState(user?.phone || '');
  const [visibility, setVisibility] = useState<'area' | 'city' | 'state' | 'national'>('area');

  const resetForm = () => {
    setHelpType(defaultType);
    setTitle('');
    setDescription('');
    setUrgency('medium');
    setContactNumber(user?.phone || '');
    setVisibility('area');
  };

  const handleSubmit = async () => {
    // Check for active request
    if (hasActiveRequest()) {
      Alert.alert(
        'Active Request Exists',
        'You already have an active help request. Please resolve it before creating another.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!title.trim() || !description.trim() || !contactNumber.trim()) {
      Alert.alert('Missing Information', 'Please fill all required fields.');
      return;
    }

    setLoading(true);
    try {
      const newRequest: HelpRequest = {
        id: Date.now().toString(),
        type: helpType,
        title: title.trim(),
        description: description.trim(),
        urgency,
        contactNumber: contactNumber.trim(),
        visibility,
        createdAt: new Date().toISOString(),
        status: 'active',
        verifications: 0,
        verifiedBy: [],
      };

      await setActiveRequest(newRequest);
      await onSubmit(newRequest);
      resetForm();
      onClose();
      Alert.alert('Success', 'Your help request has been posted to the community.');
    } catch (error) {
      console.error('Error creating help request:', error);
      Alert.alert('Error', 'Failed to create help request. Please try again.');
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
            <Text style={styles.headerTitle}>Create Help Request</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Help Type */}
            <Text style={styles.label}>Help Type *</Text>
            <View style={styles.typeContainer}>
              {HELP_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeBtn,
                    helpType === type.key && { backgroundColor: `${type.color}20`, borderColor: type.color },
                  ]}
                  onPress={() => setHelpType(type.key as any)}
                >
                  <Ionicons name={type.icon as any} size={20} color={helpType === type.key ? type.color : COLORS.textSecondary} />
                  <Text style={[styles.typeText, helpType === type.key && { color: type.color }]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Title */}
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Short description of your need"
              placeholderTextColor={COLORS.textLight}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            {/* Description */}
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Provide more details about your situation..."
              placeholderTextColor={COLORS.textLight}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Urgency */}
            <Text style={styles.label}>Urgency *</Text>
            <View style={styles.urgencyContainer}>
              {URGENCY_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.key}
                  style={[
                    styles.urgencyBtn,
                    urgency === level.key && { backgroundColor: level.color, borderColor: level.color },
                  ]}
                  onPress={() => setUrgency(level.key as any)}
                >
                  <Text style={[styles.urgencyText, urgency === level.key && { color: '#FFFFFF' }]}>
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Contact Number */}
            <Text style={styles.label}>Contact Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Your contact number"
              placeholderTextColor={COLORS.textLight}
              value={contactNumber}
              onChangeText={setContactNumber}
              keyboardType="phone-pad"
            />

            {/* Visibility */}
            <Text style={styles.label}>Post Visibility *</Text>
            <View style={styles.visibilityContainer}>
              {VISIBILITY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.visibilityOption,
                    visibility === option.key && styles.visibilityOptionSelected,
                  ]}
                  onPress={() => setVisibility(option.key as any)}
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

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Post Help Request</Text>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
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
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.divider,
    gap: 6,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  urgencyContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  urgencyBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.divider,
    alignItems: 'center',
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
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
