import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use localhost for local dev without .env
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true', // Helps bypass localtunnel security warnings
  },
});

const adminApi = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  },
});

const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const RETRYABLE_STATUS_CODES = new Set([502, 503]);
const MAX_RETRY_ATTEMPTS = 1;

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Robust retry on 503 errors and network disconnections
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const method = (config?.method || 'get').toLowerCase();
    const status = error.response?.status;
    const shouldRetry =
      config &&
      RETRYABLE_METHODS.has(method) &&
      (RETRYABLE_STATUS_CODES.has(status) || error.code === 'ERR_NETWORK') &&
      (config._retryCount || 0) < MAX_RETRY_ATTEMPTS;

    if (shouldRetry) {
      config._retryCount = (config._retryCount || 0) + 1;
      console.warn(
        `[API] Retrying ${method.toUpperCase()} ${config.url}... Attempt ${config._retryCount}`
      );
      const delay = 1000 * config._retryCount;
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(config);
    }

    // If backend is temporarily unavailable, return a graceful fallback object.
    if (RETRYABLE_STATUS_CODES.has(status)) {
      console.warn('[API] Backend unavailable, returning fallback payload for 503/502');
      return Promise.resolve({
        data: null,
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        config: config,
      });
    }

    return Promise.reject(error);
  }
);

// Auth APIs
export const sendOTP = (phone: string) => 
  api.post('/auth/send-otp', { phone });

export const verifyOTP = (phone: string, otp: string) => 
  api.post('/auth/verify-otp', { phone, otp });

export const adminPanelLogin = (data: { username: string; password: string }) =>
  adminApi.post('/admin/auth/login', data);

export interface AdminVendorReview {
  vendor_id: string;
  business_name?: string;
  owner_name?: string;
  phone_number?: string;
  categories?: string[];
  full_address?: string;
  kyc_status?: string;
  review_status?: string;
  review_state?: string;
  aadhaar_otp_verified_at?: string;
  aadhar_url?: string | null;
  pan_url?: string | null;
  face_scan_url?: string | null;
  updated_at?: string;
}

export const getAdminVendorReviewQueue = (adminToken: string, status: string = 'pending') =>
  adminApi.get<AdminVendorReview[]>('/admin/vendors/review-queue', {
    params: { status },
    headers: { Authorization: `Bearer ${adminToken}` },
  });

export const adminApproveVendor = (adminToken: string, vendorId: string, note?: string) =>
  adminApi.post(
    `/admin/vendors/${vendorId}/approve`,
    { note },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

export const adminRejectVendor = (adminToken: string, vendorId: string, reason?: string) =>
  adminApi.post(
    `/admin/vendors/${vendorId}/reject`,
    { reason: reason || 'Denied by admin' },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

export const verifyFirebaseToken = (id_token: string) =>
  api.post('/auth/verify-firebase-token', { id_token });

export const register = (data: { phone: string; name: string; photo?: string; language: string }) => 
  api.post('/auth/register', data);

export const registerUser = (data: { phone: string; name: string; photo?: string | null; language: string }) => 
  api.post('/auth/register', data);

// User APIs
export const getProfile = () => 
  api.get('/user/profile');

export const getUserProfile = () => 
  api.get('/user/profile');

export const updateProfile = (data: { name?: string; photo?: string; language?: string }) => 
  api.put('/user/profile', data);

export const setupLocation = (location: { country: string; state: string; city: string; area: string }) => 
  api.post('/user/location', location);

export const setupDualLocation = (locations: { 
  home_location?: { country: string; state: string; city: string; area: string; latitude?: number; longitude?: number };
  office_location?: { country: string; state: string; city: string; area: string; latitude?: number; longitude?: number };
}) => 
  api.post('/user/dual-location', locations);

export const reverseGeocode = (latitude: number, longitude: number) => 
  api.post('/geocode/reverse', { latitude, longitude });

export const searchUserBySLId = (slId: string) => 
  api.get(`/user/search/${slId}`);

// Community APIs
export const getCommunities = () => 
  api.get('/communities');

export const getCommunity = (id: string) => 
  api.get(`/communities/${id}`);

export const joinCommunityByCode = (code: string) => 
  api.post('/communities/join', { code });

export const agreeToRules = (communityId: string, subgroupType: string) => 
  api.post(`/communities/${communityId}/agree-rules`, { subgroup_type: subgroupType });

// Circle APIs
export const createCircle = (data: { name: string; description?: string; privacy?: 'private' | 'invite_code' }) => 
  api.post('/circles', data);

export const getCircles = () => 
  api.get('/circles');

export const getCircle = (circleId: string) => 
  api.get(`/circles/${circleId}`);

export const updateCircle = (circleId: string, data: { name?: string; description?: string; privacy?: 'private' | 'invite_code' }) => 
  api.put(`/circles/${circleId}`, data);

export const joinCircle = (code: string) => 
  api.post('/circles/join', { code });

export const getCircleRequests = (circleId: string) => 
  api.get(`/circles/${circleId}/requests`);

export const approveCircleRequest = (circleId: string, userId: string) => 
  api.post(`/circles/${circleId}/approve/${userId}`);

export const rejectCircleRequest = (circleId: string, userId: string) => 
  api.post(`/circles/${circleId}/reject/${userId}`);

export const inviteToCircle = (circleId: string, slId: string) => 
  api.post(`/circles/${circleId}/invite`, { sl_id: slId });

export const leaveCircle = (circleId: string) => 
  api.post(`/circles/${circleId}/leave`);

export const deleteCircle = (circleId: string) => 
  api.delete(`/circles/${circleId}`);

export const removeCircleMember = (circleId: string, memberId: string) => 
  api.post(`/circles/${circleId}/remove-member/${memberId}`);

// Message APIs
export const sendCommunityMessage = (communityId: string, subgroupType: string, content: string, messageType: string = 'text') => 
  api.post(`/messages/community/${communityId}/${subgroupType}`, { content, message_type: messageType });

export const getCommunityMessages = (communityId: string, subgroupType: string, limit: number = 50) => 
  api.get(`/messages/community/${communityId}/${subgroupType}?limit=${limit}`);

export const sendCircleMessage = (circleId: string, content: string, messageType: string = 'text') => 
  api.post(`/messages/circle/${circleId}`, { content, message_type: messageType });

export const getCircleMessages = (circleId: string, limit: number = 50) => 
  api.get(`/messages/circle/${circleId}?limit=${limit}`);

// Direct Message APIs
export const sendDirectMessage = (recipientSlId: string, content: string, messageType: string = 'text') => 
  api.post('/dm', { recipient_sl_id: recipientSlId, content, message_type: messageType });

export const getConversations = () => 
  api.get('/dm/conversations');

export const getDirectMessages = (conversationId: string, limit: number = 50) => 
  api.get(`/dm/${conversationId}?limit=${limit}`);

// Discover APIs
export const discoverCommunities = () => 
  api.get('/discover/communities');

// Wisdom & Panchang APIs
export const getTodaysWisdom = () => 
  api.get('/wisdom/today');

export const getTodaysPanchang = () => 
  api.get('/panchang/today');

export const getProkeralaPanchang = (params?: {
  date_str?: string;
  lat?: number;
  lng?: number;
  endpoints?: string;
  force_refresh?: boolean;
}) => api.get('/panchang/prokerala', { params });

export const getProkeralaPanchangSummary = (params?: {
  date_str?: string;
  lat?: number;
  lng?: number;
  force_refresh?: boolean;
}) => api.get('/panchang/prokerala/summary', { params });

export const getProkeralaAstrology = (params?: {
  datetime_str?: string;
  lat?: number;
  lng?: number;
  ayanamsa?: number;
  la?: string;
  endpoints?: string;
  force_refresh?: boolean;
}) => api.get('/astrology/prokerala', { params });

export const getProkeralaAstrologySummary = (params?: {
  datetime_str?: string;
  lat?: number;
  lng?: number;
  ayanamsa?: number;
  la?: string;
  force_refresh?: boolean;
}) => api.get('/astrology/prokerala/summary', { params });

export const askProkeralaAstrology = (data: {
  question: string;
  astrology?: any;
  ayanamsa?: number;
  la?: string;
}) => api.post('/astrology/prokerala/ask', data);

// Temple APIs
export const getTemples = () => 
  api.get('/temples');

export const getNearbyTemples = (lat?: number, lng?: number) => 
  api.get(`/temples/nearby${lat && lng ? `?lat=${lat}&lng=${lng}` : ''}`);

export const getTemple = (templeId: string) => 
  api.get(`/temples/${templeId}`);

export const followTemple = (templeId: string) => 
  api.post(`/temples/${templeId}/follow`);

export const unfollowTemple = (templeId: string) => 
  api.post(`/temples/${templeId}/unfollow`);

export const getTemplePosts = (templeId: string) => 
  api.get(`/temples/${templeId}/posts`);

export const reactToTemplePost = (templeId: string, postId: string, reaction: string) => 
  api.post(`/temples/${templeId}/posts/${postId}/react`, { reaction });

// Event APIs
export const getEvents = () => 
  api.get('/events');

export const getNearbyEvents = () => 
  api.get('/events/nearby');

export const attendEvent = (eventId: string) => 
  api.post(`/events/${eventId}/attend`);

// Verification APIs
export const getVerificationStatus = () => 
  api.get('/user/verification-status');

export const requestVerification = (data: { full_name: string; id_type: string; id_number: string }) => 
  api.post('/user/request-verification', data);

// Profile APIs
export const updateExtendedProfile = (data: {
  kuldevi?: string;
  kuldevi_temple_area?: string;
  gotra?: string;
  date_of_birth?: string;
  place_of_birth?: string;
  time_of_birth?: string;
  place_of_birth_latitude?: number;
  place_of_birth_longitude?: number;
}) => 
  api.put('/user/profile/extended', data);

export const getProfileCompletion = () => 
  api.get('/user/profile-completion');

export const getHoroscope = () => 
  api.get('/user/horoscope');

// Community Stats
export const getCommunityStats = (communityId: string) => 
  api.get(`/communities/${communityId}/stats`);

// KYC APIs
export const getKYCStatus = () => 
  api.get('/kyc/status');

export const submitKYC = (data: { 
  kyc_role: 'temple' | 'vendor' | 'organizer';
  id_type: 'aadhaar' | 'pan';
  id_number: string;
  id_photo?: string;
  selfie_photo?: string;
}) => 
  api.post('/kyc/submit', data);

// Report APIs
export const reportContent = (data: {
  content_type: 'message' | 'user' | 'temple' | 'post';
  content_id: string;
  chat_id?: string;
  category: 'religious_attack' | 'disrespectful' | 'spam' | 'abuse' | 'other';
  description?: string;
}) => 
  api.post('/report', data);

// Temple Channel APIs
export const createTemple = (data: {
  name: string;
  location: { city?: string; area?: string; state?: string; country?: string };
  description?: string;
  deity?: string;
  aarti_timings?: { [key: string]: string };
}) => 
  api.post('/temples', data);

export const createTemplePost = (templeId: string, data: {
  title: string;
  content: string;
  post_type?: 'announcement' | 'event' | 'donation' | 'aarti';
}) => 
  api.post(`/temples/${templeId}/posts`, data);

// Mark messages as read
export const markMessagesRead = (chatId: string) => 
  api.post(`/dm/${chatId}/read`);

// =================== HELP REQUEST APIS ===================

export const createHelpRequest = (data: {
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
}) => api.post('/help-requests', data);

export const getHelpRequests = (params?: {
  type?: string;
  community_level?: string;
  status?: string;
  limit?: number;
}) => api.get('/help-requests', { params });

export const getMyHelpRequests = () => 
  api.get('/help-requests/my');

export const getActiveHelpRequest = () => 
  api.get('/help-requests/active');

export const fulfillHelpRequest = (requestId: string) => 
  api.post(`/help-requests/${requestId}/fulfill`);

export const verifyHelpRequest = (requestId: string) => 
  api.post(`/help-requests/${requestId}/verify`);

export const deleteHelpRequest = (requestId: string) => 
  api.delete(`/help-requests/${requestId}`);

// =================== COMMUNITY REQUESTS APIS ===================

export const createCommunityRequest = (data: {
  community_id?: string;
  request_type: 'help' | 'blood' | 'medical' | 'financial' | 'petition';
  visibility_level?: 'area' | 'city' | 'state' | 'national';
  title: string;
  description: string;
  contact_number: string;
  urgency_level?: 'low' | 'medium' | 'high' | 'critical';
  blood_group?: string;
  hospital_name?: string;
  location?: string;
  amount?: number;
  contact_person_name?: string;
  support_needed?: string;
  attachments?: string[];
}) => api.post('/community-requests', data);

export const getCommunityRequests = (params?: {
  type?: string;
  community_id?: string;
  visibility_level?: string;
  status?: string;
  limit?: number;
}) => api.get('/community-requests', { params });

export const getMyCommunityRequests = () => 
  api.get('/community-requests/my');

export const resolveCommunityRequest = (requestId: string) => 
  api.post(`/community-requests/${requestId}/resolve`);

export const deleteCommunityRequest = (requestId: string) => 
  api.delete(`/community-requests/${requestId}`);

// =================== VENDOR APIS ===================

export const createVendor = (data: {
  business_name: string;
  owner_name: string;
  years_in_business: number;
  categories: string[];
  full_address: string;
  location_link?: string;
  phone_number: string;
  latitude?: number;
  longitude?: number;
  photos?: string[];
  business_description?: string;
  aadhar_url?: string | null;
  pan_url?: string | null;
  face_scan_url?: string | null;
  business_gallery_images?: string[];
  menu_items?: string[];
  offers_home_delivery?: boolean;
  business_media_key?: string | null;
}) => api.post('/vendors', data);

export const getVendors = (params?: {
  category?: string;
  search?: string;
  lat?: number;
  lng?: number;
  limit?: number;
}) => api.get('/vendors', { params });

export const getMyVendor = () => 
  api.get('/vendors/my');

export const getVendorCategories = () => 
  api.get('/vendors/categories');

export const getVendor = (vendorId: string) => 
  api.get(`/vendors/${vendorId}`);

export const updateVendor = (vendorId: string, data: {
  business_name?: string;
  owner_name?: string;
  years_in_business?: number;
  categories?: string[];
  full_address?: string;
  location_link?: string;
  phone_number?: string;
  latitude?: number;
  longitude?: number;
  photos?: string[];
  business_description?: string;
  aadhar_url?: string | null;
  pan_url?: string | null;
  face_scan_url?: string | null;
  business_gallery_images?: string[];
  menu_items?: string[];
  offers_home_delivery?: boolean;
  business_media_key?: string | null;
  kyc_status?: 'pending' | 'manual_review' | 'verified' | 'rejected';
}) => api.put(`/vendors/${vendorId}`, data);

export const updateVendorBusinessProfile = (
  vendorId: string,
  data: { menu_items?: string[]; offers_home_delivery?: boolean }
) => api.put(`/vendors/${vendorId}/business/profile`, data);

export const uploadVendorBusinessImage = (
  vendorId: string,
  slot: number,
  file: { uri: string; name: string; type: string }
) => {
  const formData = new FormData();
  formData.append('slot', String(slot));
  formData.append('file', file as any);

  return api.post(`/vendors/${vendorId}/business/images/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadVendorKycFile = (
  vendorId: string,
  docType: 'aadhaar' | 'pan' | 'face_scan',
  file: { uri: string; name: string; type: string }
) => {
  const formData = new FormData();
  formData.append('doc_type', docType);
  formData.append('file', file as any);

  return api.post(`/vendors/${vendorId}/kyc/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const extractKycTextFromImage = (vendorId: string, file: { uri: string; name: string; type: string }) => {
  const formData = new FormData();
  formData.append('file', file as any);
  return api.post(`/vendors/${vendorId}/kyc/vision-extract`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const generateVendorAadhaarOtp = (vendorId: string, data: {
  aadhaar_number: string;
  consent: 'Y' | 'y';
  reason: string;
}) => api.post(`/vendors/${vendorId}/kyc/aadhaar/otp`, data);

export const verifyVendorAadhaarOtp = (vendorId: string, data: {
  reference_id: string;
  otp: string;
}) => api.post(`/vendors/${vendorId}/kyc/aadhaar/otp/verify`, data);

export const addVendorPhoto = (vendorId: string, photo: string) => 
  api.post(`/vendors/${vendorId}/photos`, photo, {
    headers: { 'Content-Type': 'application/json' }
  });

export const deleteVendor = (vendorId: string) => 
  api.delete(`/vendors/${vendorId}`);

// =================== CULTURAL COMMUNITY APIS ===================

export const getCulturalCommunities = (search?: string) => 
  api.get('/cultural-communities', { params: { search } });

export const getUserCulturalCommunity = () => 
  api.get('/user/cultural-community');

export const updateUserCulturalCommunity = (cultural_community: string) => 
  api.put('/user/cultural-community', { cultural_community });

// =================== UTILITY APIS ===================

export const getWisdom = () => 
  api.get('/wisdom/today');

export const getPanchang = () => 
  api.get('/panchang/today');

// =================== SOS EMERGENCY APIS ===================

export const createSOSAlert = (data: {
  latitude: number;
  longitude: number;
  area?: string;
  city?: string;
  state?: string;
}) => api.post('/sos', data);

export const getActiveSOSAlerts = (params?: {
  lat?: number;
  lng?: number;
  radius?: number;
}) => api.get('/sos/nearby', { params });

export const getMySOSAlert = () => 
  api.get('/sos/my');

export const resolveSOSAlert = (sosId: string, status: 'resolved' | 'cancelled') => 
  api.post(`/sos/${sosId}/resolve`, { status });

export const respondToSOS = (sosId: string, response: 'coming' | 'called') => 
  api.post(`/sos/${sosId}/respond`, { response });

export default api;
