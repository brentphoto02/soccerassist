module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          extensions: ['.tsx', '.ts', '.js', '.json'],
          alias: {
            '@components': './src/components',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@data': './src/data',
            '@models': './src/models',
            '@store': './src/store',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
