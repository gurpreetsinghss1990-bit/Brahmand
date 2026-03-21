import { create } from 'zustand';
import { 
  createHelpRequest as createHelpRequestAPI,
  getActiveHelpRequest,
  fulfillHelpRequest,
  getHelpRequests,
  getMyHelpRequests
} from '../services/api';

export interface HelpRequest {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_photo?: string;
  type: 'blood' | 'medical' | 'financial' | 'food' | 'other';
  title: string;
  description: string;
  community_level: 'area' | 'city' | 'state' | 'country';
  location?: string;
  contact_number: string;
  urgency: 'normal' | 'urgent' | 'critical';
  status: 'active' | 'fulfilled';
  blood_group?: string;
  hospital_name?: string;
  amount?: number;
  verifications: number;
  verified_by: string[];
  created_at: string;
}

interface HelpRequestStore {
  activeRequest: HelpRequest | null;
  allRequests: HelpRequest[];
  myRequests: HelpRequest[];
  loading: boolean;
  
  // Actions
  fetchActiveRequest: () => Promise<void>;
  fetchAllRequests: (type?: string, communityLevel?: string) => Promise<void>;
  fetchMyRequests: () => Promise<void>;
  createRequest: (data: {
    type: 'blood' | 'medical' | 'financial' | 'food' | 'other';
    title: string;
    description: string;
    community_level?: 'area' | 'city' | 'state' | 'country';
    location?: string;
    contact_number: string;
    urgency?: 'normal' | 'urgent' | 'critical';
    blood_group?: string;
    hospital_name?: string;
    amount?: number;
  }) => Promise<HelpRequest>;
  resolveRequest: () => Promise<void>;
  hasActiveRequest: () => boolean;
}

export const useHelpRequestStore = create<HelpRequestStore>((set, get) => ({
  activeRequest: null,
  allRequests: [],
  myRequests: [],
  loading: false,
  
  fetchActiveRequest: async () => {
    try {
      const response = await getActiveHelpRequest();
      set({ activeRequest: response.data });
    } catch (error) {
      console.error('Error fetching active request:', error);
      set({ activeRequest: null });
    }
  },
  
  fetchAllRequests: async (type?: string, communityLevel?: string) => {
    set({ loading: true });
    try {
      const response = await getHelpRequests({ type, community_level: communityLevel });
      set({ allRequests: response.data || [] });
    } catch (error) {
      console.error('Error fetching help requests:', error);
      set({ allRequests: [] });
    } finally {
      set({ loading: false });
    }
  },
  
  fetchMyRequests: async () => {
    try {
      const response = await getMyHelpRequests();
      set({ myRequests: response.data || [] });
    } catch (error) {
      console.error('Error fetching my requests:', error);
      set({ myRequests: [] });
    }
  },
  
  createRequest: async (data) => {
    const response = await createHelpRequestAPI(data);
    const newRequest = response.data;
    set({ activeRequest: newRequest });
    return newRequest;
  },
  
  resolveRequest: async () => {
    const { activeRequest } = get();
    if (!activeRequest) return;
    
    try {
      await fulfillHelpRequest(activeRequest.id);
      set({ activeRequest: null });
    } catch (error) {
      console.error('Error resolving request:', error);
      throw error;
    }
  },
  
  hasActiveRequest: () => {
    const { activeRequest } = get();
    return activeRequest !== null && activeRequest.status === 'active';
  },
}));

// Legacy export for backwards compatibility
export const loadFromStorage = async () => {
  await useHelpRequestStore.getState().fetchActiveRequest();
};
