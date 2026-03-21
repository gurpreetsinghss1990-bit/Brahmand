import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  Timestamp,
  DocumentData,
  getDocs,
} from 'firebase/firestore';
import { getFirestoreDB } from './config';

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_photo?: string;
  text: string;
  content: string;
  created_at: string;
  timestamp: string;
}

/**
 * Parse timestamp from various formats
 */
function parseTimestamp(value: any): string {
  if (!value) return '';
  
  try {
    if (value instanceof Timestamp) {
      return value.toDate().toISOString();
    } else if (typeof value === 'string') {
      return value;
    } else if (value.toDate && typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    } else if (value.seconds) {
      // Firestore timestamp object
      return new Date(value.seconds * 1000).toISOString();
    }
  } catch (e) {
    console.warn('Error parsing timestamp:', e);
  }
  return '';
}

/**
 * Parse document data into ChatMessage
 */
function parseMessage(doc: any): ChatMessage {
  const data = doc.data() as DocumentData;
  const createdAt = parseTimestamp(data.created_at);
  const timestamp = parseTimestamp(data.timestamp);
  
  return {
    id: doc.id,
    sender_id: data.sender_id || '',
    sender_name: data.sender_name || 'Unknown',
    sender_photo: data.sender_photo,
    text: data.text || data.content || '',
    content: data.content || data.text || '',
    created_at: createdAt || timestamp || new Date().toISOString(),
    timestamp: timestamp || createdAt || new Date().toISOString(),
  };
}

/**
 * Subscribe to real-time messages for a chat
 * Uses Firestore onSnapshot listener on chats/{chatId}/messages
 * 
 * @param chatId - The chat document ID
 * @param onMessagesUpdate - Callback when messages update
 * @param onError - Callback for errors
 * @returns Unsubscribe function to stop listening
 */
export function subscribeToMessages(
  chatId: string,
  onMessagesUpdate: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  console.log('[Firestore] Setting up real-time listener for chat:', chatId);
  
  const db = getFirestoreDB();
  
  // Reference to messages subcollection: chats/{chatId}/messages
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  
  // Query ordered by created_at ascending (oldest first)
  const messagesQuery = query(
    messagesRef,
    orderBy('created_at', 'asc')
  );
  
  // Set up real-time listener
  const unsubscribe = onSnapshot(
    messagesQuery,
    (snapshot) => {
      console.log('[Firestore] Snapshot received, docs:', snapshot.size);
      
      const messages: ChatMessage[] = [];
      
      snapshot.forEach((doc) => {
        messages.push(parseMessage(doc));
      });
      
      console.log('[Firestore] Parsed messages:', messages.length);
      onMessagesUpdate(messages);
    },
    (error) => {
      console.error('[Firestore] Listener error:', error.code, error.message);
      if (onError) {
        onError(error);
      }
    }
  );
  
  return unsubscribe;
}

/**
 * Fetch messages once (fallback for when real-time fails)
 */
export async function fetchMessagesOnce(chatId: string): Promise<ChatMessage[]> {
  console.log('[Firestore] Fetching messages once for chat:', chatId);
  
  const db = getFirestoreDB();
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const messagesQuery = query(messagesRef, orderBy('created_at', 'asc'));
  
  try {
    const snapshot = await getDocs(messagesQuery);
    const messages: ChatMessage[] = [];
    
    snapshot.forEach((doc) => {
      messages.push(parseMessage(doc));
    });
    
    console.log('[Firestore] Fetched messages:', messages.length);
    return messages;
  } catch (error) {
    console.error('[Firestore] Fetch error:', error);
    return [];
  }
}
