import { getBackendSrv } from '@grafana/runtime'
import { ClsDataSourceSettings } from '../types'

export async function UpdateDataSource(dashboardId: number, info: ClsDataSourceSettings) {
  return getBackendSrv().datasourceRequest({
    url: `/api/datasources/${dashboardId}`,
    method: 'PUT',
    data: info,
  })
}
