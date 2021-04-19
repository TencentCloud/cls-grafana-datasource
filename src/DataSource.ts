import { DataSourceInstanceSettings, MetricFindValue, Field } from '@grafana/data'
import {
  DataSourceWithBackend,
  getBackendSrv,
  getTemplateSrv,
  toDataQueryResponse,
} from '@grafana/runtime'
import { MyDataSourceOptions, MyQuery } from './types'

export class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings)
  }

  applyTemplateVariables(query: MyQuery) {
    const targetQuery = getTemplateSrv().replace(query.Query)
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
    if (!resFrame) {
      return []
    }

    const fields: Field[] = resFrame.data.reduce((prev, cur) => {
      return [...prev, ...cur?.fields]
    }, [] as Field[])

    const values: MetricFindValue[] = []
    for (const field of fields) {
      for (let i = 0; i < field.values.length; i++) {
        values.push({ text: String(field.values?.get(i)) })
      }
    }
    return values
  }
}
