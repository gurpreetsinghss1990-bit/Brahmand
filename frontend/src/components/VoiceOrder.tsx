import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface VoiceOrderProps {
  menuItems: string[];
  vendorPhone: string;
  vendorName: string;
}

interface ParsedItem {
  text: string;
  isMatch: boolean;
  matchedMenuItem?: string;
}

export default function VoiceOrder({ menuItems, vendorPhone, vendorName }: VoiceOrderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const recognitionRef = useRef<any>(null);

  const matchItemsToMenu = useCallback((spokenText: string): ParsedItem[] => {
    const normalizedSpoken = spokenText.toLowerCase().trim();
    if (!normalizedSpoken) return [];
    
    const spokenWords = normalizedSpoken.split(/\s+/).filter(w => w.length > 0);
    if (spokenWords.length === 0) return [];
    
    const results: ParsedItem[] = [];
    const usedMenuItems = new Set<string>();
    
    for (const menuItem of menuItems) {
      const normalizedMenu = menuItem.toLowerCase();
      const menuWords = normalizedMenu.split(/\s+/).filter(w => w.length > 0);
      
      for (const spokenWord of spokenWords) {
        const isMatch = menuWords.some(mw => 
          mw.includes(spokenWord) || spokenWord.includes(mw)
        );
        
        if (isMatch && !usedMenuItems.has(normalizedMenu)) {
          usedMenuItems.add(normalizedMenu);
          results.push({
            text: menuItem,
            isMatch: true,
            matchedMenuItem: menuItem,
          });
          break;
        }
      }
    }
    
    for (const spokenWord of spokenWords) {
      const isMatched = results.some(r => 
        r.matchedMenuItem?.toLowerCase().includes(spokenWord)
      );
      
      if (!isMatched) {
        results.push({
          text: spokenWord,
          isMatch: false,
        });
      }
    }
    
    return results;
  }, [menuItems]);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      Alert.alert('Not Supported', 'Speech recognition is not supported on this browser.');
      return;
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setTranscribedText(transcript);
      setParsedItems(matchItemsToMenu(transcript));
    };

    recognition.onerror = (event: any) => {
      console.log('Speech error:', event.error);
      setIsListening(false);
      if (event.error !== 'aborted') {
        Alert.alert('Error', 'Unable to recognize speech.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (e) {
      console.log('Failed to start:', e);
    }
  }, [matchItemsToMenu]);

  const handleTextChange = useCallback((text: string) => {
    setTranscribedText(text);
    setParsedItems(matchItemsToMenu(text));
  }, [matchItemsToMenu]);

  const handleOrder = useCallback(() => {
    if (!transcribedText.trim()) {
      Alert.alert('Empty Order', 'Please speak or type your order first.');
      return;
    }

    const matchedItems = parsedItems.filter(item => item.isMatch).map(item => item.matchedMenuItem);
    const unmatchedItems = parsedItems.filter(item => !item.isMatch).map(item => item.text);

    let message = `Hi ${vendorName}, I would like to order:\n`;
    
    if (matchedItems.length > 0) {
      message += `\nItems from your menu:\n${matchedItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}`;
    }
    
    if (unmatchedItems.length > 0) {
      message += `\n\nAdditional items (not on menu):\n${unmatchedItems.join(', ')}`;
    }

    let phoneNumber = vendorPhone.replace(/\D/g, '');
    if (!phoneNumber.startsWith('91')) {
      phoneNumber = '91' + phoneNumber;
    }
    
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    Linking.openURL(whatsappUrl).catch(() => {
      Linking.openURL(`sms:${vendorPhone}?body=${encodeURIComponent(message)}`);
    });
  }, [transcribedText, parsedItems, vendorPhone, vendorName]);

  const renderParsedItems = () => {
    if (parsedItems.length === 0 && transcribedText) {
      return (
        <View>
          <Text style={styles.parsedLabel}>Your order:</Text>
          <Text style={styles.rawText}>{transcribedText}</Text>
        </View>
      );
    }

    return parsedItems.map((item, index) => (
      <View key={index} style={styles.parsedItemRow}>
        {item.isMatch ? (
          <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
        ) : (
          <Ionicons name="close-circle" size={18} color={COLORS.error} />
        )}
        <Text style={[styles.parsedItemText, item.isMatch ? styles.matchedText : styles.unmatchedText]}>
          {item.isMatch ? item.matchedMenuItem : item.text}
        </Text>
      </View>
    ));
  };

  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <TouchableOpacity 
          style={styles.toggleButton}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={COLORS.text} 
          />
          <Text style={styles.toggleText}>Want to place an order</Text>
        </TouchableOpacity>
      </View>

      {isExpanded && (
        <View style={styles.expandedContent}>
          {isWeb && (
            <TouchableOpacity 
              style={[styles.micButton, isListening && styles.micButtonActive]}
              onPress={startSpeechRecognition}
            >
              <Ionicons 
                name={isListening ? "mic" : "mic-outline"} 
                size={28} 
                color={isListening ? COLORS.surface : COLORS.primary} 
              />
            </TouchableOpacity>
          )}

          <View style={styles.messageBox}>
            {parsedItems.length > 0 ? (
              renderParsedItems()
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder="Type your order here or tap mic to speak..."
                placeholderTextColor={COLORS.textLight}
                value={transcribedText}
                onChangeText={handleTextChange}
                multiline
                numberOfLines={3}
              />
            )}
          </View>

          {parsedItems.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => {
                setTranscribedText('');
                setParsedItems([]);
              }}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.orderButton, !transcribedText.trim() && styles.orderButtonDisabled]}
            onPress={handleOrder}
            disabled={!transcribedText.trim()}
          >
            <Ionicons name="cart-outline" size={20} color={COLORS.surface} />
            <Text style={styles.orderButtonText}>Order via WhatsApp</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  toggleText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  expandedContent: {
    marginTop: SPACING.md,
  },
  micButton: {
    alignSelf: 'center',
    backgroundColor: `${COLORS.primary}15`,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  micButtonActive: {
    backgroundColor: COLORS.primary,
  },
  messageBox: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    minHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  textInput: {
    fontSize: 14,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
  parsedLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  rawText: {
    fontSize: 14,
    color: COLORS.text,
  },
  parsedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  parsedItemText: {
    fontSize: 14,
    flex: 1,
  },
  matchedText: {
    color: COLORS.success,
    fontWeight: '500',
  },
  unmatchedText: {
    color: COLORS.error,
    textDecorationLine: 'line-through',
  },
  clearButton: {
    alignSelf: 'flex-end',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
  },
  clearButtonText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  orderButtonDisabled: {
    opacity: 0.5,
  },
  orderButtonText: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: '600',
  },
});