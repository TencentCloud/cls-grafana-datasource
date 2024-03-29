import { DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import _ from 'lodash';

import { sliceLength } from '../common/constants';
import { capiRequest } from '../common/model';
import { MyDataSourceOptions, QueryInfo } from '../types';

export interface MetricQuery {
  servicetype: string;
  action: string;
  region: string;
  field: string;
  id: string;
  name: string;
  display?: string;
  [x: string]: any;
}

// parse template variable query params
export function ParseMetricQuery(query = '') {
  if (!query) {
    return {};
  }
  const result = {};
  const queries = _.split(query, '&');
  _.forEach(queries, (item) => {
    const str = _.split(item, '=');
    if (_.trim(_.get(str, '0', ''))) {
      let val = _.trim(_.get(str, '1', ''));
      try {
        val = JSON.parse(val);
      } catch (e) {
        // console.log({ val });
      }
      result[_.toLower(_.trim(_.get(str, '0', '')))] = val;
    }
  });
  return result;
}

export class CloudApiDataSourcce extends DataSourceApi<QueryInfo, MyDataSourceOptions> {
  private readonly instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>;
  private readonly templateSrv: any;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.instanceSettings = instanceSettings;
    this.templateSrv = getTemplateSrv();
  }

  query() {
    return undefined;
  }

  testDatasource(): Promise<any> {
    return Promise.resolve(undefined);
  }

  /**
   * 获取模板变量的选择项列表
   *
   * @param query 模板变量配置填写的 Query 参数字符串
   */
  async metricFindQuery(query: string) {
    const queries = ParseMetricQuery(query) as MetricQuery;
    const { action, servicetype: serviceType, display, payload = {}, field, id, name } = queries;
    let { region } = queries;
    if (!serviceType || !action) {
      throw new Error('Must include Region, ServiceType and Action.');
    }

    // 支持payload里传入模板变量
    if (_.isObject(payload)) {
      _.forEach(payload, (value, key) => {
        payload[key] = _.isString(value) ? this.getVariable(value) : value;
      });
    }

    region = this.getVariable(region); // 将模板region转换为真实值

    // 查询地域列表
    const regionQuery = action.match(/^DescribeRegions$/i);
    if (regionQuery) {
      return this.getRegions({ ...queries, region });
    }

    // 查询实例列表
    if (!id || !name || !field) {
      throw new Error('Must include field, id and name.');
    }
    const result = await this.getVariableInstances({ ...queries, region });

    return result.flatMap((item) => {
      const insAlias = this.formatVarDisplay(item, display, name);

      item._InstanceAliasValue = insAlias; // FIXME:

      if (!item[name]) return [];
      return [
        {
          text: insAlias,
          value: item[id],
        },
      ];
    });
  }

  getRegions(query: MetricQuery): any {
    const { region, action, servicetype: serviceType, payload = {} } = query;
    return capiRequest(
      {
        serviceType,
        region,
        action,
        data: payload,
      },
      { instanceSettings: this.instanceSettings },
    ).then((response) =>
      _.filter(
        _.map(response.RegionSet || [], (item) => ({
          text: item.RegionName,
          value: item.Region,
          RegionState: item.RegionState,
        })),
        (item) => item.RegionState === 'AVAILABLE',
      ),
    );
  }

  // 获取某个变量的实际值，this.templateSrv.replace() 函数返回实际值的字符串
  private getVariable(metric?: string) {
    const rs = this.templateSrv.replace((metric || '').trim());
    const valStr = rs.match(/\{([\w-,]+)\}/);
    // 判断是否为多选
    if (valStr) {
      return valStr[1].split(',');
    }
    return rs;
  }

  private async getVariableInstances(query: MetricQuery): Promise<any[]> {
    const { region, action, servicetype: serviceType, payload = {}, field } = query;
    let result: any[] = [];
    const params = { ...{ Offset: 0, Limit: 100 }, ...payload };

    return capiRequest(
      {
        serviceType,
        region,
        action,
        data: params,
      },
      { instanceSettings: this.instanceSettings },
    ).then((response) => {
      result = _.get(response, field) ?? _.get(response, `Result.${field}`) ?? [];
      const total =
        response.TotalCount ?? response.TotalCnt ?? response.TotalNumber ?? _.get(response, `Result.TotalCount`) ?? 0;
      if (result.length >= total) {
        return result;
      }
      const param = sliceLength(total, params?.Limit || 100);
      const promises: any[] = [];
      _.forEach(param, (item) => {
        promises.push(this.getInstances(query, { ...item, ...payload }));
      });
      return Promise.all(promises)
        .then((responses) => {
          _.forEach(responses, (item) => {
            result = _.concat(result, item);
          });
          return result;
        })
        .catch((error) => {
          console.error(error);
          return result;
        });
    });
  }

  private async getInstances(query: MetricQuery, payload = {}) {
    const { region, action, servicetype: serviceType, field } = query;
    return capiRequest(
      {
        serviceType,
        region,
        action,
        data: { Offset: 0, Limit: 100, ...payload },
      },
      { instanceSettings: this.instanceSettings },
    ).then((response) => _.get(response, field) ?? _.get(response, `Result.${field}`) ?? []);
  }

  private formatVarDisplay(instance: Record<string, any>, displayTpl: string | undefined, instanceAlias: string) {
    // 获取display=aaa${InstanceName}bbb${InstanceId}ccc
    if (displayTpl) {
      return displayTpl.replace(/\$\{(\w+)\}/g, (a, b) => {
        if (!b) {
          return '';
        }
        return this.getAliasValue(instance, b);
      });
    }
    return this.getAliasValue(instance, instanceAlias);
  }

  /* 格式化模板变量上的显示 */
  private getAliasValue(instance: Record<string, any>, alias: string) {
    const result = instance[alias];
    return Array.isArray(result) ? result.join() : result;
  }
}
