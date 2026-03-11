import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  Timestamp,
  DocumentData,
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
      const messages: ChatMessage[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data() as DocumentData;
        
        // Convert Firestore Timestamp to ISO string
        let createdAt = '';
        let timestamp = '';
        
        if (data.created_at) {
          if (data.created_at instanceof Timestamp) {
            createdAt = data.created_at.toDate().toISOString();
          } else if (typeof data.created_at === 'string') {
            createdAt = data.created_at;
          } else if (data.created_at.toDate) {
            createdAt = data.created_at.toDate().toISOString();
          }
        }
        
        if (data.timestamp) {
          if (data.timestamp instanceof Timestamp) {
            timestamp = data.timestamp.toDate().toISOString();
          } else if (typeof data.timestamp === 'string') {
            timestamp = data.timestamp;
          } else if (data.timestamp.toDate) {
            timestamp = data.timestamp.toDate().toISOString();
          }
        }
        
        messages.push({
          id: doc.id,
          sender_id: data.sender_id || '',
          sender_name: data.sender_name || 'Unknown',
          sender_photo: data.sender_photo,
          text: data.text || data.content || '',
          content: data.content || data.text || '',
          created_at: createdAt || timestamp,
          timestamp: timestamp || createdAt,
        });
      });
      
      onMessagesUpdate(messages);
    },
    (error) => {
      console.error('Firestore listener error:', error);
      if (onError) {
        onError(error);
      }
    }
  );
  
  return unsubscribe;
}
