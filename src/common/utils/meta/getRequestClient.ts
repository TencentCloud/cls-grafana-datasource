export const GrafanaVersion = (window as any).grafanaBootData?.settings?.buildInfo?.version || '0.0.0';

export const GRAFANA_PLUGIN_VERSION = String(process.env.TENCENT_CLOUD_CLS_GRAFANA_PLUGIN_VERSION);

export function getRequestClient(): string {
  return `GF_${String(GrafanaVersion)}_PL_CLS_${String(GRAFANA_PLUGIN_VERSION)}`;
}
