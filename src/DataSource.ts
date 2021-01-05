import { DataSourceInstanceSettings, MetricFindValue, ScopedVars } from '@grafana/data'
import {
  DataSourceWithBackend,
  getBackendSrv,
  getTemplateSrv,
  toDataQueryResponse,
  frameToMetricFindValue,
} from '@grafana/runtime'
import { MyDataSourceOptions, MyQuery } from './types'

export class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings)
  }

  applyTemplateVariables(query: MyQuery, scopedVars: ScopedVars): Record<string, any> {
    const targetQuery = getTemplateSrv().replace(query.Query, scopedVars)
    return {
      ...query,
      Query: targetQuery,
    }
  }

  async metricFindQuery(query: string, options): Promise<MetricFindValue[]> {
    const targetQuery = getTemplateSrv().replace(query)
    /** reference grafana DataSourceWithBackend.ts */
    const backendRes = await getBackendSrv().datasourceRequest({
      url: '/api/ds/query',
      method: 'POST',
      data: {
        from: String(options?.range?.from?.valueOf()),
        to: String(options?.range?.to?.valueOf()),
        queries: [
          {
            Query: targetQuery,
            format: 'Table',
            refId: 'A',
            datasourceId: this.id,
          },
        ],
      },
    })
    const resFrame = toDataQueryResponse(backendRes)
    return resFrame ? resFrame.data.map(frameToMetricFindValue).flat() : []
  }
}
