// Wraps app.json. On EAS, GOOGLE_SERVICES_JSON is a private file variable
// (the repo is public, so google-services.json is never committed). Without it
// the app still builds; Android push just stays off.
module.exports = ({ config }) => {
  const gs = process.env.GOOGLE_SERVICES_JSON;
  return gs ? { ...config, android: { ...config.android, googleServicesFile: gs } } : config;
};
