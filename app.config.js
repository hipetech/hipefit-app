module.exports = {
  name: 'Hipefit',
  slug: 'hipefit-app',
  version: '1.0.0',
  scheme: 'hipefitapp',
  plugins: ['expo-router', 'expo-font', 'expo-image', 'expo-web-browser'],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  owner: 'hipefit-organization',
  extra: {
    eas: {
      projectId: 'ed13ba69-1314-4a7d-9084-5798e9464f26',
    },
  },
};
