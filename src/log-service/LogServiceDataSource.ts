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
import { getTemplateSrv } from '@grafana/runtime';
import { RowContextOptions } from '@grafana/ui/components/Logs/LogRowContextProvider';
import moment from 'moment';
import { Observable } from 'rxjs';
import { share } from 'rxjs/operators';

import {
  ConvertLogContextToDataFrame,
  ConvertSearchResultsToDataFrame,
  formatSearchLog,
  LogFieldReservedName,
} from './common/format';
import { DescribeLogContext, LogInfo, SearchLog } from '../common/model';
import { MyDataSourceOptions, QueryInfo } from '../types';
import { toTimeSeriesMany } from './common/format/prepareTimeSeries';
import { addQueryResultLimit, getRawQuery, replaceClsQueryWithTemplateSrv } from './common/utils/query';

export class LogServiceDataSource extends DataSourceApi<QueryInfo, MyDataSourceOptions> {
  public readonly instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>;
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.instanceSettings = instanceSettings;
  }

  query(request: DataQueryRequest<QueryInfo>) {
    const { range, targets, scopedVars } = request;
    const [from, to] = [range.from, range.to].map((item) => item.valueOf()) as number[];
    const requestTargets = targets.map((target) => {
      const region = target.logServiceParams?.region ? getTemplateSrv().replace(target.logServiceParams.region) : '';
      const TopicId = target.logServiceParams?.TopicId ? getTemplateSrv().replace(target.logServiceParams.TopicId) : '';
      const Query = addQueryResultLimit(
        replaceClsQueryWithTemplateSrv(target.logServiceParams?.Query || '', scopedVars),
        target.logServiceParams,
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

    const dataFramePromise: Promise<DataFrame[]>[] = requestTargets
      .filter((target) => !target.hide && target.logServiceParams?.region && target.logServiceParams?.TopicId)
      .map((target) =>
        SearchLog(
          {
            TopicId: target.logServiceParams?.TopicId as string,
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
          { instanceSettings: this.instanceSettings },
        ).then((result) => ConvertSearchResultsToDataFrame(formatSearchLog(result), target, this.instanceSettings)),
      );

    const output$ = new Observable<DataQueryResponse>((subscriber) => {
      subscriber.next({ data: [], state: LoadingState.Loading });

      Promise.all(dataFramePromise)
        .then((framesArray) => {
          const processedFrames = [];
          for (let framesIndex = 0; framesIndex < framesArray.length; framesIndex += 1) {
            const frames = framesArray[framesIndex];
            for (const frame of frames) {
              // 如果是 Analysis 场景，且返回内容可转化为 TimeSeriesMany, 则进行处理以绘制时序图
              const frameIndexTarget = requestTargets[framesIndex];
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
    const region = logServiceParams?.region ? getTemplateSrv().replace(logServiceParams.region) : '';
    const TopicId = logServiceParams?.TopicId ? getTemplateSrv().replace(logServiceParams.TopicId) : '';
    const Query = addQueryResultLimit(
      replaceClsQueryWithTemplateSrv(logServiceParams?.Query as string),
      logServiceParams,
    );

    if (!options.range) {
      return [];
    }
    if (region && TopicId && Query) {
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
          },
        ),
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
      // 使用SearchLog接口直接查询日志，根据是否遇到鉴权错误，判断秘钥合法性
      await SearchLog(
        {
          TopicId: '',
          Query: '',
          From: moment().subtract(1, 'h').valueOf(),
          To: moment().valueOf(),
          SyntaxRule: 1,
          Limit: 100,
        },
        'ap-shanghai',
        {
          instanceSettings: this.instanceSettings,
        },
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

  /** histogram support
   * @link https://github.com/grafana/grafana/blob/942be4215afaea27757fb3a034126452aaf3fab2/public/app/plugins/datasource/loki/datasource.ts#L115-L115
   */
  getLogsVolumeDataProvider(/* request: DataQueryRequest<QueryInfo> */): Observable<DataQueryResponse> | undefined {
    return undefined;
  }

  /** context disabled */
  showContextToggle = (row: LogRowModel) => {
    /** ConvertLogJsonToDataFrameDTO 函数中，将上下文相关值处理为 LogFieldReservedName.META field */
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
        { instanceSettings: this.instanceSettings },
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
