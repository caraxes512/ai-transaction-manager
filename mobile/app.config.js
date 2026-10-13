// Extends app.json. Android release builds refuse plain http:// by default, so a build that talks to a LAN
// backend (http://192.168.x.x:8000) must opt in with ALLOW_CLEARTEXT=1. A build against an https:// API must not.
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ...(process.env.ALLOW_CLEARTEXT === "1" ? [["expo-build-properties", { android: { usesCleartextTraffic: true } }]] : []),
  ],
});
