import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Vendor {
  id: string;
  businessName: string;
  ownerName: string;
  phoneNumber: string;
  yearsInBusiness: number;
  categories: string[];
  address: string;
  locationLink?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  coverPhoto?: string;
  galleryPhotos: string[];
  openingHours?: string;
  offers?: string;
  trustLabel: 'trusted' | 'frequent' | 'verified_local';
  ownerId: string;
  createdAt: string;
}

export const VENDOR_CATEGORIES = [
  'Gym', 'Yoga', 'Pooja Samagri', 'Restaurant', 'Catering',
  'Pandit', 'Decoration', 'Flowers', 'Grocery', 'Sweets',
  'Clothing', 'Jewellery', 'Electronics', 'Pharmacy', 'Salon',
  'Photography', 'Event Planning', 'Transport', 'Astrology', 'Vastu',
  'Music Classes', 'Dance Classes', 'Tutoring', 'Meditation', 'Ayurveda'
];

interface VendorStore {
  vendors: Vendor[];
  myVendor: Vendor | null;
  setVendors: (vendors: Vendor[]) => void;
  addVendor: (vendor: Vendor) => void;
  setMyVendor: (vendor: Vendor | null) => void;
  updateMyVendor: (updates: Partial<Vendor>) => void;
  loadFromStorage: () => Promise<void>;
  getFilteredVendors: (category?: string, searchTerm?: string, userId?: string) => Vendor[];
}

export const useVendorStore = create<VendorStore>((set, get) => ({
  vendors: [
    {
      id: '1',
      businessName: 'Sharma Pooja Samagri',
      ownerName: 'Ramesh Sharma',
      phoneNumber: '9876543210',
      yearsInBusiness: 15,
      categories: ['Pooja Samagri', 'Flowers'],
      address: 'Shop 12, Market Road, Borivali West, Mumbai 400092',
      distance: 0.5,
      trustLabel: 'trusted',
      galleryPhotos: [],
      ownerId: 'vendor1',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      businessName: 'Krishna Grocery Store',
      ownerName: 'Krishna Patel',
      phoneNumber: '9876543211',
      yearsInBusiness: 8,
      categories: ['Grocery', 'Sweets'],
      address: 'Near Station, Kandivali East, Mumbai 400101',
      distance: 1.2,
      trustLabel: 'frequent',
      galleryPhotos: [],
      ownerId: 'vendor2',
      createdAt: new Date().toISOString(),
    },
    {
      id: '3',
      businessName: 'Annapurna Restaurant',
      ownerName: 'Suresh Gupta',
      phoneNumber: '9876543212',
      yearsInBusiness: 12,
      categories: ['Restaurant', 'Catering'],
      address: 'Main Road, Malad West, Mumbai 400064',
      distance: 2.0,
      trustLabel: 'verified_local',
      galleryPhotos: [],
      ownerId: 'vendor3',
      createdAt: new Date().toISOString(),
    },
  ],
  myVendor: null,
  
  setVendors: (vendors) => set({ vendors }),
  
  addVendor: async (vendor) => {
    set((state) => ({ vendors: [vendor, ...state.vendors] }));
    await AsyncStorage.setItem('vendors', JSON.stringify(get().vendors));
  },
  
  setMyVendor: async (vendor) => {
    set({ myVendor: vendor });
    if (vendor) {
      await AsyncStorage.setItem('my_vendor', JSON.stringify(vendor));
    } else {
      await AsyncStorage.removeItem('my_vendor');
    }
  },
  
  updateMyVendor: async (updates) => {
    const current = get().myVendor;
    if (current) {
      const updated = { ...current, ...updates };
      set({ myVendor: updated });
      await AsyncStorage.setItem('my_vendor', JSON.stringify(updated));
      // Also update in vendors list
      set((state) => ({
        vendors: state.vendors.map(v => v.id === updated.id ? updated : v)
      }));
    }
  },
  
  loadFromStorage: async () => {
    try {
      const myVendorStr = await AsyncStorage.getItem('my_vendor');
      if (myVendorStr) {
        set({ myVendor: JSON.parse(myVendorStr) });
      }
    } catch (error) {
      console.error('Error loading vendor data:', error);
    }
  },
  
  getFilteredVendors: (category, searchTerm, userId) => {
    let filtered = get().vendors;
    
    // Filter out user's own vendor
    if (userId) {
      filtered = filtered.filter(v => v.ownerId !== userId);
    }
    
    // Filter by category
    if (category && category !== 'Nearby') {
      filtered = filtered.filter(v => v.categories.includes(category));
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.businessName.toLowerCase().includes(term) ||
        v.categories.some(c => c.toLowerCase().includes(term))
      );
    }
    
    // Sort by distance
    return filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  },
}));
