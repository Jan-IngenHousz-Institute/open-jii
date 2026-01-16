module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          "react-compiler": false,
        },
      ],
    ],
    plugins: ["@babel/plugin-transform-class-static-block", "inline-dotenv"],
  };
};
