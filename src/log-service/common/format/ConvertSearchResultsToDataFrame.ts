import {
  DataFrame,
  DataFrameDTO,
  DataSourceInstanceSettings,
  FieldDTO,
  FieldType,
  MutableDataFrame,
  toDataFrame,
  TraceKeyValuePair,
  TraceLog,
} from '@grafana/data';
import { SpanStatusCode } from '@opentelemetry/api';
import { collectorTypes } from '@opentelemetry/exporter-collector';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import _, { isNil } from 'lodash-es';
import safeJsonStringify from 'safe-json-stringify';

import { parseLogJsonStr, safeParseJson } from './formatSearchLog';
import { CoreApp } from '../../../common/constants';
import { ISearchLogResult } from '../../../common/model';
import { MyDataSourceOptions, QueryInfo } from '../../../types';
import { createGraphFrames } from '../grafana/graphTransform';

// grafana 7 没有这个定义，这里单独定义
export type TraceSpanReference = {
  traceID: string;
  spanID: string;
  tags?: TraceKeyValuePair[];
};

/** 将SearchResults结果，处理为DataFrame */
export function ConvertSearchResultsToDataFrame(
  searchLogResult: ISearchLogResult,
  queryInfo: QueryInfo,
  instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>,
): DataFrame[] {
  if (queryInfo.logServiceParams?.format === 'Log') {
    return ConvertLogJsonToDataFrameDTO(searchLogResult, queryInfo, instanceSettings).map(toDataFrame);
  }
  return searchLogResult.Analysis
    ? [toDataFrame(ConvertAnalysisJsonToDataFrameDTO(searchLogResult))]
    : ConvertLogJsonToDataFrameDTO(searchLogResult, queryInfo, instanceSettings).map(toDataFrame);
}

function ConvertAnalysisJsonToDataFrameDTO(searchLogResult: ISearchLogResult): DataFrameDTO {
  const { analysisRecords = [], analysisColumns = [] } = searchLogResult ?? {};

  const fields: FieldDTO[] = analysisColumns.map((column) => {
    const values = analysisRecords.map((r) => r?.[column.Name!]);
    return {
      name: column.Name as string,
      type: column.fieldType as any,
      values,
    };
  });
  return {
    name: '',
    fields,
  };
}

export const enum LogFieldReservedName {
  TIMESTAMP = '__TIMESTAMP__',
  LogJson = '__LogJson__',
  SOURCE = '__SOURCE__',
  Filename = '__FILENAME__',
  HostName = '__HOSTNAME__',
  META = '__META__',
}

const requiredTraceKeys = ['traceId', 'spanId', 'start', 'end', 'name'];

/**
 * 大小写不敏感地解析 OLTP 日志,兼容 traceId/traceID 等不同大小写写法。
 * - 当 logJson 包含全部 requiredTraceKeys(忽略大小写)且值类型合法时,返回标准化副本,
 *   把 OLTP 标准字段名(camelCase)映射到原始字段值;
 * - 否则返回 null,表示不是 OLTP 格式日志。
 */
function buildOltpLogJson(logJson: Record<string, any>): Record<string, any> | null {
  const lowerKeyMap: Record<string, string> = {};
  Object.keys(logJson).forEach((k) => {
    lowerKeyMap[k.toLowerCase()] = k;
  });
  if (!requiredTraceKeys.every((key) => Object.prototype.hasOwnProperty.call(lowerKeyMap, key.toLowerCase()))) {
    return null;
  }
  // 用大小写不敏感的 key 直接从原始 logJson 取值做类型校验
  const traceIdKey = lowerKeyMap.traceid;
  const spanIdKey = lowerKeyMap.spanid;
  const startKey = lowerKeyMap.start;
  const endKey = lowerKeyMap.end;
  const nameKey = lowerKeyMap.name;
  const traceIdVal = logJson[traceIdKey];
  const spanIdVal = logJson[spanIdKey];
  const startVal = logJson[startKey];
  const endVal = logJson[endKey];
  const nameVal = logJson[nameKey];
  if (!traceIdVal || !spanIdVal || typeof traceIdVal !== 'string' || typeof spanIdVal !== 'string') {
    return null;
  }
  if (typeof startVal !== 'number' || !Number.isFinite(startVal) ||
      typeof endVal !== 'number' || !Number.isFinite(endVal)) {
    return null;
  }
  if (!nameVal || typeof nameVal !== 'string') {
    return null;
  }
  const result: Record<string, any> = { ...logJson };
  // 把 OLTP 标准字段映射到原始字段值,屏蔽大小写差异
  [
    'traceId',
    'spanId',
    'parentSpanID',
    'traceState',
    'name',
    'kind',
    'statusCode',
    'statusMessage',
    'start',
    'end',
    'resource',
    'resourceAttributes',
    'service',
    'host',
    'attribute',
    'logs',
    'links',
    'otlp.name',
    'otlp.version',
  ].forEach((stdKey) => {
    const actualKey = lowerKeyMap[stdKey.toLowerCase()];
    if (actualKey !== undefined && actualKey !== stdKey) {
      result[stdKey] = logJson[actualKey];
    }
  });
  return result;
}

function ConvertLogJsonToDataFrameDTO(
  searchLogResult: ISearchLogResult,
  queryInfo: QueryInfo,
  instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>,
): DataFrameDTO[] {
  const { app, logServiceParams } = queryInfo;
  const {
    jsonData: { enableExploreVisualizationTypes = false },
  } = instanceSettings;
  const { Results = [] } = searchLogResult;
  // Log场景的处理方式，参考文档
  // Grafana logSeriesToLogsModel方法（https://github.com/grafana/grafana/blob/faca526c169a9a61f119b6fc2819f5a8dfff7ed7/public/app/core/logs_model.ts#L315）
  // Grafana testData数据源 runLogsStream方法（https://github.com/grafana/grafana/blob/faca526c169a9a61f119b6fc2819f5a8dfff7ed7/public/app/plugins/datasource/testdata/runStreams.ts#L131）

  const timeField: FieldDTO<number> = {
    name: LogFieldReservedName.TIMESTAMP,
    type: FieldType.time,
    values: [],
  };
  const logField: FieldDTO<string> = {
    name: LogFieldReservedName.LogJson,
    // 这里使用字符串类型，标识此内容为 核心日志内容
    type: FieldType.string,
    config: {
      custom: { displayMode: 'json-view' },
    },
    values: [],
  };
  const sourceField: FieldDTO<string> = {
    name: LogFieldReservedName.SOURCE,
    type: FieldType.string,
    values: [],
  };
  const filenameField: FieldDTO<string> = {
    name: LogFieldReservedName.Filename,
    type: FieldType.string,
    values: [],
  };
  const hostnameField: FieldDTO<string> = {
    name: LogFieldReservedName.HostName,
    type: FieldType.string,
    values: [],
  };
  const metaField: FieldDTO<any> = {
    // 用于支持 Explore 功能上下文能力
    name: LogFieldReservedName.META,
    type: FieldType.other,
    config: {
      custom: {
        hidden: true,
      },
    },
    labels: { region: logServiceParams?.region as string, TopicId: logServiceParams?.TopicId as string },
    values: [],
  };
  const oltpFrame = new MutableDataFrame({
    fields: [
      { name: 'traceID', type: FieldType.string, values: [] },
      { name: 'spanID', type: FieldType.string, values: [] },
      { name: 'parentSpanID', type: FieldType.string, values: [] },
      { name: 'operationName', type: FieldType.string, values: [] },
      { name: 'serviceName', type: FieldType.string, values: [] },
      { name: 'kind', type: FieldType.string, values: [] },
      { name: 'statusCode', type: FieldType.number, values: [] },
      { name: 'statusMessage', type: FieldType.string, values: [] },
      { name: 'instrumentationLibraryName', type: FieldType.string, values: [] },
      { name: 'instrumentationLibraryVersion', type: FieldType.string, values: [] },
      { name: 'traceState', type: FieldType.string, values: [] },
      { name: 'serviceTags', type: FieldType.other, values: [] },
      { name: 'startTime', type: FieldType.number, values: [] },
      { name: 'duration', type: FieldType.number, values: [] },
      { name: 'logs', type: FieldType.other, values: [] },
      { name: 'references', type: FieldType.other, values: [] },
      { name: 'tags', type: FieldType.other, values: [] },
    ],
    meta: {
      preferredVisualisationType: 'trace',
      custom: {
        traceFormat: 'otlp',
      },
    },
  });
  const logMessageFieldMap = new Map<string, FieldDTO<any>>();

  Results.forEach((logItem, logIndex) => {
    (timeField.values as number[]).push(logItem.Time);
    (sourceField.values as string[]).push(logItem.Source);
    (filenameField.values as string[]).push(logItem.FileName);
    (hostnameField.values as string[]).push(logItem.HostName);
    (metaField.values as any[]).push(JSON.stringify(_.pick(logItem, ['PkgId', 'PkgLogId'])));
    try {
      const logJson = parseLogJsonStr(logItem.LogJson);

      /** 使用 LogsParsers.JSON 进行自动解析
       * 展示问题优化跟踪：https://github.com/grafana/grafana/issues/54959
       */
      // 这里的值可以是 string | object, Grafana内部自动进行序列化处理。
      (logField.values as string[]).push(JSON.stringify(logJson));

      /**
       * set log message fields, since grafana removes support for "detected fields"
       * @reference https://github.com/grafana/grafana/pull/60448
       */
      Object.keys(logJson).forEach((key) => {
        const value = logJson[key];

        let field: FieldDTO<any>;
        if (logMessageFieldMap.has(key)) {
          field = logMessageFieldMap.get(key) as FieldDTO<any>;
        } else {
          field = {
            name: key,
            values: new Array(Results.length),
          };
          if (typeof value === 'string') {
            field.type = FieldType.string;
          } else if (typeof value === 'number') {
            field.type = FieldType.number;
          } else if (typeof value === 'boolean') {
            field.type = FieldType.boolean;
          } else if (typeof value === 'object') {
            field.type = FieldType.string;
          } else {
            field.type = FieldType.other;
          }
          logMessageFieldMap.set(key, field);
        }

        if (typeof value === 'object') {
          (field.values as any[])[logIndex] = safeJsonStringify(value);
        } else {
          (field.values as any[])[logIndex] = value;
        }
      });

      // 提取OTLP数据 - 字段名大小写不敏感判断,兼容 traceId/traceID 等不同大小写写法
      const oltpLogJson = buildOltpLogJson(logJson);
      if (oltpLogJson) {
        // resource attributes
        // CLS 现网日志中,资源信息字段名为 `resource`(对象),旧格式为 `resourceAttributes`(JSON 字符串),做兼容
        const serviceTags: TraceKeyValuePair[] = [];
        const rawResource = oltpLogJson.resource ?? oltpLogJson.resourceAttributes ?? '{}';
        const clsResourceAttributes = typeof rawResource === 'string' ? safeParseJson(rawResource) : rawResource || {};
        // serviceName 优先取顶层 `service` 字段,回退到 resource 内的 `service` / `service.name`
        const serviceName =
          oltpLogJson.service || clsResourceAttributes.service || clsResourceAttributes['service.name'] || '';
        if (serviceName) {
          serviceTags.push({
            key: SemanticResourceAttributes.SERVICE_NAME,
            value: serviceName,
          });
        }
        // host: 优先取顶层 `host` 字段,其次 CLS 系统字段 __HOSTNAME__
        const hostName = oltpLogJson.host || oltpLogJson[LogFieldReservedName.HostName];
        if (hostName) {
          serviceTags.push({
            key: SemanticResourceAttributes.HOST_NAME,
            value: hostName,
          });
        }
        Object.keys(clsResourceAttributes).forEach((key) => {
          // 跳过已单独处理的 service / service.name,避免重复
          if (key === 'service' || key === 'service.name') {
            return;
          }
          serviceTags.push({
            key,
            value: clsResourceAttributes[key],
          });
        });

        // tags (attribute)
        const tags: TraceKeyValuePair[] = [];
        // attribute 字段同样兼容字符串与对象
        const rawAttribute = oltpLogJson.attribute ?? '{}';
        const clsAttributes = typeof rawAttribute === 'string' ? safeParseJson(rawAttribute) : rawAttribute || {};
        Object.keys(clsAttributes).forEach((key) => {
          tags.push({
            key,
            value: clsAttributes[key],
          });
        });

        // event attributes (logs)
        const logs: TraceLog[] = [];
        const rawLogs = oltpLogJson.logs ?? '[]';
        const clsLogs = typeof rawLogs === 'string' ? safeParseJson(rawLogs) : rawLogs || [];
        clsLogs.forEach((log: any) => {
          const fields: TraceKeyValuePair[] = [];
          if (log.name) {
            fields.push({
              key: 'message',
              value: log.name,
            });
          }
          if (log.attribute?.length) {
            Array.prototype.push.apply(
              fields,
              log.attribute.map((attr: any) => ({
                key: attr?.key,
                value: getAttributeValue(attr?.value?.Value || attr?.value),
              })),
            );
          }
          logs.push({
            timestamp: log.time! / 1000000,
            fields,
          });
        });

        // references (links)
        const references: TraceSpanReference[] = [];
        const rawLinks = oltpLogJson.links ?? '[]';
        const clsLinks = typeof rawLinks === 'string' ? safeParseJson(rawLinks) : rawLinks || [];
        clsLinks.forEach((link: any) => {
          references.push({
            traceID: link.traceId ?? link.traceID,
            spanID: link.spanId ?? link.spanID,
            tags: (link.attribute || []).map((attr: any) => ({
              key: attr?.key,
              value: getAttributeValue(attr?.value?.Value || attr?.value),
            })),
          });
        });

        const traceIdVal: string = oltpLogJson.traceId ?? '';
        oltpFrame.add({
          traceID: traceIdVal.length > 16 ? traceIdVal.slice(16) : traceIdVal,
          spanID: oltpLogJson.spanId,
          parentSpanID: oltpLogJson.parentSpanID || '',
          operationName: oltpLogJson.name || '',
          serviceName,
          kind: oltpLogJson.kind,
          statusCode: SpanStatusCode[oltpLogJson.statusCode], // UNSET -> 0, OK -> 1, ERROR -> 2,
          statusMessage: oltpLogJson.statusMessage,
          instrumentationLibraryName: oltpLogJson['otlp.name'],
          instrumentationLibraryVersion: oltpLogJson['otlp.version'],
          traceState: oltpLogJson.traceState ?? '',
          serviceTags,
          startTime: oltpLogJson.start! / 1000000,
          duration: (oltpLogJson.end! - oltpLogJson.start!) / 1000000,
          tags,
          logs,
          references,
        });
      }
    } catch (e) {
      console.warn('[CLS Grafana] Failed to process log entry for OLTP trace extraction:', e);
    }
  });

  const logsFrameDTO: DataFrameDTO = {
    name: '',
    meta: {
      preferredVisualisationType: 'logs',
      custom: {
        RequestId: (searchLogResult as any).RequestId,
        SamplingRate: searchLogResult.SamplingRate,
      },
      executedQueryString: searchLogResult.Query,
    },
    fields: [
      timeField,
      logField,
      Array.from(sourceField.values as string[]).filter(Boolean).length ? sourceField : null,
      Array.from(filenameField.values as string[]).filter(Boolean).length ? filenameField : null,
      Array.from(hostnameField.values as string[]).filter(Boolean).length ? hostnameField : null,
      metaField,
      ...Array.from(logMessageFieldMap.values()).sort((a, b) => String.prototype.localeCompare.call(a.name, b.name)),
    ].filter(Boolean) as FieldDTO<any>[],
  };

  const result = [];
  if (oltpFrame.length > 0) {
    if (
      !enableExploreVisualizationTypes ||
      isNil(logServiceParams?.preferredVisualisationTypes) ||
      logServiceParams.preferredVisualisationTypes?.includes('trace')
    ) {
      // 第一个要是 trace 数据，因为 TracesPanel 只取第一个
      result.push(oltpFrame);
    }
    if (
      !enableExploreVisualizationTypes ||
      isNil(logServiceParams?.preferredVisualisationTypes) ||
      logServiceParams.preferredVisualisationTypes?.includes('nodeGraph')
    ) {
      result.push(...(createGraphFrames(oltpFrame) as MutableDataFrame[]));
    }
  }

  // Explore页
  if (app === CoreApp.Explore) {
    // 如果开启展示类型选项，则按照展示类型设置来判断是否展示logs数据
    if (enableExploreVisualizationTypes) {
      if (logServiceParams?.preferredVisualisationTypes?.includes('logs')) {
        result.push(logsFrameDTO);
      }
    } else {
      // 如果没有开启展示类型选项，则看是否已存在tracing数据，存在就不展示logs了
      if (!result.length) {
        result.push(logsFrameDTO);
      }
    }
  } else {
    // 其他场景都加上logs数据
    result.push(logsFrameDTO);
  }

  return result;
}
function getAttributeValue(value: collectorTypes.opentelemetryProto.common.v1.AnyValue): any {
  if (value.stringValue) {
    return value.stringValue;
  }
  // @ts-ignore
  if (value.StringValue) {
    // @ts-ignore
    return value.StringValue;
  }

  if (value.boolValue !== undefined) {
    return Boolean(value.boolValue);
  }
  // @ts-ignore
  if (value.BoolValue !== undefined) {
    // @ts-ignore
    return Boolean(value.BoolValue);
  }

  if (value.intValue !== undefined) {
    return Number.parseInt(value.intValue as any, 10);
  }
  // @ts-ignore
  if (value.IntValue !== undefined) {
    // @ts-ignore
    return Number.parseInt(value.IntValue as any, 10);
  }

  if (value.doubleValue) {
    return Number.parseFloat(value.doubleValue as any);
  }
  // @ts-ignore
  if (value.DoubleValue) {
    // @ts-ignore
    return Number.parseFloat(value.DoubleValue as any);
  }

  if (value.arrayValue) {
    const arrayValue = [];
    for (const arValue of value.arrayValue.values) {
      arrayValue.push(getAttributeValue(arValue));
    }
    return arrayValue;
  }
  // @ts-ignore
  if (value.ArrayValue) {
    const arrayValue = [];
    // @ts-ignore
    for (const arValue of value.ArrayValue.values) {
      arrayValue.push(getAttributeValue(arValue));
    }
    return arrayValue;
  }

  return '';
}
