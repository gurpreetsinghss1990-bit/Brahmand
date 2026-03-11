import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const sendOTP = (phone: string) => 
  api.post('/auth/send-otp', { phone });

export const verifyOTP = (phone: string, otp: string) => 
  api.post('/auth/verify-otp', { phone, otp });

export const register = (data: { phone: string; name: string; photo?: string; language: string }) => 
  api.post('/auth/register', data);

// User APIs
export const getProfile = () => 
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
export const createCircle = (name: string) => 
  api.post('/circles', { name });

export const getCircles = () => 
  api.get('/circles');

export const joinCircle = (code: string) => 
  api.post('/circles/join', { code });

export const getCircleRequests = (circleId: string) => 
  api.get(`/circles/${circleId}/requests`);

export const approveCircleRequest = (circleId: string, userId: string) => 
  api.post(`/circles/${circleId}/approve`, { user_id: userId });

export const inviteToCircle = (circleId: string, slId: string) => 
  api.post(`/circles/${circleId}/invite`, { circle_id: circleId, sl_id: slId });

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

export default api;
