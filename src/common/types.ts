import { DataQuery, DataSourceJsonData, DataSourceSettings } from '@grafana/data';

import { Language } from '../locale';

export interface MyQuery extends DataQuery {
  region: string;
  TopicId: string;
  Query: string;
  SyntaxRule: number;
  MaxResultNum?: number;
  Limit?: number;
  Sort?: 'asc' | 'desc';
  // 解析使用字段
  format?: 'Graph' | 'Table' | 'Log';
  timeSeriesKey?: string;
  bucket?: string;
  metrics?: string;
}

/** MyQuery的运行时版本，用于将query中的不合法字段进去移除，保证query是个MyQuery类型的数据 */
/* export const myQueryRuntime: Required<MyQuery> = {
  region: 'ap-guangzhou',
  TopicId: '',
  Query: '',
  SyntaxRule: 1,
  MaxResultNum: 10000,
  Limit: 20,
  Sort: 'asc',
  format: 'Graph',
  timeSeriesKey: '',
  bucket: '',
  metrics: '',

  refId: '',
  hide: false,
  key: '',
  queryType: '',
  datasource: '',
}; */

export const defaultQuery: Partial<MyQuery> = {
  Query: '',
  Limit: 20,
  format: 'Graph',
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  secretId: string;
  /** 是否使用腾讯云API内网接入点 */
  intranet?: boolean;
  language?: Language;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  secretKey: string;
}

export type ClsDataSourceSettings = DataSourceSettings<MyDataSourceOptions, MySecureJsonData>;
