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
import _, { isNil } from 'lodash';

import { parseLogJsonStr, safeParseJson } from './formatSearchLog';
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
  logServiceParams: QueryInfo['logServiceParams'],
  instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>,
): DataFrame[] {
  return searchLogResult.Analysis
    ? [toDataFrame(ConvertAnalysisJsonToDataFrameDTO(searchLogResult))]
    : ConvertLogJsonToDataFrameDTO(searchLogResult, logServiceParams, instanceSettings).map(toDataFrame);
}

function ConvertAnalysisJsonToDataFrameDTO(searchLogResult: ISearchLogResult): DataFrameDTO {
  const { analysisRecords = [], analysisColumns = [] } = searchLogResult ?? {};

  const fields: FieldDTO[] = analysisColumns.map((column) => {
    const values = analysisRecords.map((r) => r?.[column.Name!]);
    return {
      name: column.Name,
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

const oltpKeys = ['traceId', 'spanId', 'traceState'];

function ConvertLogJsonToDataFrameDTO(
  searchLogResult: ISearchLogResult,
  logServiceParams: QueryInfo['logServiceParams'],
  instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>,
): DataFrameDTO[] {
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
    labels: { region: logServiceParams.region, TopicId: logServiceParams.TopicId },
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

  Results.forEach((logItem) => {
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

      // 提取OTLP数据
      if (oltpKeys.every((key) => Object.prototype.hasOwnProperty.call(logJson, key))) {
        // resource attributes
        const serviceTags: TraceKeyValuePair[] = [];
        const clsResourceAttributes = safeParseJson(logJson.resourceAttributes || '{}');
        if (logJson[LogFieldReservedName.HostName]) {
          serviceTags.push({
            key: SemanticResourceAttributes.HOST_NAME,
            value: logJson[LogFieldReservedName.HostName],
          });
        }
        Object.keys(clsResourceAttributes).forEach((key) => {
          serviceTags.push({
            key: key === 'service' ? SemanticResourceAttributes.SERVICE_NAME : key,
            value: clsResourceAttributes[key],
          });
        });

        // tags (attribute)
        const tags: TraceKeyValuePair[] = [];
        const clsAttributes = safeParseJson(logJson.attribute || '{}');
        Object.keys(clsAttributes).forEach((key) => {
          tags.push({
            key,
            value: clsAttributes[key],
          });
        });

        // event attributes (logs)
        const logs: TraceLog[] = [];
        const clsLogs = safeParseJson(logJson.logs || '[]');
        clsLogs.forEach((log) => {
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
              log.attribute.map((attr) => ({
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
        const clsLinks = safeParseJson(logJson.links || '[]');
        clsLinks.forEach((link) => {
          references.push({
            traceID: link.traceId,
            spanID: link.spanId,
            tags: (link.attribute || []).map((attr) => ({
              key: attr?.key,
              value: getAttributeValue(attr?.value?.Value || attr?.value),
            })),
          });
        });

        oltpFrame.add({
          traceID: logJson.traceId.length > 16 ? logJson.traceId.slice(16) : logJson.traceId,
          spanID: logJson.spanId,
          parentSpanID: logJson.parentSpanID || '',
          operationName: logJson.name || '',
          serviceName: clsResourceAttributes.service,
          kind: logJson.kind,
          statusCode: SpanStatusCode[logJson.statusCode], // UNSET -> 0, OK -> 1, ERROR -> 2,
          statusMessage: logJson.statusMessage,
          instrumentationLibraryName: logJson['otlp.name'],
          instrumentationLibraryVersion: logJson['otlp.version'],
          traceState: logJson.traceState,
          serviceTags,
          startTime: logJson.start! / 1000000,
          duration: (logJson.end! - logJson.start!) / 1000000,
          tags,
          logs,
          references,
        });
      }

      /** 使用 LogsParsers.logfmt 进行自动解析，缩略展示上更友好，但是LogDetail提取会有问题 */
      // let logStr = '';
      // Object.entries(logJson).forEach(([k, v])=>{
      //   logStr += `${k}=${_.isObject(v) ? JSON.stringify(v) : `${v}` } `
      // });
      // (logField.values as string[]).push(logStr);
    } catch (e) {}
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
    fields: [timeField, logField, sourceField, filenameField, hostnameField, metaField],
  };

  const result = [];
  if (oltpFrame.length > 0) {
    if (
      !enableExploreVisualizationTypes ||
      isNil(logServiceParams.preferredVisualisationTypes) ||
      logServiceParams.preferredVisualisationTypes?.includes('trace')
    ) {
      // 第一个要是 trace 数据，因为 TracesPanel 只取第一个
      result.push(oltpFrame);
    }
    if (
      !enableExploreVisualizationTypes ||
      isNil(logServiceParams.preferredVisualisationTypes) ||
      logServiceParams.preferredVisualisationTypes?.includes('nodeGraph')
    ) {
      result.push(...(createGraphFrames(oltpFrame) as MutableDataFrame[]));
    }
  }
  if (
    !enableExploreVisualizationTypes ||
    isNil(logServiceParams.preferredVisualisationTypes) ||
    logServiceParams.preferredVisualisationTypes?.includes('logs')
  ) {
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
