import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sift.app',
  appName: 'Sift',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    url: 'https://sift-search.vercel.app',
    cleartext: false,
    iosScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#000000",
      showSpinner: false
    }
  }
};

export default config;
