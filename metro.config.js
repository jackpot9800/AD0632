// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // [Web-only]: Enables CSS support in Metro.
  isCSSEnabled: true,
});

// Add support for importing TypeScript files
config.resolver.sourceExts.push('ts', 'tsx');

// Ensure we don't try to resolve .ts files as native modules
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'ts' && ext !== 'tsx');

// Avoid issues with expo-modules-core
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;