import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/theme';

const TabIcon = ({ name, color, focused }: { name: any; color: string; focused: boolean }) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
    <Ionicons name={name} size={22} color={color} />
  </View>
);

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 70,
          paddingBottom: 12,
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Community',
          headerTitle: 'Brahmand',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="people" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="temple"
        options={{
          title: 'Temple',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chatbubbles" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="vendor"
        options={{
          title: 'Vendor',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="storefront" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
      {/* Hide these screens from tab bar */}
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
