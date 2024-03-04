import * as _ from 'lodash';

import Sign from './sign';
import { getLanguage } from '../locale';
import packageInfo from '../plugin.json';

export const TcDataSourceId = packageInfo.id;

export const QueryEditorFormatOptions = [
  { value: 'Graph', label: 'Graph, Pie, Gauge Panel' }, // 必定返回时间列，如果未输入时间列，则补一列时间0
  { value: 'Table', label: 'Table Panel' }, // 将原始日志或分析结果转化为Table
  { value: 'Log', label: 'Log Panel' }, // 只处理原始日志内容
];

/** 当前环境是否为非生产环境 */
export const IS_DEVELOPMENT_ENVIRONMENT = !(process.env.NODE_ENV === 'production');

export const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export enum SearchSyntaxRule {
  LUCENE = 0,
  CQL = 1,
}

// the services of tencentcloud monitor api
const FINANCE_REGIONS = ['ap-shanghai-fsi', 'ap-shenzhen-fsi'];
const SERVICES_API_INFO = {
  api: {
    service: 'api',
    version: '2020-11-06',
    path: '/api',
    host: 'api.tencentcloudapi.com',
  },
  // monitor api info
  monitor: {
    service: 'monitor',
    version: '2018-07-24',
    path: '/monitor',
    host: 'monitor.tencentcloudapi.com',
  },
  // cls api info
  cls: {
    service: 'cls',
    version: '2020-10-16',
    path: '/cls',
    host: 'cls.tencentcloudapi.com',
  },
  // cvm api info
  cvm: {
    service: 'cvm',
    version: '2017-03-12',
    path: '/cvm',
    host: 'cvm.tencentcloudapi.com',
  },
  // cdb api info
  cdb: {
    service: 'cdb',
    version: '2017-03-20',
    path: '/cdb',
    host: 'cdb.tencentcloudapi.com',
  },
  // pcx api info
  pcx: {
    service: 'pcx',
    version: '',
    path: '/pcx',
    host: 'vpc.api.qcloud.com',
  },
  // vpc api info
  vpc: {
    service: 'vpc',
    version: '2017-03-12',
    path: '/vpc',
    host: 'vpc.tencentcloudapi.com',
  },
  // mongodb api info
  mongodb: {
    service: 'mongodb',
    version: '2019-07-25',
    path: '/mongodb',
    host: 'mongodb.tencentcloudapi.com',
  },
  // 负载均衡 clb
  clb: {
    service: 'clb',
    version: '2018-03-17',
    path: '/clb',
    host: 'clb.tencentcloudapi.com',
  },
  // postgresql api info
  postgres: {
    service: 'postgres',
    version: '2017-03-12',
    path: '/postgres',
    host: 'postgres.tencentcloudapi.com',
  },
  // cdn info
  cdn: {
    service: 'cdn',
    version: '2018-06-06',
    path: '/cdn',
    host: 'cdn.tencentcloudapi.com',
  },
  // redis info
  redis: {
    service: 'redis',
    version: '2018-04-12',
    path: '/redis',
    host: 'redis.tencentcloudapi.com',
  },
  scf: {
    service: 'scf',
    version: '2018-04-16',
    path: '/scf',
    host: 'scf.tencentcloudapi.com',
  },
  cfs: {
    service: 'cfs',
    version: '2019-07-19',
    path: '/cfs',
    host: 'cfs.tencentcloudapi.com',
  },
  ckafka: {
    service: 'ckafka',
    version: '2019-08-19',
    path: '/ckafka',
    host: 'ckafka.tencentcloudapi.com',
  },
  // 专线接入实例列表
  dc: {
    service: 'dc',
    version: '2018-04-10',
    path: '/dc',
    host: 'dc.tencentcloudapi.com',
  },
  // cynosdb实例列表
  cynosdb: {
    service: 'cynosdb',
    version: '2019-01-07',
    path: '/cynosdb',
    host: 'cynosdb.tencentcloudapi.com',
  },
  // sqlserver实例列表
  sqlserver: {
    service: 'sqlserver',
    version: '2018-03-28',
    path: '/sqlserver',
    host: 'sqlserver.tencentcloudapi.com',
  },
  // bm实例列表
  bm: {
    service: 'bm',
    version: '2018-04-23',
    path: '/bm',
    host: 'bm.tencentcloudapi.com',
  },
  bmeip: {
    service: 'bmeip',
    version: '2018-06-25',
    path: '/bmeip',
    host: 'bmeip.tencentcloudapi.com',
  },
  bmvpc: {
    service: 'bmvpc',
    version: '2018-06-25',
    path: '/bmvpc',
    host: 'bmvpc.tencentcloudapi.com',
  },
  bmlb: {
    service: 'bmlb',
    version: '2018-06-25',
    path: '/bmlb',
    host: 'bmlb.tencentcloudapi.com',
  },
  // ES集群实例
  es: {
    service: 'es',
    version: '2018-04-16',
    path: '/es',
    host: 'es.tencentcloudapi.com',
  },
  // MapReduce
  emr: {
    service: 'emr',
    version: '2019-01-03',
    path: '/emr',
    host: 'emr.tencentcloudapi.com',
  },
  // CMQ消息队列
  cmq: {
    service: 'cmq',
    version: '2019-03-04',
    path: '/cmq',
    host: 'cmq.tencentcloudapi.com',
  },
  cbs: {
    service: 'cbs',
    version: '2017-03-12',
    path: '/cbs',
    host: 'cbs.tencentcloudapi.com',
  },
  // tcaplus实例
  tcaplusdb: {
    service: 'tcaplusdb',
    version: '2019-08-23',
    path: '/tcaplusdb',
    host: 'tcaplusdb.tencentcloudapi.com',
  },
  // tcaplus实例
  dcdb: {
    service: 'dcdb',
    version: '2018-04-11',
    path: '/dcdb',
    host: 'dcdb.tencentcloudapi.com',
  },
  // apigateway实例
  apigateway: {
    service: 'apigateway',
    version: '2018-08-08',
    path: '/apigateway',
    host: 'apigateway.tencentcloudapi.com',
  },
  tdmq: {
    service: 'tdmq',
    version: '2020-02-17',
    path: '/tdmq',
    host: 'tdmq.tencentcloudapi.com',
  },
  tdmq_rabbitmq: {
    service: 'tdmq',
    version: '2020-02-17',
    path: '/tdmq',
    host: 'tdmq.tencentcloudapi.com',
  },
  tdmq_rocketmq: {
    service: 'tdmq',
    version: '2020-02-17',
    path: '/tdmq',
    host: 'tdmq.tencentcloudapi.com',
  },
  gaap: {
    service: 'gaap',
    version: '2018-05-29',
    path: '/gaap',
    host: 'gaap.tencentcloudapi.com',
  },
  ecm: {
    service: 'ecm',
    version: '2019-07-19',
    path: '/ecm',
    host: 'ecm.tencentcloudapi.com',
  },
  gse: {
    service: 'gse',
    version: '2019-11-12',
    path: '/gse',
    host: 'gse.tencentcloudapi.com',
  },
  lighthouse: {
    service: 'lighthouse',
    version: '2020-03-24',
    path: '/lighthouse',
    host: 'lighthouse.tencentcloudapi.com',
  },
  tsf: {
    service: 'tsf',
    version: '2018-03-26',
    path: '/tsf',
    host: 'tsf.tencentcloudapi.com',
  },
  rum: {
    service: 'rum',
    version: '2021-06-22',
    path: '/rum',
    host: 'rum.tencentcloudapi.com',
  },
  tke: {
    service: 'tke',
    version: '2018-05-25',
    path: '/tke',
    host: 'tke.tencentcloudapi.com',
  },
  ecdn: {
    service: 'ecdn',
    version: '2019-10-12',
    path: '/ecdn',
    host: 'ecdn.tencentcloudapi.com',
  },
  waf: {
    service: 'waf',
    version: '2018-01-25',
    path: '/waf',
    host: 'waf.tencentcloudapi.com',
  },
  region: {
    service: 'region',
    version: '2022-06-27',
    path: '/region',
    host: 'region.tencentcloudapi.com',
  },
  apm: {
    service: 'apm',
    version: '2021-06-22',
    path: '/apm',
    host: 'apm.tencentcloudapi.com',
  },
  // 不单独定义lb，因为lb同样用的是vpc的配置，同上
  // lb: {
  //   service: 'lb',
  //   version: '2017-03-12',
  //   path: '/lb',
  //   host: 'vpc.tencentcloudapi.com'
  // }
  // 负载均衡四层协议 lbPrivate
  // lbPrivate: {
  //   service: 'lbPrivate',
  //   version: '2018-03-17',
  //   path: '/clb',
  //   host: 'clb.tencentcloudapi.com',
  // },
};

const FINANCE_HOST = {
  scf: {
    'ap-shanghai-fsi': {
      path: '/fsi/scf/shanghai',
      host: 'scf.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/scf/shenzhen',
      host: 'scf.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  cfs: {
    'ap-shanghai-fsi': {
      path: '/fsi/cfs/shanghai',
      host: 'cfs.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/cfs/shenzhen',
      host: 'cfs.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  ckafka: {
    'ap-shanghai-fsi': {
      path: '/fsi/ckafka/shanghai',
      host: 'ckafka.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/ckafka/shenzhen',
      host: 'ckafka.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  clb: {
    'ap-shanghai-fsi': {
      path: '/fsi/clb/shanghai',
      host: 'clb.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/clb/shenzhen',
      host: 'clb.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  mongodb: {
    'ap-shanghai-fsi': {
      path: '/fsi/mongodb/shanghai',
      host: 'mongodb.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/mongodb/shenzhen',
      host: 'mongodb.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  vpc: {
    'ap-shanghai-fsi': {
      path: '/fsi/vpc/shanghai',
      host: 'vpc.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/vpc/shenzhen',
      host: 'vpc.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  cvm: {
    'ap-shanghai-fsi': {
      path: '/fsi/cvm/shanghai',
      host: 'cvm.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/cvm/shenzhen',
      host: 'cvm.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  cdb: {
    'ap-shanghai-fsi': {
      path: '/fsi/cdb/shanghai',
      host: 'cdb.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/cdb/shenzhen',
      host: 'cdb.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  monitor: {
    'ap-shanghai-fsi': {
      path: '/fsi/monitor/shanghai',
      host: 'monitor.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/monitor/shenzhen',
      host: 'monitor.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  postgres: {
    'ap-shanghai-fsi': {
      path: '/fsi/postgres/shanghai',
      host: 'postgres.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/postgres/shenzhen',
      host: 'postgres.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  emr: {
    'ap-shanghai-fsi': {
      path: '/fsi/emr/shanghai',
      host: 'emr.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/emr/shenzhen',
      host: 'emr.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  cmq: {
    'ap-shanghai-fsi': {
      path: '/fsi/cmq/shanghai',
      host: 'cmq.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/cmq/shenzhen',
      host: 'cmq.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
  cls: {
    'ap-shanghai-fsi': {
      path: '/fsi/cls/shanghai',
      host: 'cls.ap-shanghai-fsi.tencentcloudapi.com',
    },
    'ap-shenzhen-fsi': {
      path: '/fsi/cls/shenzhen',
      host: 'cls.ap-shenzhen-fsi.tencentcloudapi.com',
    },
  },
};

// 获取对应业务的 API 接口信息
export function GetServiceAPIInfo(region, service) {
  return { ...(SERVICES_API_INFO[service] || {}), ...getHostAndPath(region, service) };
}
// get host and path for finance regions
function getHostAndPath(region, service) {
  if (_.indexOf(FINANCE_REGIONS, region) === -1) {
    return {};
  }
  return (
    _.find(
      _.find(FINANCE_HOST, (__, key) => key === service),
      (__, key) => key === region,
    ) || {}
  );
}

/**
 * 腾讯云 API 3.0 接口协议
 * @param options 接口请求对象 { url: string, data?: object }
 * @param service 产品名字 'cvm'
 * @param signObj 接口请求相关信息 { region?: string, action: string }
 * @param secretId
 * @param secretKey
 */
export async function GetRequestParams(options, service, signObj: any = {}, secretId, datasourceId, backendSrv) {
  const signParams = {
    secretId,
    payload: options.data || '',
    ...signObj,
    ...(_.pick(GetServiceAPIInfo(signObj.region || '', service), ['service', 'host', 'version']) || {}),
    backendSrv,
    datasourceId,
  };
  const sign = new Sign(signParams);
  const { intranet, ...headerSigned } = await sign.getHeader();
  // 传入x-tc-language实现国际化
  // zh-CN en-US ko-KR ja-JP
  options.headers = Object.assign(options.headers || {}, { ...headerSigned }, { 'X-TC-LANGUAGE': getLanguage() });
  options.method = 'POST';
  if (intranet) {
    options.url += '-internal';
  }
  return options;
}

/**
 * @link https://github.com/grafana/grafana/blob/3c6e0e8ef85048af952367751e478c08342e17b4/packages/grafana-data/src/types/app.ts#L12
 */
export enum CoreApp {
  CloudAlerting = 'cloud-alerting',
  UnifiedAlerting = 'unified-alerting',
  Dashboard = 'dashboard',
  Explore = 'explore',
  Unknown = 'unknown',
  PanelEditor = 'panel-editor',
  PanelViewer = 'panel-viewer',
}
