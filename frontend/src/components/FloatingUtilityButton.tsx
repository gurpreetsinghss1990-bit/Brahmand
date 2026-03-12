import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
  Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useHelpRequestStore } from '../store/helpRequestStore';
import { 
  getWisdom, 
  createSOSAlert, 
  getMySOSAlert, 
  resolveSOSAlert,
  getActiveSOSAlerts
} from '../services/api';
import * as Location from 'expo-location';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Panchang API
const getPanchangData = async () => {
  try {
    const response = await fetch('https://brahmand-vendors.preview.emergentagent.com/api/spiritual/panchang');
    return await response.json();
  } catch (error) {
    console.error('Panchang error:', error);
    return null;
  }
};

// Festivals API
const getFestivalsData = async () => {
  try {
    const response = await fetch('https://brahmand-vendors.preview.emergentagent.com/api/spiritual/festivals?limit=1');
    const data = await response.json();
    return data?.[0] || null;
  } catch (error) {
    console.error('Festivals error:', error);
    return null;
  }
};

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
  const [sosLoading, setSOSLoading] = useState(false);
  const { activeRequest, fetchActiveRequest, resolveRequest, hasActiveRequest } = useHelpRequestStore();
  
  // SOS state
  const [activeSOS, setActiveSOS] = useState<any>(null);
  const [nearbySOSCount, setNearbySOSCount] = useState(0);
  
  // Spiritual data
  const [wisdom, setWisdom] = useState<any>(null);
  const [panchang, setPanchang] = useState<any>(null);
  const [nextFestival, setNextFestival] = useState<any>(null);
  
  // Pulse animation for nearby SOS
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchActiveRequest();
    loadUtilityData();
    checkSOSStatus();
  }, []);

  useEffect(() => {
    if (nearbySOSCount > 0) {
      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            easing: Easing.ease,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.ease,
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [nearbySOSCount]);

  const loadUtilityData = async () => {
    try {
      const [wisdomRes, panchangData, festivalData] = await Promise.all([
        getWisdom().catch(() => null),
        getPanchangData(),
        getFestivalsData()
      ]);
      setWisdom(wisdomRes?.data);
      setPanchang(panchangData);
      setNextFestival(festivalData);
    } catch (error) {
      console.error('Error loading utility data:', error);
    }
  };

  const checkSOSStatus = async () => {
    try {
      // Check for user's active SOS
      const mySOSRes = await getMySOSAlert();
      setActiveSOS(mySOSRes.data);

      // Check for nearby SOS alerts
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const nearbyRes = await getActiveSOSAlerts({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          radius: 10
        });
        // Don't count user's own SOS
        const otherSOS = (nearbyRes.data || []).filter((s: any) => s.id !== mySOSRes.data?.id);
        setNearbySOSCount(otherSOS.length);
      }
    } catch (error) {
      console.error('Error checking SOS status:', error);
    }
  };

  const handleCreateSOS = async () => {
    Alert.alert(
      'Emergency SOS',
      'This will alert nearby community members with your location. Are you sure you need emergency help?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'SEND SOS', 
          style: 'destructive', 
          onPress: async () => {
            setSOSLoading(true);
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Location Required', 'Please enable location to send SOS alert');
                return;
              }
              
              const location = await Location.getCurrentPositionAsync({});
              
              const response = await createSOSAlert({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
              });
              
              setActiveSOS(response.data);
              Alert.alert('SOS Alert Sent', 'Your emergency alert has been sent to nearby community members. Stay safe!');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to send SOS alert');
            } finally {
              setSOSLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleResolveActiveSOS = async (status: 'resolved' | 'cancelled') => {
    if (!activeSOS) return;
    
    const message = status === 'resolved' 
      ? 'Has help arrived? This will close your SOS alert.'
      : 'Cancel your SOS alert?';
    
    Alert.alert(
      status === 'resolved' ? 'Help Received' : 'Cancel SOS',
      message,
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes', 
          onPress: async () => {
            setSOSLoading(true);
            try {
              await resolveSOSAlert(activeSOS.id, status);
              setActiveSOS(null);
              Alert.alert('Success', status === 'resolved' ? 'Glad you received help!' : 'SOS alert cancelled');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to resolve SOS');
            } finally {
              setSOSLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleStopHelp = async () => {
    Alert.alert(
      'Resolve Help Request',
      'Has your help request been fulfilled? This will close the request.',
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
  const hasNearbyEmergency = nearbySOSCount > 0;

  return (
    <>
      {/* Floating Button */}
      <Animated.View style={[
        styles.floatingButtonContainer,
        { transform: [{ scale: hasNearbyEmergency ? pulseAnim : 1 }] }
      ]}>
        <TouchableOpacity
          style={[
            styles.floatingButton,
            hasNearbyEmergency && styles.floatingButtonEmergency,
            activeSOS && styles.floatingButtonActiveSOS
          ]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.9}
        >
          <View style={[
            styles.glassBackground,
            hasNearbyEmergency && styles.glassBackgroundEmergency,
            activeSOS && styles.glassBackgroundActiveSOS
          ]}>
            {activeSOS ? (
              <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
            ) : isActiveHelp && activeRequest ? (
              <Ionicons 
                name={getHelpIcon(activeRequest.type) as any} 
                size={22} 
                color={getHelpColor(activeRequest.type)} 
              />
            ) : hasNearbyEmergency ? (
              <Ionicons name="alert" size={22} color="#FFFFFF" />
            ) : (
              <View style={styles.redDot} />
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>

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
              {/* Active SOS Section */}
              {activeSOS && (
                <View style={styles.activeSosCard}>
                  <View style={styles.activeSosHeader}>
                    <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
                    <Text style={styles.activeSosTitle}>YOUR SOS IS ACTIVE</Text>
                  </View>
                  <Text style={styles.activeSosLocation}>
                    Location: {activeSOS.area}, {activeSOS.city}
                  </Text>
                  {activeSOS.responders?.length > 0 && (
                    <Text style={styles.activeSosResponders}>
                      {activeSOS.responders.length} people responding
                    </Text>
                  )}
                  
                  <View style={styles.sosButtonRow}>
                    <TouchableOpacity 
                      style={styles.sosResolveButton}
                      onPress={() => handleResolveActiveSOS('resolved')}
                      disabled={sosLoading}
                    >
                      {sosLoading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                          <Text style={styles.sosButtonText}>HELP RECEIVED</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.sosCancelButton}
                      onPress={() => handleResolveActiveSOS('cancelled')}
                      disabled={sosLoading}
                    >
                      <Ionicons name="close-circle" size={18} color={COLORS.error} />
                      <Text style={[styles.sosButtonText, { color: COLORS.error }]}>CANCEL</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

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
                        <Text style={styles.stopHelpText}>MARK AS FULFILLED</Text>
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

              {/* Panchang and Festival Row */}
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

                <View style={styles.mediumCard}>
                  <View style={[styles.mediumIconBg, { backgroundColor: '#E8F5E9' }]}>
                    <Ionicons name="sparkles" size={20} color={COLORS.success} />
                  </View>
                  <Text style={styles.mediumTitle}>Next Festival</Text>
                  <Text style={styles.mediumSubtext}>{nextFestival?.name || 'Loading...'}</Text>
                  <Text style={styles.mediumDetail}>
                    {nextFestival?.days_until !== undefined 
                      ? `in ${nextFestival.days_until} days` 
                      : ''
                    }
                  </Text>
                </View>
              </View>

              {/* Horoscope Card */}
              <TouchableOpacity 
                style={styles.horoscopeCard}
                onPress={() => {
                  setModalVisible(false);
                  router.push('/profile');
                }}
              >
                <View style={[styles.mediumIconBg, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="star" size={20} color={COLORS.info} />
                </View>
                <View style={styles.horoscopeContent}>
                  <Text style={styles.mediumTitle}>Daily Horoscope</Text>
                  <Text style={styles.mediumSubtext}>Set your birth details in Profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
              </TouchableOpacity>

              {/* SOS Card */}
              {!activeSOS && (
                <View style={styles.sosCard}>
                  <View style={styles.sosHeader}>
                    <View style={styles.sosIconBg}>
                      <Ionicons name="alert-circle" size={28} color={COLORS.error} />
                    </View>
                    <Text style={styles.sosTitle}>Emergency SOS</Text>
                  </View>
                  
                  <Text style={styles.sosDescription}>
                    Use this if you need urgent help. This will instantly alert nearby community members with your location.
                  </Text>

                  <TouchableOpacity 
                    style={styles.sosButton}
                    onPress={handleCreateSOS}
                    activeOpacity={0.8}
                    disabled={sosLoading}
                  >
                    {sosLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="alert" size={20} color="#FFFFFF" />
                        <Text style={styles.sosButtonMainText}>SEND SOS</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.sosNote}>
                    Your location will be shared to help people reach you faster.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 90,
    right: 16,
  },
  floatingButton: {
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
  floatingButtonEmergency: {
    shadowColor: '#E53935',
    shadowOpacity: 0.4,
  },
  floatingButtonActiveSOS: {
    shadowColor: '#E53935',
    shadowOpacity: 0.6,
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
  glassBackgroundEmergency: {
    backgroundColor: '#E53935',
  },
  glassBackgroundActiveSOS: {
    backgroundColor: '#E53935',
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
    maxHeight: SCREEN_HEIGHT * 0.7,
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
  // Active SOS Card
  activeSosCard: {
    backgroundColor: '#E53935',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  activeSosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  activeSosTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: SPACING.sm,
  },
  activeSosLocation: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 4,
  },
  activeSosResponders: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginBottom: SPACING.md,
  },
  sosButtonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  sosResolveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43A047',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  sosCancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
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
  // Horoscope Card
  horoscopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  horoscopeContent: {
    flex: 1,
    marginLeft: SPACING.sm,
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
  sosButtonMainText: {
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
