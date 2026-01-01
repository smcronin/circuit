const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add wav files to asset extensions for audio bundling
config.resolver.assetExts.push('wav');

module.exports = config;
