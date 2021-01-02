import { DataQuery, DataSourceJsonData } from '@grafana/data'

export interface MyQuery extends DataQuery {
  Query?: string
  Limit?: number
  Sort?: 'asc' | 'desc'
  // 解析使用字段
  format?: 'Graph' | 'Table' | 'Log'
  timeSeriesKey?: string
  bucket?: string
  metrics?: string
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
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MySecureJsonData {
  secretId: string
  secretKey: string
}
