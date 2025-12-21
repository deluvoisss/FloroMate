const pkg = require("./package");

module.exports = {
  
  webpackConfig: {
    output: {
      publicPath: `/static/${pkg.name}/${process.env.VERSION || pkg.version}/`,
    },
    devServer: {
      historyApiFallback: true, 
      hot: true,
      port: 8099,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    resolve: {
      fallback: {
        "path": require.resolve("path-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "crypto": require.resolve("crypto-browserify")
      }
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          include: /node_modules\/three/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              plugins: []
            }
          }
        }
      ]
    }
  },

  api: {
    port: 3001,
    script: './stubs/api/index.js', 
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
    
    },
  },
  
  config: {
    "floromate.api": "/api",
  },
};