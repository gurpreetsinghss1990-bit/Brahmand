import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mock data for Sanatan Utilities
const MOCK_GITA_SLOK = {
  chapter: 2,
  verse: 47,
  sanskrit: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥",
  translation: "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions. Never consider yourself the cause of the results, and never be attached to inaction."
};

const MOCK_PANCHANG = {
  tithi: "Shukla Dashami",
  nakshatra: "Uttara Phalguni",
  yoga: "Shobhana",
  karana: "Balava",
  sunrise: "6:32 AM",
  sunset: "6:18 PM"
};

const MOCK_HOROSCOPE = {
  sign: "Aries",
  prediction: "Today is favorable for new beginnings. Focus on your goals and take decisive action."
};

export const FloatingUtilityButton = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [sosActive, setSosActive] = useState(false); // Would come from real-time SOS detection

  const handleSOS = () => {
    // SOS functionality would be implemented here
    alert('SOS Alert sent to nearby community members!');
  };

  return (
    <>
      {/* Floating Button - Apple Assistive Touch Style */}
      <TouchableOpacity
        style={[
          styles.floatingButton,
          sosActive && styles.floatingButtonSOS
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.9}
      >
        <View style={[styles.buttonInner, sosActive && styles.buttonInnerSOS]}>
          {sosActive ? (
            <Ionicons name="alert" size={20} color="#FFFFFF" />
          ) : (
            <View style={styles.normalIndicator} />
          )}
        </View>
      </TouchableOpacity>

      {/* Bottom Panel Modal - Max 50% height */}
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

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 1. Large Card - Bhagavad Gita Slok */}
              <View style={styles.gitaCard}>
                <View style={styles.gitaHeader}>
                  <View style={styles.gitaIconBg}>
                    <Ionicons name="book" size={24} color={COLORS.success} />
                  </View>
                  <View>
                    <Text style={styles.gitaTitle}>Bhagavad Gita Slok</Text>
                    <Text style={styles.gitaSubtitle}>Chapter {MOCK_GITA_SLOK.chapter}, Verse {MOCK_GITA_SLOK.verse}</Text>
                  </View>
                </View>
                <Text style={styles.gitaSanskrit}>{MOCK_GITA_SLOK.sanskrit}</Text>
                <Text style={styles.gitaTranslation}>{MOCK_GITA_SLOK.translation}</Text>
              </View>

              {/* 2. Two Medium Cards - Panchang & Horoscope */}
              <View style={styles.twoCardRow}>
                {/* Panchang Card */}
                <TouchableOpacity style={styles.mediumCard}>
                  <View style={[styles.mediumIconBg, { backgroundColor: '#FFE5CC' }]}>
                    <Ionicons name="calendar" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.mediumTitle}>Today's Panchang</Text>
                  <Text style={styles.mediumSubtext}>{MOCK_PANCHANG.tithi}</Text>
                  <Text style={styles.mediumDetail}>{MOCK_PANCHANG.nakshatra}</Text>
                </TouchableOpacity>

                {/* Horoscope Card */}
                <TouchableOpacity style={styles.mediumCard}>
                  <View style={[styles.mediumIconBg, { backgroundColor: '#E3F2FD' }]}>
                    <Ionicons name="star" size={20} color={COLORS.info} />
                  </View>
                  <Text style={styles.mediumTitle}>Daily Horoscope</Text>
                  <Text style={styles.mediumSubtext}>{MOCK_HOROSCOPE.sign}</Text>
                  <Text style={styles.mediumDetail} numberOfLines={2}>{MOCK_HOROSCOPE.prediction}</Text>
                </TouchableOpacity>
              </View>

              {/* 3. Large SOS Card */}
              <View style={styles.sosCard}>
                <View style={styles.sosHeader}>
                  <View style={styles.sosIconBg}>
                    <Ionicons name="alert-circle" size={28} color={COLORS.error} />
                  </View>
                  <Text style={styles.sosTitle}>Emergency SOS</Text>
                </View>
                
                <Text style={styles.sosDescription}>
                  Use this if you need urgent help. This powerful feature instantly alerts nearby community members who can assist you.
                </Text>

                <TouchableOpacity 
                  style={styles.sosButton}
                  onPress={handleSOS}
                  activeOpacity={0.8}
                >
                  <Ionicons name="alert" size={20} color="#FFFFFF" />
                  <Text style={styles.sosButtonText}>SEND SOS</Text>
                </TouchableOpacity>

                <Text style={styles.sosNote}>
                  Your location will be shared to help people reach you faster.
                </Text>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Floating Button - Apple Assistive Touch Style
  floatingButton: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(240, 240, 240, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingButtonSOS: {
    backgroundColor: COLORS.error,
  },
  buttonInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonInnerSOS: {
    backgroundColor: COLORS.error,
  },
  normalIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E53935',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
    maxHeight: SCREEN_HEIGHT * 0.5, // Max 50% of screen
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.divider,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },

  // Gita Card (Large)
  gitaCard: {
    backgroundColor: '#F1F8E9',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  gitaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  gitaIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  gitaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  gitaSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  gitaSanskrit: {
    fontSize: 14,
    color: '#2E7D32',
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  gitaTranslation: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },

  // Two Card Row
  twoCardRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  mediumCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  mediumIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  mediumTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  mediumSubtext: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  mediumDetail: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },

  // SOS Card (Large)
  sosCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  sosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sosIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  sosTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.error,
  },
  sosDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  sosButton: {
    backgroundColor: COLORS.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: SPACING.sm,
    letterSpacing: 1,
  },
  sosNote: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});
