/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */
const path = require('path');

module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
    assetRegistryPath: require.resolve("react-native/Libraries/Image/AssetRegistry"),
  },
  serializer: {
    getPolyfills: () => [
      require.resolve('@react-native/js-polyfills/error-guard'),
    ],
  },
  resolver: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'missing-asset-registry-path': require.resolve("react-native/Libraries/Image/AssetRegistry"),
    },
    assetExts: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'psd', 'svg', 'ttf', 'otf'],
    sourceExts: ['js', 'json', 'ts', 'tsx'],
    blacklistRE: /@expo\/vector-icons/,
    blockList: /@expo\/vector-icons/,
    resolverMainFields: ['react-native', 'browser', 'main'],
    platforms: ['ios', 'android', 'native', 'web'],
  },
  resetCache: true,
};