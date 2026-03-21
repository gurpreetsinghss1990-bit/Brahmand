import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
  ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { registerUser } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS, SPACING, LANGUAGES } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

const MandalaPattern = () => (
  <View style={styles.mandalaContainer}>
    <View style={styles.mandalaCircle} />
    <View style={[styles.mandalaCircle, styles.mandalaCircle2]} />
  </View>
);

export default function ProfileScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { login } = useAuthStore();
  
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [language, setLanguage] = useState('English');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera roll permission needed');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleContinue = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await registerUser({
        phone: phone || '',
        name: name.trim(),
        photo,
        language,
      });

      await login(response.data.user, response.data.token);
      router.replace('/auth/location');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#FF6600', '#FF9933']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <MandalaPattern />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Create Profile</Text>
            <Text style={styles.subtitle}>Set up your Brahmand profile</Text>

            {/* Profile Photo */}
            <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={32} color="rgba(255,255,255,0.6)" />
                </View>
              )}
              <View style={styles.photoEditBadge}>
                <Ionicons name="pencil" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Name Input */}
            <TextInput
              style={styles.nameInput}
              placeholder="Your Name"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError('');
              }}
              autoCapitalize="words"
            />

            {/* Language Selector */}
            <TouchableOpacity 
              style={styles.languageSelector}
              onPress={() => setShowLanguagePicker(true)}
            >
              <Text style={styles.languageLabel}>Language</Text>
              <View style={styles.languageValue}>
                <Text style={styles.languageText}>{language}</Text>
                <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.8)" />
              </View>
            </TouchableOpacity>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Continue Button */}
            <TouchableOpacity
              style={[styles.continueButton, !name.trim() && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={!name.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>

            {/* Privacy Note */}
            <View style={styles.privacyNote}>
              <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.privacyText}>Your information stays private</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguagePicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Language</Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.languageOption,
                    language === item && styles.languageOptionSelected
                  ]}
                  onPress={() => {
                    setLanguage(item);
                    setShowLanguagePicker(false);
                  }}
                >
                  <Text style={[
                    styles.languageOptionText,
                    language === item && styles.languageOptionTextSelected
                  ]}>
                    {item}
                  </Text>
                  {language === item && (
                    <Ionicons name="checkmark" size={22} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mandalaContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.08,
  },
  mandalaCircle: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  mandalaCircle2: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
  },
  keyboardView: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 100,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: SPACING.xl,
  },
  photoContainer: {
    marginBottom: SPACING.xl,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nameInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md + 2,
    borderRadius: 12,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  languageSelector: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  languageLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  languageValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginRight: SPACING.xs,
  },
  error: {
    color: '#FFCCCC',
    fontSize: 14,
    marginBottom: SPACING.md,
  },
  continueButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.md + 2,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  privacyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: SPACING.xs,
  },
  // Modal styles
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
    maxHeight: '60%',
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
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  languageOptionSelected: {
    backgroundColor: `${COLORS.primary}10`,
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  languageOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  languageOptionTextSelected: {
    fontWeight: '600',
    color: COLORS.primary,
  },
});
