const selectPerEnvironment = (development, staging, production) => {
  switch (process.env.ENVIRONMENT) {
    case 'development':
      return development;
    case 'staging':
      return staging;
    case 'production':
      return production;
  }
};

module.exports = {
  name: selectPerEnvironment('Hipefit Dev', 'Hipefit Staging', 'Hipefit'),
  slug: 'hipefit-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'hipefitapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: selectPerEnvironment(
      'com.kyrylokorota.hipefitapp.develoment',
      'com.kyrylokorota.hipefitapp.staging',
      'com.kyrylokorota.hipefitapp'
    ),
    icon: selectPerEnvironment(
      './assets/development/ios-icon.icon',
      './assets/staging/ios-icon.icon',
      './assets/production/ios-icon.icon'
    ),
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: 'com.kyrylokorota.hipefitapp',
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: selectPerEnvironment(
          './assets/development/splash-icon.png',
          './assets/staging/splash-icon.png',
          './assets/production/splash-icon.png'
        ),
        imageWidth: 400,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};
