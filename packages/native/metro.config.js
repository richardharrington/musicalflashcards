const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const nativeNodeModules = path.resolve(__dirname, 'node_modules');
const forcedModules = {
  react: path.resolve(nativeNodeModules, 'react'),
  'react-native': path.resolve(nativeNodeModules, 'react-native'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (forcedModules[moduleName]) {
    return { type: 'sourceFile', filePath: require.resolve(moduleName, { paths: [nativeNodeModules] }) };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
