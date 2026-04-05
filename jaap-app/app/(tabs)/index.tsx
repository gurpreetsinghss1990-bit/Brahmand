import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MANTRAS } from '../../constants/mantra';
/**
 * Single-file Jaap app for Expo Snack compatibility.
 * Everything (UI + data + logic) is intentionally kept in this App.js.
 */

const COLORS = {
  saffronStart: '#F29D38',
  saffronEnd: '#F8D79A',
  darkBackground: '#1D150F',
  darkSurface: '#2A1E16',
  gold: '#D3A53A',
  textPrimary: '#2C1A10',
  textSecondary: '#5C4338',
  softWhite: '#FFF9EE',
};
const selectedMantra = MANTRAS[0];


const AMBIENCE = [
  {
    id: 'temple',
    label: 'Temple',
    audio: 'https://assets.mixkit.co/music/preview/mixkit-atmosphere-rain-quiet-699.mp3',
  },
  { id: 'omhum', label: 'Om hum', audio: 'https://assets.mixkit.co/music/preview/mixkit-sleepy-cat-135.mp3' },
  {
    id: 'river',
    label: 'River',
    audio: 'https://assets.mixkit.co/music/preview/mixkit-waterfall-in-forest-ambience-1187.mp3',
  },
];



function SacredBackground({ children }) {
  return (
    <LinearGradient colors={[COLORS.saffronStart, COLORS.saffronEnd]} style={styles.gradient}>
      <View style={styles.mandalaOuter} />
      <View style={styles.mandalaInner} />
      {children}
    </LinearGradient>
  );
}
const DURATIONS = [27, 54, 108]
export default function App() {
  const [screen, setScreen] = useState('home');
  const [selectedMantra, setSelectedMantra] = useState(MANTRAS[0]);
  const [selectedDuration, setSelectedDuration] = useState(108);
  
  const [targetCount ,setTargetCount] = useState(selectedDuration);
const [count, setCount] = useState(0);
const [flash, setFlash] = useState(false);
const progress = count / targetCount;
const beads = Array.from({ length: targetCount });
const scaleAnim = useState(new Animated.Value(1))[0];
const glowAnim = useState(new Animated.Value(1))[0];
const [sound, setSound] = useState<any>(null);
const words =selectedMantra.text.split('');
const [currentWord, setCurrentWord] = useState(0);
const [isPlaying, setIsPlaying] = useState(false);
useEffect(() => {
  setTargetCount(selectedDuration);
}, [selectedDuration]);

async function playMantra() {
  if (!selectedMantra?.audio) return;

  const { sound } = await Audio.Sound.createAsync(
    {uri: selectedMantra.audio }
  );
  setSound(sound);
  await sound.playAsync();
  setIsPlaying(true);
}
useEffect(() => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(glowAnim, {
        toValue: 1.08,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    ])
  ).start();
}, []);
useEffect(() => {
  if (!sound || !isPlaying) return;

  const interval = setInterval(async () => {
    const status = await sound.getStatusAsync();

    if (status.isLoaded) {
      const position = status.positionMillis;

      const wordIndex = Math.floor(position / 800);
      setCurrentWord(wordIndex % words.length);
      setCount(wordIndex + 1);
    }
  }, 200);

  return () => clearInterval(interval);
}, [isPlaying, sound]);
function handleTap() {
  setCount(prev => {
    const newCount = prev + 1;
    setCurrentWord((prev) => (prev + 1) % words.length);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playMantra();
    if (newCount === targetCount) {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  setFlash(true);
    

setTimeout(() => {
  setFlash(false);
}, 600);
return newCount;
}
    Animated.sequence([
  Animated.timing(scaleAnim, {
    toValue: 1.15,
    duration: 100,
    useNativeDriver: true,
  }),
  Animated.timing(scaleAnim, {
    toValue: 1,
    duration: 100,
    useNativeDriver: true,
  }),
]).start();

    // 🎯 108 COMPLETE
    if (newCount >= 108) {
      setResult({
        duration: selectedDuration,
        energy: 'high',
      });

      setTimeout(() => {
        setScreen('complete');
        setCount(0);
      }, 500);

    

  return 108;
}

return newCount;
  });
}
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen === 'home' && (
        <Home 
        onStart={() => setScreen('setup')}
        count={count}
        targetCount={targetCount}
        beads={beads}
        />
      )}  
      {screen === 'setup' && (
        <Setup
          mantra={selectedMantra}
          duration={selectedDuration}
          onSelectMantra={setSelectedMantra}
          onSelectDuration={setSelectedDuration}
          onContinue={() => setScreen('session')}
        />
      )}
      {screen === 'session' && (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
   <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    {/* Background Circle */}
<View
  style={{
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.2)',
  }}
/>
<View
  style={{
    position: 'absolute',
    width: 260,
    height: 260,
  }}
>
  {beads.map((_, i) => {
    const angle = (i / 108) * 2 * Math.PI;
    const radius = 130;

    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          width: i < count ? 10 : 6,
          height: i < count ? 10 : 6,
          borderRadius: 5,
          backgroundColor: 'red',
          left: 130 + x - 5,
          top: 130 + y - 5,
        }}
      />
    );
  })}
</View>

{/* Progress Ring */}
<View
  style={{
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 6,
    borderColor: '#FFD700',
    transform: [{ rotate: `${progress * 360}deg` }],
  }}
/>
{flash && (
  <View
    style={{
      position: 'absolute',
      width: '100%',
      height: '100%',
      backgroundColor: '#FFD700',
      opacity: 0.25,
      zIndex: 1,
    }}
  />
)}
<Animated.View
  style={{
    transform: [
      { scale: scaleAnim },
      { scale: glowAnim },
    ],
  }}
>
    <Pressable
      onPress={handleTap}
      style={{
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#F29D38',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FFD700',
shadowOffset: { width: 0, height: 0 },
shadowOpacity: 0.9,
shadowRadius: 20,
elevation: 20,
      }}
    >
      <Text style={{
  fontSize: 34,
  color: '#fff',
  fontWeight: 'bold',
  letterSpacing: 1,
}}>
        {count} / {targetCount}
      </Text>
      
 <Text style={{
  marginTop: 10,
  textAlign: 'center',
  paddingHorizontal: 20,
  flexWrap: 'wrap',
  width: '100%',
}}>
  {words.map((word, index) => (
    <Text
      key={index}
      style={{
        color: index === currentWord ? '#FFD700' : '#fff',
        fontSize: index === currentWord ? 20 : 16,
        fontWeight: index === currentWord ? 'bold' : 'normal',
      }}
    >
      {word + ' '}
    </Text>
  ))}
 </Text>
 <Text style={{
  color: '#fff',
  marginTop: 10,
  fontSize: 12,
}}>
  🔥 {count} chants • 🧘 1,284 chanting now
</Text>

    </Pressable>
    </Animated.View>

  </View>
  </View>
)}
      {screen === 'complete' && (
        <Complete duration={result.duration} energy={result.energy} onHome={() => setScreen('home')} />
      )}
    </SafeAreaProvider>
  );
}

function Home({ onStart, count, targetCount, beads  }) {
  return (
    <SacredBackground>
      <View style={styles.homeContainer}>
<View style={{ position: 'absolute', width: 300, height: 300 }}>
  {beads.map((_, i) => {
    const angle = (i / targetCount) * 2 * Math.PI;
    const radius = 140;

    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    const isActive = i < count;

    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: isActive ? '#FFD700' : 'rgba(255,255,255,0.2)',
          transform: [
            { translateX: x + 150 },
            { translateY: y + 150 },
          ],
        }}
      />
    );
  })}
</View>
        <Pressable style={styles.cta} onPress={onStart}>
          <Text style={styles.ctaText}>Start Jaap</Text>
        </Pressable>
        <View style={styles.homeFooter}>
          <Text style={styles.footerText}>🔥 Streak: 7 days</Text>
          <Text style={styles.footerText}>⚡ Energy: MEDIUM</Text>
        </View>
      </View>
    </SacredBackground>
  );
}

function Setup({ mantra, duration, onSelectMantra, onSelectDuration, onContinue }) {
  return (
    <SacredBackground>
      <ScrollView contentContainerStyle={styles.setupContainer}>
        <Text style={styles.heading}>Select Mantra</Text>
        {MANTRAS.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.option, mantra.id === item.id && styles.optionActive]}
            onPress={() => onSelectMantra(item)}
          >
            <Text style={styles.optionText}>{item.name}</Text>
          </Pressable>
        ))}

        <Text style={styles.heading}>Select Duration</Text>
        <View style={styles.durationRow}>
          {DURATIONS.map((item) => (
            <Pressable
              key={item}
              style={[styles.duration, duration === item && styles.optionActive]}
              onPress={() => onSelectDuration(item)}
            >
              <Text style={styles.optionText}>{item} min</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.cta} onPress={onContinue}>
          <Text style={styles.ctaText}>Begin Session</Text>
        </Pressable>
      </ScrollView>
    </SacredBackground>
  );
}

function Session({ mantra, duration, onComplete }) {
  const totalSeconds = duration * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [showMeaning, setShowMeaning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [beads, setBeads] = useState(0);
  const [people, setPeople] = useState(2431);
  const [ambient, setAmbient] = useState(AMBIENCE[0]);

  const glow = useRef(new Animated.Value(0.85)).current;
  const mantraSound = useRef(null);
  const ambienceSound = useRef(null);

  const energy = useMemo(() => {
    const progress = (totalSeconds - secondsLeft) / totalSeconds;
    if (progress >= 0.85) return 'DIVINE';
    if (progress >= 0.6) return 'HIGH';
    if (progress >= 0.35) return 'MEDIUM';
    return 'LOW';
  }, [secondsLeft, totalSeconds]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.85, duration: 1600, useNativeDriver: true }),
      ]),
    ).start();
  }, [glow]);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!manualMode) {
      const step = (duration * 60 * 1000) / 108;
      const interval = setInterval(() => {
        setBeads((prev) => {
          const next = Math.min(108, prev + 1);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          return next;
        });
      }, step);
      return () => clearInterval(interval);
    }
  }, [manualMode, duration]);

  useEffect(() => {
    const population = setInterval(() => {
      setPeople((prev) => Math.max(2200, prev + Math.floor(Math.random() * 17) - 8));
    }, 3000);
    return () => clearInterval(population);
  }, []);

  useEffect(() => {
    const load = async () => {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      if (mantraSound.current) await mantraSound.current.unloadAsync();
      if (ambienceSound.current) await ambienceSound.current.unloadAsync();

      const mantraTrack = new Audio.Sound();
      const ambienceTrack = new Audio.Sound();
      await mantraTrack.loadAsync({ uri: mantra.audio }, { isLooping: true, shouldPlay: true, volume: 1 });
      await ambienceTrack.loadAsync(
        { uri: ambient.audio },
        { isLooping: true, shouldPlay: true, volume: 0.35 },
      );
      mantraSound.current = mantraTrack;
      ambienceSound.current = ambienceTrack;
    };

    load();

    return () => {
      mantraSound.current?.unloadAsync();
      ambienceSound.current?.unloadAsync();
    };
  }, [mantra, ambient]);

  useEffect(() => {
    if (secondsLeft === 0) onComplete(energy);
  }, [secondsLeft, energy, onComplete]);

  return (
    <View style={styles.sessionContainer}>
      <Animated.View style={[styles.sessionGlow, { transform: [{ scale: glow }] }]} />
      <Text style={styles.timer}>{String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}</Text>
      <Text style={styles.sanskrit}>{mantra.sanskrit}</Text>

      <Pressable onPress={() => setShowMeaning((prev) => !prev)}>
        <Text style={styles.meaning}>{showMeaning ? mantra.meaning : 'Show meaning'}</Text>
      </Pressable>

      <View style={styles.chips}>
        {AMBIENCE.map((item) => (
          <Pressable key={item.id} onPress={() => setAmbient(item)}>
            <Text style={[styles.chip, ambient.id === item.id && styles.chipActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.counter}>Mala: {beads}/108</Text>
      <View style={styles.tapRow}>
        <Text style={styles.meaning}>Tap mode</Text>
        <Switch value={manualMode} onValueChange={setManualMode} />
        {manualMode ? (
          <Pressable
            style={styles.tapButton}
            onPress={() => {
              setBeads((prev) => Math.min(108, prev + 1));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.tapText}>Tap Bead</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.energy}>Energy: {energy}</Text>
      <Text style={styles.people}>{people.toLocaleString()} people chanting now</Text>
    </View>
  );
}

function Complete({ duration, energy, onHome }) {
  const burst = useRef(new Animated.Value(0.65)).current;

  useEffect(() => {
    Animated.spring(burst, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [burst]);

  return (
    <SacredBackground>
      <View style={styles.completeContainer}>
        <Animated.View style={[styles.completeGlow, { transform: [{ scale: burst }] }]} />
        <Text style={styles.completeTitle}>Jaap Completed</Text>
        <Text style={styles.completeText}>Duration: {duration} min</Text>
        <Text style={styles.completeText}>Energy: {energy}</Text>

        <Pressable style={styles.cta} onPress={onHome}>
          <Text style={styles.ctaText}>Return Home</Text>
        </Pressable>
      </View>
    </SacredBackground>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  mandalaOuter: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    top: '30%',
    alignSelf: 'center',
  },
  mandalaInner: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    top: '38%',
    alignSelf: 'center',
  },
  homeContainer: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingTop: '55%' },
  homeFooter: { marginBottom: 28 },
  footerText: { color: COLORS.textPrimary, fontWeight: '600', textAlign: 'center' },
  cta: {
    backgroundColor: COLORS.gold,
    borderRadius: 999,
    paddingHorizontal: 34,
    paddingVertical: 16,
    elevation: 3,
  },
  ctaText: { color: COLORS.softWhite, fontWeight: '700', fontSize: 21 },
  setupContainer: { padding: 20, paddingTop: 64 },
  heading: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700', marginVertical: 12 },
  option: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.82)',
    marginBottom: 10,
  },
  optionActive: { backgroundColor: '#F1CB79' },
  optionText: { color: COLORS.textPrimary, fontWeight: '600' },
  durationRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  duration: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 12,
    padding: 12,
  },
  sessionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.darkBackground,
    gap: 12,
  },
  sessionGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(247, 181, 84, 0.18)',
  },
  timer: { fontSize: 40, fontWeight: '700', color: COLORS.softWhite },
  sanskrit: { fontSize: 27, fontWeight: '700', color: COLORS.softWhite, textAlign: 'center' },
  meaning: { color: '#CDBA9A' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: {
    color: COLORS.softWhite,
    backgroundColor: COLORS.darkSurface,
    padding: 8,
    borderRadius: 10,
  },
  chipActive: { backgroundColor: '#5A4027' },
  counter: { color: COLORS.softWhite, fontSize: 20, fontWeight: '600' },
  tapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tapButton: { backgroundColor: COLORS.gold, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  tapText: { color: COLORS.softWhite, fontWeight: '700' },
  energy: { color: COLORS.gold, fontSize: 22, fontWeight: '700', marginTop: 6 },
  people: { color: '#CDBA9A' },
  completeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  completeGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 229, 156, 0.45)',
  },
  completeTitle: { fontSize: 34, fontWeight: '700', color: COLORS.textPrimary },
  completeText: { fontSize: 18, color: COLORS.textSecondary },
});
