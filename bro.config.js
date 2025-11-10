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
    "flors.main": "/flors",
    "flors.mainpage": "/flors/mainpage",
    "flors.recognition": "/flors/recognition",
    "flors.landscapedesign": "/flors/landscapedesign",
    "flors.encyclopedia": "/flors/encyclopedia",
    "flors.ourteam": "/flors/ourteam",
    "flors.privategarden": "/flors/privategarden",
    "flors.subscription": "/flors/subscription",
    "flors.auth": "/flors/auth",
  },
  
  features: {
    "flors": {
      // Добавьте фичи здесь если нужны
    },
  },
  
  config: {
    "flors.api": "/api",
  },
};
