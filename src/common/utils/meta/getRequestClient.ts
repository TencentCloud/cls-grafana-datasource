export const GrafanaVersion = (window as any).grafanaBootData?.settings?.buildInfo?.version || '0.0.0';

export function getRequestClient(): string {
  return `GF_${GrafanaVersion}_PL_CLS_${process.env.TENCENT_CLOUD_CLS_GRAFANA_PLUGIN_VERSION}`;
}
