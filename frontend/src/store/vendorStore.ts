import { create } from 'zustand';
import { 
  createVendor as createVendorAPI,
  getVendors,
  getMyVendor,
  getVendor,
  updateVendor,
  updateVendorBusinessProfile,
  uploadVendorBusinessImage,
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
  business_description?: string;
  business_gallery_images?: string[];
  menu_items?: string[];
  offers_home_delivery?: boolean;
  offers_cash_on_delivery?: boolean;
  business_hours?: string;
  notes?: string;
  offers?: string;
  website_link?: string;
  social_media?: {
    facebook?: string;
    instagram?: string;
    whatsapp?: string;
  };
  business_media_key?: string | null;
  aadhar_url?: string | null;
  pan_url?: string | null;
  face_scan_url?: string | null;
  kyc_status?: 'pending' | 'manual_review' | 'verified' | 'rejected';
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
    businessName: string;
    ownerName: string;
    yearsInBusiness: number;
    categories: string[];
    address: string;
    locationLink?: string;
    phoneNumber: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<Vendor>;
  
  updateVendor: (vendorId: string, data: Partial<Vendor>) => Promise<void>;
  updateBusinessProfile: (vendorId: string, data: {
    menu_items?: string[];
    offers_home_delivery?: boolean;
    offers_cash_on_delivery?: boolean;
    business_hours?: string;
    notes?: string;
    offers?: string;
    website_link?: string;
    social_media?: {
      facebook?: string;
      instagram?: string;
      whatsapp?: string;
    };
  }) => Promise<void>;
  uploadBusinessImage: (vendorId: string, slot: number, file: { uri: string; name: string; type: string }) => Promise<string[]>;
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
      set({ vendors: response?.data || [] });
    } catch (error: any) {
      if (error?.response?.status !== 404 && error?.response?.status !== 503) {
        console.warn('Error fetching vendors:', error?.message || error);
      }
      set({ vendors: [] });
    } finally {
      set({ loading: false });
    }
  },
  
  fetchMyVendor: async () => {
    try {
      const response = await getMyVendor();
      set({ myVendor: response?.data || null });
    } catch (error: any) {
      if (error?.response?.status !== 404 && error?.response?.status !== 503) {
        console.warn('Error fetching my vendor:', error?.message || error);
      }
      set({ myVendor: null });
    }
  },
  
  fetchVendor: async (vendorId: string) => {
    try {
      const response = await getVendor(vendorId);
      return response?.data || null;
    } catch (error: any) {
      if (error?.response?.status !== 404 && error?.response?.status !== 503) {
        console.warn(`Error fetching vendor ${vendorId}:`, error?.message || error);
      }
      return null;
    }
  },
  
  fetchCategories: async () => {
    try {
      const response = await getVendorCategories();
      const categories = response?.data || [];
      // Merge with defaults and deduplicate
      const merged = [...new Set([...categories, ...DEFAULT_CATEGORIES])].sort();
      set({ categories: merged });
    } catch (error: any) {
      if (error?.response?.status !== 503) {
        console.warn('Error fetching categories:', error?.message || error);
      }
      set({ categories: DEFAULT_CATEGORIES });
    }
  },
  
  createVendor: async (data: {
    businessName: string;
    ownerName: string;
    yearsInBusiness: number;
    categories: string[];
    address: string;
    locationLink?: string;
    phoneNumber: string;
    latitude?: number;
    longitude?: number;
  }) => {
    try {
      // Transform camelCase to snake_case for backend
      const transformedData = {
        business_name: data.businessName,
        owner_name: data.ownerName,
        years_in_business: data.yearsInBusiness,
        categories: data.categories,
        full_address: data.address,
        location_link: data.locationLink,
        phone_number: data.phoneNumber,
        latitude: data.latitude,
        longitude: data.longitude,
      };
      const response = await createVendorAPI(transformedData);
      const newVendor = response.data;
      set({ myVendor: newVendor });
      return newVendor;
    } catch (error: any) {
      console.error('createVendor failed:', error?.response?.data || error?.message || error);
      throw error;
    }
  },
  
  updateVendor: async (vendorId, data) => {
    set((state) => {
      if (!state.myVendor || state.myVendor.id !== vendorId) {
        return state;
      }
      return {
        myVendor: {
          ...state.myVendor,
          ...data,
        },
      };
    });
    await updateVendor(vendorId, data);
    // Refresh my vendor
    await get().fetchMyVendor();
  },

  updateBusinessProfile: async (vendorId, data) => {
    await updateVendorBusinessProfile(vendorId, data);
    await get().fetchMyVendor();
  },

  uploadBusinessImage: async (vendorId, slot, file) => {
    const response = await uploadVendorBusinessImage(vendorId, slot, file);
    const images = response?.data?.images || [];
    set((state) => {
      if (!state.myVendor || state.myVendor.id !== vendorId) {
        return state;
      }
      return {
        myVendor: {
          ...state.myVendor,
          business_gallery_images: images,
        },
      };
    });
    return images;
  },
  
  deleteVendor: async (vendorId) => {
    await deleteVendorAPI(vendorId);
    set({ myVendor: null });
  },
  
  getFilteredVendors: (category, searchTerm) => {
    let filtered = get().vendors || [];

    // Filter by category
    if (category && category !== 'Nearby') {
      const lowerCategory = category.toLowerCase();
      filtered = filtered.filter((v) => {
        const categories = v.categories || [];
        return categories.some((c) => (c || '').toLowerCase().includes(lowerCategory));
      });
    }

    // Filter by search term
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((v) => {
        const name = (v.business_name || '').toLowerCase();
        const address = (v.full_address || '').toLowerCase();
        const categories = v.categories || [];
        const categoryMatch = categories.some((c) => (c || '').toLowerCase().includes(term));

        return (
          name.includes(term) ||
          address.includes(term) ||
          categoryMatch
        );
      });
    }

    // Sort by distance
    return filtered.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
  },
}));

// Legacy exports for backwards compatibility
export const VENDOR_CATEGORIES = DEFAULT_CATEGORIES;
