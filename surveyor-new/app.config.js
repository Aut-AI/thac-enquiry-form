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
  const { withEntitlementsPlist } = require('expo/config-plugins');
  const out = { ...config };
  const gs = process.env.GOOGLE_SERVICES_JSON;
  if (gs) out.android = { ...config.android, googleServicesFile: gs };
  if (process.env.EAS_BUILD_PLATFORM === 'ios' && process.env.IOS_PUSH !== '1') {
    out.plugins = (config.plugins || []).filter(p => (Array.isArray(p) ? p[0] : p) !== 'expo-notifications');
    // Belt and braces: drop the entitlement even if something else adds it.
    const dropPush = c => withEntitlementsPlist(c, m => { delete m.modResults['aps-environment']; return m; });
    out.plugins = [dropPush, ...out.plugins];
    if (out.ios) { out.ios = { ...out.ios, entitlements: { ...(out.ios.entitlements || {}) } }; delete out.ios.entitlements['aps-environment']; }
  }
  return out;
};
