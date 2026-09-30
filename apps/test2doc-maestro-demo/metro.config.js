// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Maestro writes its screenshots and logs here while the app runs. If Metro
// watched them, every write would reload the app mid-test, and the reload
// banner would show up in the doc screenshots.
config.resolver.blockList = [
  ...[config.resolver.blockList].flat().filter(Boolean),
  /[\\/]maestro-output[\\/]/,
];

module.exports = config;
