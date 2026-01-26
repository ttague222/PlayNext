export default {
  expo: {
    name: "PlayNxt",
    slug: "playnxt",
    version: "1.0.6",
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
      buildNumber: "10",
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSUserTrackingUsageDescription: "PlayNxt shows non-personalized ads. This permission helps measure ad effectiveness without tracking you personally.",
        SKAdNetworkItems: [
          { SKAdNetworkIdentifier: "cstr6suwn9.skadnetwork" },
          { SKAdNetworkIdentifier: "4fzdc2evr5.skadnetwork" },
          { SKAdNetworkIdentifier: "2fnua5tdw4.skadnetwork" },
          { SKAdNetworkIdentifier: "ydx93a7ass.skadnetwork" },
          { SKAdNetworkIdentifier: "5a6flpkh64.skadnetwork" },
          { SKAdNetworkIdentifier: "p78axxw29g.skadnetwork" },
          { SKAdNetworkIdentifier: "v72qych5uu.skadnetwork" },
          { SKAdNetworkIdentifier: "c6k4g5qg8m.skadnetwork" },
          { SKAdNetworkIdentifier: "s39g8k73mm.skadnetwork" },
          { SKAdNetworkIdentifier: "3qy4746246.skadnetwork" },
        ],
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              "com.googleusercontent.apps.167253232570-ce0s30bsda1gof40cvnh9n30ot38qpui"
            ]
          }
        ]
      },
      config: {
        googleSignIn: {
          reservedClientId: "com.googleusercontent.apps.167253232570-ce0s30bsda1gof40cvnh9n30ot38qpui"
        }
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#1a1a2e"
      },
      package: "com.playnxt.app",
      versionCode: 11,
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
      "expo-updates",
      "expo-tracking-transparency",
      "expo-apple-authentication",
      [
        "expo-build-properties",
        {
          android: {
            extraProguardRules: "-keep class com.android.vending.billing.**"
          },
          ios: {
            deploymentTarget: "15.1"
          }
        }
      ],
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
          iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
          userTrackingUsageDescription: "PlayNxt shows non-personalized ads. This permission helps measure ad effectiveness without tracking you personally."
        }
      ]
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
      // AdMob Rewarded Ad Unit IDs
      admobRewardedAdUnitIdAndroid: process.env.EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID_ANDROID || "ca-app-pub-3940256099942544/5224354917",
      admobRewardedAdUnitIdIos: process.env.EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID_IOS || "ca-app-pub-3940256099942544/1712485313",
      // Feature toggle for rewarded ads (set to "false" to disable ads, premium-only mode)
      enableRewardedAds: process.env.EXPO_PUBLIC_ENABLE_REWARDED_ADS !== "false",
      // Remote config URL for dynamic feature control (ad toggling during App Store review)
      remoteConfigUrl: process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL,
      eas: {
        projectId: "268e6152-b422-47f9-b6c3-2b6811100ba6"
      }
    }
  }
};
