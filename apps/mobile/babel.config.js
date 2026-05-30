module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": "./",
            "@birdquest/shared": "../../packages/shared/src",
          },
        },
      ],
      "react-native-worklets/plugin",
    ],
  };
};
