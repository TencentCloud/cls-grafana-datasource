/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path')
const { DefinePlugin } = require('webpack')
const packageInfo = require('./package.json')

const getWebpackConfig = (originalConfig, options) => {
  const moduleRules = originalConfig.module.rules
  const newConfig = {
    ...originalConfig,
    externals: originalConfig.externals.filter((item) => {
      return true
      // return item !== 'emotion' && item !== '@emotion/css' && item !== '@emotion/react'
    }),
    module: {
      ...originalConfig.module,
      rules: [...moduleRules],
    },
    plugins: [
      ...originalConfig.plugins,
      new DefinePlugin({
        'process.env.TENCENT_CLOUD_CLS_GRAFANA_PLUGIN_VERSION':
          JSON.stringify(packageInfo.version) || '0.0.0',
      }),
    ],
  }
  console.log(`originalConfig`, originalConfig)
  return newConfig
}

module.exports = {
  getWebpackConfig,
}
