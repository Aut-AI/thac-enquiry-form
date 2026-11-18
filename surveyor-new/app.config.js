// Wraps app.json.
// - Android: GOOGLE_SERVICES_JSON is a private EAS file variable (the repo is
//   public, so google-services.json is never committed). Without it the app
//   still builds; Android push just stays off.
// - iOS: the expo-notifications plugin adds the Push Notifications entitlement,
//   which needs the Apple provisioning profile regenerated with an Apple login.
//   Until that is done (planned with the move to Trevor's Apple account), iOS
//   builds leave the plugin out so they keep signing with the existing profile.
//   Set IOS_PUSH=1 to switch it back on.
module.exports = ({ config }) => {
  const out = { ...config };
  const gs = process.env.GOOGLE_SERVICES_JSON;
  if (gs) out.android = { ...config.android, googleServicesFile: gs };
  if (process.env.EAS_BUILD_PLATFORM === 'ios' && process.env.IOS_PUSH !== '1') {
    out.plugins = (config.plugins || []).filter(p => (Array.isArray(p) ? p[0] : p) !== 'expo-notifications');
  }
  return out;
};
