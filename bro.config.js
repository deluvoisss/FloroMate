const pkg = require("./package");

module.exports = {
  apiPath: "stubs/api",
  webpackConfig: {
    output: {
      publicPath: `/static/${pkg.name}/${process.env.VERSION || pkg.version}/`,
    },
    devServer: {
      historyApiFallback: true, // ← ДОБАВИТЬ! Для корректной работы React Router
      hot: true,
      port: 8099,
    },
  },
  
  navigations: {
    "floromate.main": "/floromate",
    "floromate.mainpage": "/floromate/mainpage",
    "floromate.recognition": "/floromate/recognition",
    "floromate.landscapedesign": "/floromate/landscapedesign",
    "floromate.encyclopedia": "/floromate/encyclopedia",
    "floromate.ourteam": "/floromate/ourteam",
    "floromate.privategarden": "/floromate/privategarden",
    "floromate.subscription": "/floromate/subscription",
    "floromate.auth": "/floromate/auth",
  },
  
  features: {
    "floromate": {
      // Добавьте фичи здесь если нужны
    },
  },
  
  config: {
    "floromate.api": "/api",
  },
};
