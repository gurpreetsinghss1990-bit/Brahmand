import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/theme';

const TabIcon = ({ name, color, focused }: { name: any; color: string; focused: boolean }) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
    <Ionicons name={name} size={22} color={color} />
  </View>
);

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom; // use real inset so tab sits flush with system nav

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 58 + insets.bottom,
          paddingBottom: bottomInset,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: COLORS.surface,
        },
        headerTitleStyle: {
          color: COLORS.text,
          fontWeight: '600',
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      {/* 1. Photo/Video Feed - First Position */}
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          headerTitle: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="play-circle" color={color} focused={focused} />
          ),
        }}
      />
      
      {/* 2. Vendor */}
      <Tabs.Screen
        name="vendor"
        options={{
          title: 'Vendor',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="storefront" color={color} focused={focused} />
          ),
        }}
      />
      
      {/* 3. Chat (contains Community & Private Chat tabs) */}
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Chat',
          headerTitle: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chatbubbles" color={color} focused={focused} />
          ),
        }}
      />
      
      {/* 4. Temple */}
      <Tabs.Screen
        name="temple"
        options={{
          title: 'Temple',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      
      {/* 5. Settings/Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="settings" color={color} focused={focused} />
          ),
        }}
      />
      
      {/* Hide these screens from tab bar */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="circles" options={{ href: null }} />
      <Tabs.Screen name="discover" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 42,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: `${COLORS.primary}15`,
  },
});
