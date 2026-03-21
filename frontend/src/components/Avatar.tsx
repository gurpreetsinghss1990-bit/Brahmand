import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS, BORDER_RADIUS } from '../constants/theme';

interface AvatarProps {
  name: string;
  photo?: string;
  size?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ name, photo, size = 48 }) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (photo) {
    return (
      <Image
        source={{ uri: photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}` }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: COLORS.border,
  },
  placeholder: {
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: COLORS.textWhite,
    fontWeight: 'bold',
  },
});
