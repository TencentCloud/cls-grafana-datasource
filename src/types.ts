/** 此文件放置通用业务的配置项，用于区分业务类型 */
import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { PreferredVisualisationType } from '@grafana/data/types/data';

import { CoreApp } from './common/constants';
import { Language, t } from './locale';
import { SearchSyntaxRule } from './log-service/common/constants';

export const enum ServiceType {
  logService = 'logService',
  cloudApi = 'cloudApi',
}

export const SERVICE_TYPE_OPTIONS = [
  {
    value: ServiceType.logService,
    get label() {
      return t('cloud_log_service');
    },
  },
  {
    value: ServiceType.cloudApi,
    get label() {
      return t('cloud_api');
    },
  },
];

export interface QueryInfo extends DataQuery {
  app: CoreApp;
  /** 数据源Query针对的查询服务，监控 or 日志 */
  serviceType?: ServiceType;
  logServiceParams?: {
    region: string;
    TopicId: string;
    Query: string;
    SyntaxRule: number;
    MaxResultNum?: number;
    preferredVisualisationTypes?: PreferredVisualisationType[];
    // 解析使用字段
    format?: 'Graph' | 'Table' | 'Log';
  };
}

export const defaultQueryInfo: Omit<QueryInfo, 'refId'> = {
  app: CoreApp.Dashboard,
  serviceType: ServiceType.logService,
  logServiceParams: {
    region: '',
    TopicId: '',
    Query: '',
    SyntaxRule: SearchSyntaxRule.CQL,
    preferredVisualisationTypes: ['logs', 'trace', 'nodeGraph'],
    format: 'Graph',
  },
};

/** QueryInfo的运行时版本，用于将query中的不合法字段进去移除，保证query是个QueryInfo类型的数据 */
export const queryInfoRuntime: Required<QueryInfo> = {
  app: CoreApp.Dashboard,
  refId: '',
  hide: false,
  key: '',
  queryType: '',
  datasource: null,
  dataTopic: null,

  serviceType: defaultQueryInfo.serviceType,
  logServiceParams: defaultQueryInfo.logServiceParams,
};

/** 变量数据类型。字符场景为云监控配置，对象场景由内部字段决定 */
export interface VariableQuery {
  app: CoreApp;
  serviceType: ServiceType;
  queryString: string;
  logServiceParams?: QueryInfo['logServiceParams'];
}

/**
 * These are options configured for each DataSource instance.
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  secretId?: string;
  /** 是否使用腾讯云API内网接入点 */
  intranet?: boolean;
  language?: Language;
  enableExploreVisualizationTypes?: boolean;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  secretKey: string;
}
