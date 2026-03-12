import { create } from 'zustand';
import { 
  createVendor as createVendorAPI,
  getVendors,
  getMyVendor,
  getVendor,
  updateVendor,
  getVendorCategories,
  deleteVendor as deleteVendorAPI
} from '../services/api';

export interface Vendor {
  id: string;
  owner_id: string;
  business_name: string;
  owner_name: string;
  years_in_business: number;
  categories: string[];
  full_address: string;
  location_link?: string;
  phone_number: string;
  latitude?: number;
  longitude?: number;
  photos: string[];
  distance?: number;
  created_at: string;
}

// Default categories to show when no backend data
export const DEFAULT_CATEGORIES = [
  'Gym', 'Yoga', 'Pooja Samagri', 'Restaurant', 'Catering',
  'Pandit', 'Decoration', 'Flowers', 'Grocery', 'Sweets',
  'Clothing', 'Jewellery', 'Electronics', 'Pharmacy', 'Salon',
  'Photography', 'Event Planning', 'Transport', 'Astrology', 'Vastu',
  'Music Classes', 'Dance Classes', 'Tutoring', 'Meditation', 'Ayurveda',
  'Swimming Coach', 'Gym Trainer', 'Temple Decorator', 'Pandit Services', 'Yoga Trainer'
];

interface VendorStore {
  vendors: Vendor[];
  myVendor: Vendor | null;
  categories: string[];
  loading: boolean;
  
  // Actions
  fetchVendors: (params?: { category?: string; search?: string; lat?: number; lng?: number }) => Promise<void>;
  fetchMyVendor: () => Promise<void>;
  fetchVendor: (vendorId: string) => Promise<Vendor | null>;
  fetchCategories: () => Promise<void>;
  createVendor: (data: {
    business_name: string;
    owner_name: string;
    years_in_business: number;
    categories: string[];
    full_address: string;
    location_link?: string;
    phone_number: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<Vendor>;
  updateVendor: (vendorId: string, data: Partial<Vendor>) => Promise<void>;
  deleteVendor: (vendorId: string) => Promise<void>;
  getFilteredVendors: (category?: string, searchTerm?: string) => Vendor[];
}

export const useVendorStore = create<VendorStore>((set, get) => ({
  vendors: [],
  myVendor: null,
  categories: DEFAULT_CATEGORIES,
  loading: false,
  
  fetchVendors: async (params) => {
    set({ loading: true });
    try {
      const response = await getVendors(params);
      set({ vendors: response.data || [] });
    } catch (error) {
      console.error('Error fetching vendors:', error);
      set({ vendors: [] });
    } finally {
      set({ loading: false });
    }
  },
  
  fetchMyVendor: async () => {
    try {
      const response = await getMyVendor();
      set({ myVendor: response.data });
    } catch (error) {
      console.error('Error fetching my vendor:', error);
      set({ myVendor: null });
    }
  },
  
  fetchVendor: async (vendorId: string) => {
    try {
      const response = await getVendor(vendorId);
      return response.data;
    } catch (error) {
      console.error('Error fetching vendor:', error);
      return null;
    }
  },
  
  fetchCategories: async () => {
    try {
      const response = await getVendorCategories();
      const categories = response.data || [];
      // Merge with defaults and deduplicate
      const merged = [...new Set([...categories, ...DEFAULT_CATEGORIES])].sort();
      set({ categories: merged });
    } catch (error) {
      console.error('Error fetching categories:', error);
      set({ categories: DEFAULT_CATEGORIES });
    }
  },
  
  createVendor: async (data) => {
    const response = await createVendorAPI(data);
    const newVendor = response.data;
    set({ myVendor: newVendor });
    return newVendor;
  },
  
  updateVendor: async (vendorId, data) => {
    await updateVendor(vendorId, data);
    // Refresh my vendor
    await get().fetchMyVendor();
  },
  
  deleteVendor: async (vendorId) => {
    await deleteVendorAPI(vendorId);
    set({ myVendor: null });
  },
  
  getFilteredVendors: (category, searchTerm) => {
    let filtered = get().vendors;
    
    // Filter by category
    if (category && category !== 'Nearby') {
      filtered = filtered.filter(v => v.categories.some(c => 
        c.toLowerCase().includes(category.toLowerCase())
      ));
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.business_name.toLowerCase().includes(term) ||
        v.categories.some(c => c.toLowerCase().includes(term))
      );
    }
    
    // Sort by distance
    return filtered.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
  },
}));

// Legacy exports for backwards compatibility
export const VENDOR_CATEGORIES = DEFAULT_CATEGORIES;
