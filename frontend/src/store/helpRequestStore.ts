import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HelpRequest {
  id: string;
  type: 'blood' | 'medical' | 'financial' | 'other';
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'urgent';
  contactNumber: string;
  visibility: 'area' | 'city' | 'state' | 'national';
  createdAt: string;
  status: 'active' | 'resolved';
  verifications: number;
  verifiedBy: string[];
}

interface HelpRequestStore {
  activeRequest: HelpRequest | null;
  setActiveRequest: (request: HelpRequest | null) => void;
  resolveRequest: () => void;
  hasActiveRequest: () => boolean;
  loadFromStorage: () => Promise<void>;
}

export const useHelpRequestStore = create<HelpRequestStore>((set, get) => ({
  activeRequest: null,
  
  setActiveRequest: async (request) => {
    set({ activeRequest: request });
    if (request) {
      await AsyncStorage.setItem('active_help_request', JSON.stringify(request));
    } else {
      await AsyncStorage.removeItem('active_help_request');
    }
  },
  
  resolveRequest: async () => {
    set({ activeRequest: null });
    await AsyncStorage.removeItem('active_help_request');
  },
  
  hasActiveRequest: () => {
    return get().activeRequest !== null && get().activeRequest?.status === 'active';
  },
  
  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem('active_help_request');
      if (stored) {
        const request = JSON.parse(stored);
        if (request.status === 'active') {
          set({ activeRequest: request });
        }
      }
    } catch (error) {
      console.error('Error loading help request:', error);
    }
  },
}));
