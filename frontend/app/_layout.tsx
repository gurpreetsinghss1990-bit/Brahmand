import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { COLORS } from '../src/constants/theme';

export default function RootLayout() {
  const { isLoading, loadStoredAuth } = useAuthStore();

  useEffect(() => {
    loadStoredAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/phone" />
        <Stack.Screen name="auth/otp" />
        <Stack.Screen name="auth/profile" />
        <Stack.Screen name="auth/location" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="community/[id]" />
        <Stack.Screen name="chat/[type]/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="dm/[conversationId]" options={{ presentation: 'card' }} />
        <Stack.Screen name="dm/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="circle/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="circle/join" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
