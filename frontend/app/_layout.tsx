import React, { useEffect } from 'react';
import { Slot, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { COLORS } from '../src/constants/theme';
import { FloatingUtilityButton } from '../src/components/FloatingUtilityButton';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { useAdminStore } from '../src/store/adminStore';

// Safe Slot wrapper to isolate navigation errors
function SafeSlot() {
  return (
    <ErrorBoundary fallback={
      <View style={styles.fallbackContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    }>
      <SlotWrapper />
    </ErrorBoundary>
  );
}

function SlotWrapper() {
  try {
    return <Slot />;
  } catch (error) {
    console.warn('Slot rendering crashed, showing fallback.', error);
    return (
      <View style={styles.fallbackContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
}

export default function RootLayout() {
  const pathname = usePathname();
  const { isLoading, loadStoredAuth, token } = useAuthStore();
  const { loadStoredAdminAuth } = useAdminStore();

  useEffect(() => {
    Promise.allSettled([loadStoredAuth(), loadStoredAdminAuth()]).then((results) => {
      const authErr = results[0].status === 'rejected' ? results[0].reason : null;
      const adminErr = results[1].status === 'rejected' ? results[1].reason : null;
      if (authErr) {
        console.warn('Failed to load stored auth:', authErr?.message || authErr);
      }
      if (adminErr) {
        console.warn('Failed to load stored admin auth:', adminErr?.message || adminErr);
      }
    });
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <SafeSlot />
        {/* Global Floating Button - only show when logged in */}
        {token && !pathname.startsWith('/admin') && <FloatingUtilityButton />}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
