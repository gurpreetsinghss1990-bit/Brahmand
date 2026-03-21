import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { initializeFirebase, firebaseConfig } from '../../src/services/firebase/config';
import { getAuth, PhoneAuthProvider, signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { COLORS, SPACING } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

// Subtle mandala pattern
const MandalaPattern = () => (
  <View style={styles.mandalaContainer}>
    <View style={styles.mandalaCircle} />
    <View style={[styles.mandalaCircle, styles.mandalaCircle2]} />
  </View>
);

export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const recaptchaRef = useRef<any>(null);

  // Ensure Firebase app is initialized before RecaptchaVerifier runs
  React.useEffect(() => {
    initializeFirebase();
  }, []);

  const handleSendOTP = async () => {
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fullPhone = `+91${phone}`;

      // Guard to ensure ref is attached after mount
      if (!recaptchaRef.current && Platform.OS !== 'web') {
        setError('reCAPTCHA not ready. Please wait and try again.');
        return;
      }

      try {
        const app = initializeFirebase();
        const auth = getAuth(app);
        
        let verificationId = '';
        
        if (Platform.OS === 'web') {
           try {
              // FOR WEB: Fully destroy the old RecaptchaVerifier and create a new one every time
              if ((window as any).recaptchaVerifier) {
                  try { (window as any).recaptchaVerifier.clear(); } catch(e){}
                  (window as any).recaptchaVerifier = null;
                  const container = document.getElementById('recaptcha-container');
                  if (container) container.innerHTML = ''; // clear DOM
              }

              (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                  size: 'invisible'
              });

              // Also render explicitly
              await (window as any).recaptchaVerifier.render();

              const confirmationResult = await signInWithPhoneNumber(auth, fullPhone, (window as any).recaptchaVerifier);
              verificationId = confirmationResult.verificationId;
              router.push({ pathname: '/auth/otp', params: { phone: fullPhone, verificationId } });
           } catch (err: any) {
              console.log('Firebase web auth error:', err);
              setError(err?.message || 'Failed to send OTP.');
              if ((window as any).recaptchaVerifier) {
                  try { (window as any).recaptchaVerifier.clear(); } catch(e){}
                  (window as any).recaptchaVerifier = null;
              }
           }
           return;
        } else {
            // For iOS and Android with expo-firebase-recaptcha
            // NOTE: Do not forcefully unmount or clear `recaptchaRef.current` blindly 
            // because `PhoneAuthProvider` expects a stable application verifier reference
            
            const phoneProvider = new PhoneAuthProvider(auth);
            verificationId = await phoneProvider.verifyPhoneNumber(
              fullPhone,
              recaptchaRef.current
            );
            router.push({ pathname: '/auth/otp', params: { phone: fullPhone, verificationId } });
        }
      } catch (err: any) {
        console.log('Firebase verifyPhoneNumber error object:', err);
        console.log('Firebase verifyPhoneNumber error.code:', err?.code);
        setError(err?.message || 'Failed to send OTP. Please try again.');
        
        // If an invalid app credential error occurs, tell the verifier to clear for the next attempt safely
        if (err?.code === 'auth/invalid-app-credential') {
          try {
             if (typeof (recaptchaRef.current as any).clear === 'function') {
               (recaptchaRef.current as any).clear();
               console.log('Cleared recaptcha successfully after failure');
             }
          } catch(e) {}
        }
      }
    } catch (err: any) {
      console.log('Firebase Error:', err);
      setError(err?.message || 'Failed to send OTP. Please try again.');
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
        {Platform.OS === 'web' ? <div id="recaptcha-container"></div> : null}
        
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaRef}
          firebaseConfig={firebaseConfig}
          attemptInvisibleVerification={true}
        />

        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Enter your phone</Text>
          <Text style={styles.subtitle}>We'll send you a verification code</Text>

          {/* Phone Input */}
          <View style={styles.phoneContainer}>
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="Phone number"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={phone}
              onChangeText={(text) => {
                setPhone(text.replace(/[^0-9]/g, ''));
                setError('');
              }}
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Send OTP Button */}
          <TouchableOpacity
            style={[styles.sendButton, phone.length !== 10 && styles.sendButtonDisabled]}
            onPress={handleSendOTP}
            disabled={phone.length !== 10 || loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.sendButtonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
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
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  prefixBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md + 2,
    borderRadius: 12,
    marginRight: SPACING.sm,
  },
  prefixText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md + 2,
    borderRadius: 12,
    fontSize: 18,
    color: '#FFFFFF',
  },
  error: {
    color: '#FFCCCC',
    fontSize: 14,
    marginBottom: SPACING.md,
  },
  sendButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.md + 2,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
