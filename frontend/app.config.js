// Native IDs are build-time configuration. No server credentials belong in Expo config.
module.exports = ({ config }) => {
  const live = (process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV) === "prod" && process.env.EXPO_PUBLIC_ADS_MODE === "live"
    && process.env.EXPO_PUBLIC_LIVE_ADS_ENABLED === "true";
  const androidAppId = live ? process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID : "ca-app-pub-3940256099942544~3347511713";
  const iosAppId = live ? process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID : "ca-app-pub-3940256099942544~1458002511";
  if (!/^ca-app-pub-\d+~\d+$/.test(androidAppId ?? "") || !/^ca-app-pub-\d+~\d+$/.test(iosAppId ?? "")) {
    throw new Error("Explicit live ads require both platform AdMob App IDs.");
  }
  return { ...config, plugins: [...(config.plugins ?? []), ["react-native-google-mobile-ads", {
    androidAppId, iosAppId, delayAppMeasurementInit: true,
  }]] };
};
