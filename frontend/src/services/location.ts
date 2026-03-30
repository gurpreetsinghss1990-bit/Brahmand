import * as Location from 'expo-location';
import { Platform } from 'react-native';

export async function ensureForegroundPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      // Check browser permissions if available
      try {
        // @ts-ignore navigator.permissions may not exist in some browsers
        const permStatus = await navigator.permissions?.query?.({ name: 'geolocation' } as any);
        if (permStatus && permStatus.state === 'denied') {
          return false;
        }
        // If prompt/granted or unavailable, we'll attempt to get location which will trigger browser prompt
        return true;
      } catch (e) {
        // If permissions API unavailable, proceed and let getCurrentPosition trigger the prompt
        return true;
      }
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.error('[location] permission check failed', e);
    return false;
  }
}

export async function getCurrentPosition(options?: any): Promise<{ coords: { latitude: number; longitude: number } }>{
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } }),
        (err) => reject(err),
        Object.assign({ enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }, options || {})
      );
    });
  }

  const loc = await Location.getCurrentPositionAsync(options || { accuracy: Location.Accuracy.Balanced });
  return { coords: { latitude: loc.coords.latitude, longitude: loc.coords.longitude } };
}

export default {
  ensureForegroundPermission,
  getCurrentPosition,
};
