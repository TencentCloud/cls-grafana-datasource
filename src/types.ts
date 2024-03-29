/** 此文件放置通用业务的配置项，用于区分业务类型 */
import { DataQuery, DataSourceJsonData } from '@grafana/data';

import { t, Language } from './locale';
import { SearchSyntaxRule } from './log-service/common/constants';

export const enum ServiceType {
  logService = 'logService',
}

export const ServiceTypeOptions = [
  {
    value: ServiceType.logService,
    get label() {
      return t('cloud_log_service');
    },
  },
];

export interface QueryInfo extends DataQuery {
  /** 数据源Query针对的查询服务，监控 or 日志 */
  serviceType?: ServiceType;
  logServiceParams?: {
    region: string;
    TopicId: string;
    Query: string;
    SyntaxRule: number;
    MaxResultNum?: number;
  };
}

export const defaultQueryInfo: Omit<QueryInfo, 'refId'> = {
  serviceType: ServiceType.logService,
  logServiceParams: {
    region: '',
    TopicId: '',
    Query: '',
    SyntaxRule: SearchSyntaxRule.CQL,
  },
};

/** QueryInfo的运行时版本，用于将query中的不合法字段进去移除，保证query是个QueryInfo类型的数据 */
export const queryInfoRuntime: Required<QueryInfo> = {
  refId: '',
  hide: false,
  key: '',
  queryType: '',
  datasource: '',
  dataTopic: null as any,

  serviceType: defaultQueryInfo.serviceType,
  logServiceParams: defaultQueryInfo.logServiceParams,
};

/** 变量数据类型。字符场景为云监控配置，对象场景由内部字段决定 */
export interface VariableQuery {
  serviceType: ServiceType;
  queryString: string;
  logServiceParams?: QueryInfo['logServiceParams'];
}

/**
 * These are options configured for each DataSource instance.
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  secretId?: string;
  intranet?: boolean;
  language?: Language;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  secretKey: string;
}
