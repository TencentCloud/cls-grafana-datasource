import { DataQuery, DataSourceJsonData, DataSourceSettings } from '@grafana/data'

export interface MyQuery extends DataQuery {
  Query?: string
  Limit?: number
  Sort?: 'asc' | 'desc'
  // 解析使用字段
  format?: 'Graph' | 'Table' | 'Log'
  timeSeriesKey?: string
  bucket?: string
  metrics?: string
  /** 前端获取 Grafana 与 Plugin, 传递给 Backend
   * 理想状态应该放在非数组量中，但是目前仅发现 query 可以传递给 backend
   * */
  RequestClient?: string
}

export const defaultQuery: Partial<MyQuery> = {
  Query: '',
  Limit: 20,
  format: 'Graph',
}

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  region: string
  logsetId?: string
  topicId: string
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  secretId: string
  secretKey: string
}

export type ClsDataSourceSettings = DataSourceSettings<MyDataSourceOptions, MySecureJsonData>
