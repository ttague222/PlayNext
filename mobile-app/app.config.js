export default {
  expo: {
    name: "PlayNxt",
    slug: "playnxt",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "playnxt",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#1a1a2e"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.playnxt.app",
      buildNumber: "1",
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      },
      config: {
        googleSignIn: {
          reservedClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
        }
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#1a1a2e"
      },
      package: "com.playnxt.app",
      versionCode: 1,
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "playnxt",
              host: "*",
              pathPrefix: "/oauth"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    web: {
      bundler: "metro",
      favicon: "./assets/images/favicon.png"
    },
    updates: {
      url: "https://u.expo.dev/268e6152-b422-47f9-b6c3-2b6811100ba6"
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    plugins: [
      "expo-asset",
      "expo-font",
      "expo-web-browser",
      "@sentry/react-native/expo"
    ],
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000/api",
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      rawgApiKey: process.env.EXPO_PUBLIC_RAWG_API_KEY,
      // Google OAuth Client IDs
      googleExpoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      eas: {
        projectId: "268e6152-b422-47f9-b6c3-2b6811100ba6"
      }
    }
  }
};
