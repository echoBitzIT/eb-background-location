module.exports = {
  dependencies: {
    // Unused (app uses MapLibre). Autolinking it pulls play-services-location 21.x
    // and crashes splash GPS via react-native-geolocation-service.
    'react-native-maps': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
