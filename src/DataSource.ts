import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  LoadingState,
  LogRowModel,
  MetricFindValue,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import * as _ from 'lodash';
import { combineLatest, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { IS_DEVELOPMENT_ENVIRONMENT } from './common/constants';
import { LogServiceDataSource } from './log-service/LogServiceDataSource';
import { MyDataSourceOptions, QueryInfo, ServiceType, VariableQuery } from './types';

/** 顶层数据源，内部根据配置与请求情况，请求具体的业务（monitor or logService） */
export class DataSource extends DataSourceWithBackend<QueryInfo, MyDataSourceOptions> {
  readonly instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>;
  readonly logServiceDataSource: LogServiceDataSource;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.instanceSettings = instanceSettings;
    if (IS_DEVELOPMENT_ENVIRONMENT) {
      (window as any).tcDatasource = this;
    }

    this.logServiceDataSource = new LogServiceDataSource(this.instanceSettings);
    (this.logServiceDataSource as any).meta = this.meta;
  }

  query(request: DataQueryRequest<QueryInfo>): Observable<DataQueryResponse> {
    const logServiceTargets: QueryInfo[] = [];
    for (const target of request.targets) {
      if (target.serviceType === ServiceType.logService) {
        logServiceTargets.push(target);
      }
    }

    const EmptyDataQueryResponse: DataQueryResponse = { data: [], state: LoadingState.Done };
    return combineLatest<DataQueryResponse[]>([
      logServiceTargets.length
        ? this.logServiceDataSource.query({
            ..._.clone(_.omit(request, 'targets')),
            targets: logServiceTargets,
          })
        : of(EmptyDataQueryResponse),
    ]).pipe(
      map((responses: DataQueryResponse[]): DataQueryResponse => {
        const errResponse = responses.find((item) => item.state === LoadingState.Error);
        if (errResponse) {
          return errResponse;
        }
        if (!responses.every((item) => item.state === LoadingState.Done)) {
          return { data: [], state: LoadingState.Loading };
        }
        return {
          data: responses.map((item) => item.data).flat(1),
          state: LoadingState.Done,
        };
      }),
    );
  }

  async testDatasource() {
    // 如果子服务没有开启，则返回null
    const serviceTestResults = (await Promise.all([this.logServiceDataSource.testDatasource()])).filter(Boolean);

    if (serviceTestResults.length === 0) {
      return {
        status: 'error',
        message: "Nothing configured. At least one of the API's services must be configured.",
      };
    }

    const failedResult = serviceTestResults.find((item) => item?.status !== 'success');
    if (failedResult) {
      return failedResult;
    }
    return serviceTestResults[0];
  }

  async metricFindQuery(query: string | VariableQuery, options): Promise<MetricFindValue[]> {
    if (_.isString(query)) {
      return [];
    }
    if (query.serviceType === ServiceType.logService) {
      return this.logServiceDataSource.metricFindQuery(query.logServiceParams, options);
    }
    return [];
  }

  getLogRowContext = (row: LogRowModel, options) => this.logServiceDataSource.getLogRowContext(row, options);

  showContextToggle = (/* row: LogRowModel */) => false;
  // return this.logServiceDataSource.showContextToggle(row);
}
