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

export default api;
