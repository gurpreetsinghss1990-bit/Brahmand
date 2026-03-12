import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useHelpRequestStore } from '../store/helpRequestStore';
import { getWisdom, getPanchang } from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const getHelpIcon = (type: string): string => {
  switch (type) {
    case 'blood': return 'water';
    case 'medical': return 'medkit';
    case 'financial': return 'cash';
    case 'food': return 'restaurant';
    default: return 'hand-left';
  }
};

const getHelpColor = (type: string): string => {
  switch (type) {
    case 'blood': return '#E53935';
    case 'medical': return '#1976D2';
    case 'financial': return '#43A047';
    case 'food': return '#FB8C00';
    default: return COLORS.primary;
  }
};

export const FloatingUtilityButton = () => {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { activeRequest, fetchActiveRequest, resolveRequest, hasActiveRequest } = useHelpRequestStore();
  
  // Wisdom and Panchang data
  const [wisdom, setWisdom] = useState<any>(null);
  const [panchang, setPanchang] = useState<any>(null);

  useEffect(() => {
    fetchActiveRequest();
    loadUtilityData();
  }, []);

  const loadUtilityData = async () => {
    try {
      const [wisdomRes, panchangRes] = await Promise.all([
        getWisdom(),
        getPanchang()
      ]);
      setWisdom(wisdomRes.data);
      setPanchang(panchangRes.data);
    } catch (error) {
      console.error('Error loading utility data:', error);
    }
  };

  const handleSOS = () => {
    Alert.alert(
      'Emergency SOS',
      'This will alert nearby community members. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send SOS', style: 'destructive', onPress: () => {
          Alert.alert('SOS Alert', 'SOS Alert sent to nearby community members!');
        }}
      ]
    );
  };

  const handleStopHelp = async () => {
    Alert.alert(
      'Resolve Help Request',
      'Has your help request been fulfilled? This will close the request and notify the community.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          setLoading(true);
          try {
            await resolveRequest();
            setModalVisible(false);
            Alert.alert('Success', 'Your help request has been marked as fulfilled.');
          } catch (error) {
            Alert.alert('Error', 'Failed to resolve request. Please try again.');
          } finally {
            setLoading(false);
          }
        }}
      ]
    );
  };

  const isActiveHelp = hasActiveRequest();

  return (
    <>
      {/* Floating Button - Glass Effect Style */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.9}
      >
        <View style={styles.glassBackground}>
          {isActiveHelp && activeRequest ? (
            <Ionicons 
              name={getHelpIcon(activeRequest.type) as any} 
              size={22} 
              color={getHelpColor(activeRequest.type)} 
            />
          ) : (
            <View style={styles.redDot} />
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
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            
            <Text style={styles.modalTitle}>Sanatan Utilities</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Active Help Request Section */}
              {isActiveHelp && activeRequest && (
                <View style={styles.activeHelpCard}>
                  <View style={styles.activeHelpHeader}>
                    <View style={[styles.helpTypeBadge, { backgroundColor: `${getHelpColor(activeRequest.type)}20` }]}>
                      <Ionicons name={getHelpIcon(activeRequest.type) as any} size={18} color={getHelpColor(activeRequest.type)} />
                    </View>
                    <Text style={styles.activeHelpTitle}>Your Active Help Request</Text>
                  </View>
                  <Text style={styles.activeHelpType}>{activeRequest.type.toUpperCase()} - {activeRequest.title}</Text>
                  <Text style={styles.activeHelpUrgency}>Urgency: {activeRequest.urgency}</Text>
                  <Text style={styles.activeHelpLocation}>Location: {activeRequest.location || 'Not specified'}</Text>
                  
                  <TouchableOpacity 
                    style={styles.stopHelpButton}
                    onPress={handleStopHelp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.stopHelpText}>STOP HELP - Mark as Fulfilled</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Gita Slok Card */}
              <View style={styles.gitaCard}>
                <View style={styles.gitaHeader}>
                  <View style={styles.gitaIconBg}>
                    <Ionicons name="book" size={24} color={COLORS.success} />
                  </View>
                  <View>
                    <Text style={styles.gitaTitle}>Bhagavad Gita Slok</Text>
                    <Text style={styles.gitaSubtitle}>
                      {wisdom?.chapter ? `Chapter ${wisdom.chapter}, Verse ${wisdom.verse}` : 'Daily Wisdom'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.gitaSanskrit}>
                  {wisdom?.sanskrit || 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।'}
                </Text>
                <Text style={styles.gitaTranslation}>
                  {wisdom?.translation || wisdom?.quote || 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.'}
                </Text>
              </View>

              {/* Two Card Row */}
              <View style={styles.twoCardRow}>
                <TouchableOpacity 
                  style={styles.mediumCard}
                  onPress={() => {
                    setModalVisible(false);
                    router.push('/panchang');
                  }}
                >
                  <View style={[styles.mediumIconBg, { backgroundColor: '#FFE5CC' }]}>
                    <Ionicons name="calendar" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.mediumTitle}>Today's Panchang</Text>
                  <Text style={styles.mediumSubtext}>{panchang?.tithi || 'Loading...'}</Text>
                  <Text style={styles.mediumDetail}>{panchang?.nakshatra || ''}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.mediumCard}>
                  <View style={[styles.mediumIconBg, { backgroundColor: '#E3F2FD' }]}>
                    <Ionicons name="star" size={20} color={COLORS.info} />
                  </View>
                  <Text style={styles.mediumTitle}>Daily Horoscope</Text>
                  <Text style={styles.mediumSubtext}>{panchang?.yoga || 'Shubh'}</Text>
                  <Text style={styles.mediumDetail} numberOfLines={2}>
                    {panchang?.karana || 'Today is favorable'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SOS Card */}
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
  floatingButton: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  glassBackground: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(200, 200, 200, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  redDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E53935',
  },
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
    maxHeight: SCREEN_HEIGHT * 0.6,
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
  // Active Help Request
  activeHelpCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  activeHelpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  helpTypeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  activeHelpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  activeHelpType: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  activeHelpUrgency: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  activeHelpLocation: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: SPACING.md,
  },
  stopHelpButton: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  stopHelpText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: SPACING.sm,
  },
  // Gita Card
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
    fontSize: 13,
    color: '#2E7D32',
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  gitaTranslation: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
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
  // SOS Card
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
