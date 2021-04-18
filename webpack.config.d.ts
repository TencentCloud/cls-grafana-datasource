import { CustomWebpackConfigurationGetter } from '@grafana/toolkit/src/config/webpack.plugin.config'

declare const getWebpackConfig: CustomWebpackConfigurationGetter

export default {
  getWebpackConfig,
}
