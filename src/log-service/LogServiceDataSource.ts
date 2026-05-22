import {
  DataFrame,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  LoadingState,
  LogRowModel,
  MetricFindValue,
} from '@grafana/data';
import { getTemplateSrv, DataSourceWithBackend } from '@grafana/runtime';
import { RowContextOptions } from '@grafana/ui/components/Logs/LogRowContextProvider';
import moment from 'moment-timezone';
import { Observable } from 'rxjs';
import { share } from 'rxjs/operators';

import {
  ConvertLogContextToDataFrame,
  ConvertSearchResultsToDataFrame,
  formatSearchLog,
  LogFieldReservedName,
} from './common/format';
import { DescribeLogContext, DescribeTopics, LogInfo, SearchLog } from '../common/model';
import { MyDataSourceOptions, QueryInfo } from '../types';
import { toTimeSeriesMany } from './common/format/prepareTimeSeries';
import {
  addQueryResultLimit,
  getRawQuery,
  replaceClsIntervalMacro,
  replaceClsQueryWithTemplateSrv,
} from './common/utils/query';

// UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
const topicIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTopicId(s: string): boolean {
  return topicIdRegex.test(s);
}

interface TopicCacheEntry {
  topicId: string;
  expiresAt: number;
}

const topicCache = new Map<string, TopicCacheEntry>();
const TOPIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function resolveTopicId(
  topicNameOrId: string,
  region: string,
  opts: { instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>; ds: DataSourceWithBackend<any, any> }
): Promise<string> {
  if (!topicNameOrId || isTopicId(topicNameOrId)) {
    return topicNameOrId;
  }
  const cacheKey = `${region}:${topicNameOrId}`;
  const cached = topicCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.topicId;
  }
  // exact match first, fallback to fuzzy
  for (const preciseSearch of [1, 0]) {
    const result = await DescribeTopics(
      { Filters: [{ Key: 'topicName', Values: [topicNameOrId] }], PreciseSearch: preciseSearch, Limit: 10 },
      region,
      opts
    );
    const topics = (result as any)?.Topics ?? [];
    const match = topics.find((t: any) => t.TopicName === topicNameOrId) ?? topics[0];
    if (match?.TopicId) {
      topicCache.set(cacheKey, { topicId: match.TopicId, expiresAt: Date.now() + TOPIC_CACHE_TTL_MS });
      return match.TopicId;
    }
  }
  console.warn(`[CLS] topic not found: "${topicNameOrId}" in region "${region}"`);
  return topicNameOrId; // return as-is, let the API surface the error
}

export class LogServiceDataSource extends DataSourceApi<QueryInfo, MyDataSourceOptions> {
  public readonly instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>;
  // 顶层 DataSource 引用，用于通过 postResource 调用后端 sign 资源接口（兼容 Grafana 7.x ~ 13+）
  public parentDs!: DataSourceWithBackend<any, any>;
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.instanceSettings = instanceSettings;
  }

  /** Resolve effective region: query region → datasource default region */
  private getRegion(queryRegion?: string): string {
    return queryRegion || this.instanceSettings.jsonData.region || '';
  }

  query(request: DataQueryRequest<QueryInfo>) {
    const { range, targets, scopedVars, maxDataPoints } = request;
    const [from, to] = [range.from, range.to].map((item) => item.valueOf()) as number[];
    const requestTargets = targets.map((target) => {
      const region = this.getRegion(
        target.logServiceParams?.region ? getTemplateSrv().replace(target.logServiceParams.region) : ''
      );
      const TopicId = target.logServiceParams?.TopicId ? getTemplateSrv().replace(target.logServiceParams.TopicId) : '';
      const Query = addQueryResultLimit(
        replaceClsIntervalMacro(
          replaceClsQueryWithTemplateSrv(target.logServiceParams?.Query || '', scopedVars),
          from,
          to,
          maxDataPoints
        ),
        target.logServiceParams
      );

      return {
        ...target,
        logServiceParams: {
          ...target.logServiceParams,
          region,
          TopicId,
          Query,
        },
      };
    });

    // 过滤后的有效 target 列表,需单独保存:framesArray 的下标与 activeTargets 一一对应,
    // 不能用 requestTargets 的原始下标(隐藏的 target 被过滤后会导致下标错位)。
    const activeTargets = requestTargets.filter(
      (target) => !target.hide && target.logServiceParams?.region && target.logServiceParams?.TopicId
    );
    const dataFramePromise: Promise<DataFrame[]>[] = activeTargets.map((target) =>
      resolveTopicId(target.logServiceParams?.TopicId as string, target.logServiceParams?.region as string, {
        instanceSettings: this.instanceSettings,
        ds: this.parentDs,
      }).then((topicId) =>
        SearchLog(
          {
            TopicId: topicId,
            Query:
              target.logServiceParams?.format === 'Log'
                ? getRawQuery(target.logServiceParams?.Query)
                : (target.logServiceParams?.Query as string),
            From: from,
            To: to,
            SyntaxRule: target.logServiceParams?.SyntaxRule,
            Limit: target.logServiceParams?.MaxResultNum,
          },
          target.logServiceParams?.region as string,
          { instanceSettings: this.instanceSettings, ds: this.parentDs }
        ).then((result) => ConvertSearchResultsToDataFrame(formatSearchLog(result), target, this.instanceSettings))
      )
    );

    const output$ = new Observable<DataQueryResponse>((subscriber) => {
      subscriber.next({ data: [], state: LoadingState.Loading });

      Promise.all(dataFramePromise)
        .then((framesArray) => {
          const processedFrames = [];
          for (let framesIndex = 0; framesIndex < framesArray.length; framesIndex += 1) {
            const frames = framesArray[framesIndex];
            const frameIndexTarget = activeTargets[framesIndex];
            for (const frame of frames) {
              // 给每个数据帧打上对应查询的 refId(A、B...),否则 Transform/面板的帧选择器无法区分多条查询。
              // 需在 toTimeSeriesMany 之前赋值,prepareTimeSeries 会把 frame.refId 透传给生成的时序帧。
              if (frameIndexTarget?.refId) {
                frame.refId = frameIndexTarget.refId;
              }
              // 如果是 Analysis 场景，且返回内容可转化为 TimeSeriesMany, 则进行处理以绘制时序图
              if (
                !frame?.meta?.preferredVisualisationType &&
                (!frameIndexTarget?.logServiceParams?.format || frameIndexTarget?.logServiceParams?.format === 'Graph')
              ) {
                const fieldTypeSet = new Set();
                frame.fields.forEach((field) => fieldTypeSet.add(field.type));
                if (
                  fieldTypeSet.has(FieldType.time) &&
                  fieldTypeSet.has(FieldType.string) &&
                  fieldTypeSet.has(FieldType.number)
                ) {
                  const timeSeriesMany = toTimeSeriesMany([frame]);
                  if (frame.fields.filter((item) => item.type === 'number')?.length === 1) {
                    timeSeriesMany.forEach((item) => {
                      item.fields.forEach((field) => {
                        if (field.type === FieldType.number) {
                          field.name = '';
                        }
                      });
                    });
                  }
                  processedFrames.splice(frame.fields.length, 0, ...timeSeriesMany);
                  continue;
                }
              }
              processedFrames.push(frame);
            }
          }
          subscriber.next({ data: processedFrames, state: LoadingState.Done });
          subscriber.complete();
        })
        .catch((e) => {
          subscriber.next({
            data: [],
            state: LoadingState.Error,
            error: {
              ...e,
              message: e?.message || e?.data?.message,
            },
          });
          subscriber.complete();
        });
    }).pipe(share());
    return output$;
  }

  async metricFindQuery(query: QueryInfo['logServiceParams'], options: any): Promise<MetricFindValue[]> {
    const logServiceParams = query;
    const region = this.getRegion(logServiceParams?.region ? getTemplateSrv().replace(logServiceParams.region) : '');
    const rawTopicId = logServiceParams?.TopicId ? getTemplateSrv().replace(logServiceParams.TopicId) : '';
    const Query = addQueryResultLimit(
      replaceClsIntervalMacro(
        replaceClsQueryWithTemplateSrv(logServiceParams?.Query as string),
        options.range!.from.valueOf(),
        options.range!.to.valueOf()
      ),
      logServiceParams
    );

    if (!options.range) {
      return [];
    }
    if (rawTopicId && Query) {
      const TopicId = await resolveTopicId(rawTopicId, region, {
        instanceSettings: this.instanceSettings,
        ds: this.parentDs,
      });
      const { analysisColumns, analysisRecords } = formatSearchLog(
        await SearchLog(
          {
            TopicId,
            Query,
            From: options.range!.from.valueOf(),
            To: options.range!.to.valueOf(),
            SyntaxRule: logServiceParams?.SyntaxRule,
            Limit: logServiceParams?.MaxResultNum,
          },
          region,
          {
            instanceSettings: this.instanceSettings,
            ds: this.parentDs,
          }
        )
      );
      if (analysisColumns.length > 0 && analysisRecords.length > 0) {
        const firstColumn = analysisColumns[0];
        return analysisRecords.map((record) => ({
          text: record[firstColumn.Name as string],
          value: record[firstColumn.Name as string],
        }));
      }
    }
    return [];
  }

  async testDatasource() {
    try {
      await SearchLog(
        {
          TopicId: '',
          Query: '',
          From: moment().subtract(1, 'h').valueOf(),
          To: moment().valueOf(),
          SyntaxRule: 1,
          Limit: 100,
        },
        this.getRegion() || 'ap-shanghai',
        {
          instanceSettings: this.instanceSettings,
          ds: this.parentDs,
        }
      );
      return {
        status: 'success',
        message: 'DatSource Connection OK',
      };
    } catch (e: any) {
      if (e?.code?.startsWith('AuthFailure')) {
        return {
          status: 'error',
          title: e.code,
          message: e.message,
        };
      }
      return {
        status: 'success',
        message: 'DatSource Connection OK',
      };
    }
  }

  getLogsVolumeDataProvider(): Observable<DataQueryResponse> | undefined {
    return undefined;
  }

  showContextToggle = (row: LogRowModel) => {
    const metaField = row.dataFrame.fields.find((item) => item.name === LogFieldReservedName.META);
    try {
      if (metaField?.labels?.region && metaField?.labels.TopicId) {
        const metaValue: Pick<LogInfo, 'PkgId' | 'PkgLogId'> = JSON.parse(metaField.values.get(row.rowIndex));
        if (metaValue?.PkgId && metaValue?.PkgLogId) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  getLogRowContext = async (row: LogRowModel, options?: RowContextOptions) => {
    const { limit = 10, direction = 'BACKWARD' } = options || {};
    const timeField = row.dataFrame.fields.find((item) => item.name === LogFieldReservedName.TIMESTAMP);
    const metaField = row.dataFrame.fields.find((item) => item.name === LogFieldReservedName.META);
    if (!timeField || !metaField?.labels || !limit) {
      return { data: [], state: LoadingState.Done };
    }

    try {
      const metaValue: Pick<LogInfo, 'PkgId' | 'PkgLogId'> = JSON.parse(metaField.values.get(row.rowIndex));
      const bTime = moment(timeField.values.get(row.rowIndex)).format('YYYY-MM-DD HH:MM:SS.SSS');
      const logContext = await DescribeLogContext(
        {
          TopicId: metaField?.labels.TopicId,
          BTime: bTime,
          PkgId: metaValue.PkgId,
          PkgLogId: Number(metaValue.PkgLogId),
          PrevLogs: direction === 'BACKWARD' ? limit : 0,
          NextLogs: direction !== 'BACKWARD' ? limit : 0,
        },
        metaField?.labels.region,
        { instanceSettings: this.instanceSettings, ds: this.parentDs }
      );
      const frame = ConvertLogContextToDataFrame(logContext);
      return {
        data: [frame],
        state: LoadingState.Done,
        error: undefined,
      };
    } catch (e) {
      return {
        data: [],
        state: LoadingState.Error,
        error: e as DataQueryError,
      };
    }
  };
}
