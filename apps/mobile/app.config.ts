import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Lyfestack',
  slug: 'lyfestack',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'lyfestack',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#000000',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.innovsoftinc.lyfestack',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    package: 'com.innovsoftinc.lyfestack',
  },
  plugins: ['expo-router', 'expo-font'],
  newArchEnabled: true,
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000',
    eas: {
      projectId: process.env['EXPO_PUBLIC_PROJECT_ID'] ?? undefined,
    },
  },
};

export default config;
