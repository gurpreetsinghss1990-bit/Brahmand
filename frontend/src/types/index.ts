export interface User {
  id: string;
  sl_id: string;
  name: string;
  photo?: string;
  language: string;
  location?: Location;
  badges: string[];
  reputation: number;
  communities: string[];
  circles: string[];
  created_at: string;
}

export interface Location {
  country: string;
  state: string;
  city: string;
  area: string;
}

export interface Community {
  id: string;
  name: string;
  type: string;
  code: string;
  member_count: number;
  subgroups: Subgroup[];
}

export interface Subgroup {
  name: string;
  type: string;
  rules: string;
}

export interface Circle {
  id: string;
  name: string;
  code: string;
  admin_id: string;
  member_count: number;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_photo?: string;
  content: string;
  message_type: string;
  created_at: string;
}

export interface Conversation {
  conversation_id: string;
  chat_id?: string;
  user: {
    id: string;
    sl_id: string;
    name: string;
    photo?: string;
  };
  last_message: string;
  last_message_at: string;
  created_at?: string;
}
