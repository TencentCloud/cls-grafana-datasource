/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path')

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
    plugins: [...originalConfig.plugins],
  }
  console.log(`originalConfig`, originalConfig)
  return newConfig
}

module.exports = {
  getWebpackConfig,
}
