import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  ScrollView,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

export const FloatingUtilityButton = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [sosActive, setSosActive] = useState(false); // Would come from real-time SOS detection

  const handleSOS = () => {
    // SOS functionality would be implemented here
    alert('SOS Alert sent to nearby community members!');
  };

  return (
    <>
      {/* Floating Button */}
      <TouchableOpacity
        style={[
          styles.floatingButton,
          sosActive && styles.floatingButtonSOS
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.9}
      >
        <View style={styles.buttonInner}>
          {sosActive ? (
            <Ionicons name="alert" size={24} color="#FFFFFF" />
          ) : (
            <View style={styles.normalIndicator} />
          )}
        </View>
      </TouchableOpacity>

      {/* Bottom Panel Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            {/* Handle */}
            <View style={styles.modalHandle} />
            
            {/* Title */}
            <Text style={styles.modalTitle}>Sanatan Utilities</Text>

            {/* Utility Items */}
            <View style={styles.utilitiesGrid}>
              <TouchableOpacity style={styles.utilityItem}>
                <View style={[styles.utilityIcon, { backgroundColor: '#FFE5CC' }]}>
                  <Ionicons name="calendar" size={24} color={COLORS.primary} />
                </View>
                <Text style={styles.utilityText}>Today's Panchang</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.utilityItem}>
                <View style={[styles.utilityIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="book" size={24} color={COLORS.success} />
                </View>
                <Text style={styles.utilityText}>Bhagavad Gita Slok</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.utilityItem}>
                <View style={[styles.utilityIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="star" size={24} color={COLORS.info} />
                </View>
                <Text style={styles.utilityText}>Daily Horoscope</Text>
              </TouchableOpacity>
            </View>

            {/* SOS Section */}
            <View style={styles.sosSection}>
              <View style={styles.sosHeader}>
                <Ionicons name="alert-circle" size={24} color={COLORS.error} />
                <Text style={styles.sosTitle}>Emergency SOS</Text>
              </View>
              
              <Text style={styles.sosDescription}>
                Use this if you need urgent help. This powerful feature instantly alerts nearby community members who can assist you.
              </Text>

              <TouchableOpacity 
                style={styles.sosButton}
                onPress={handleSOS}
              >
                <Ionicons name="alert" size={20} color="#FFFFFF" />
                <Text style={styles.sosButtonText}>SEND SOS</Text>
              </TouchableOpacity>

              <Text style={styles.sosNote}>
                Your location will be shared to help people reach you faster.
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonSOS: {
    backgroundColor: COLORS.error,
  },
  buttonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  normalIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E53935',
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
    paddingBottom: SPACING.xl * 2,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.divider,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  utilitiesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  utilityItem: {
    alignItems: 'center',
    flex: 1,
  },
  utilityIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  utilityText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  sosSection: {
    backgroundColor: '#FFF5F5',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  sosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sosTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.error,
    marginLeft: SPACING.sm,
  },
  sosDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  sosButton: {
    backgroundColor: COLORS.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: SPACING.sm,
  },
  sosNote: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});
