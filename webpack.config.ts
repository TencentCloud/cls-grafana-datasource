import type { Configuration } from 'webpack';
import { DefinePlugin } from 'webpack';
import { merge } from 'webpack-merge';

// @ts-ignore
import grafanaConfig from './.config/webpack/webpack.config';
import packageInfo from './package.json';

const config = async (env: any): Promise<Configuration> => {
  const originalConfig = await grafanaConfig(env);

  const newConfig = merge(originalConfig, {
    // Add custom config here...
    plugins: [
      new DefinePlugin({
        'process.env.TENCENT_CLOUD_CLS_GRAFANA_PLUGIN_VERSION': JSON.stringify(packageInfo.version || '0.0.0'),
      }),
    ],
  });

  return newConfig;
};

export default config;
