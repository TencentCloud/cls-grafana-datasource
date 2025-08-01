import { DataSourceInstanceSettings } from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import _ from 'lodash-es';

import { IApiError, IRegionItem, IResourceRegionInfo } from './interface';
import * as TYPES from './types';
import { MyDataSourceOptions } from '../../types';
import { GetRequestParams, GetServiceAPIInfo } from '../constants';

/**
 * 云API请求
 * 入参 data内字段 请全部大写
 * 出参 全部大写，不再转换
 */
export interface IRequestParam {
  region?: string;
  action: string;
  data: any;
}

export interface ICapiRequestParam extends IRequestParam {
  serviceType: string;
}

/** 通用请求参数。instanceSettings目前无法单例化，后续尝试优化API请求调用方法 */
interface IRequestOpts {
  // 用于调用后端 Sign 方法
  instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>;
  // internal?: boolean;
  // clientTimeout?: number;
}

/**
 * 云API请求
 */
export async function capiRequest({ serviceType, region, action, data }: ICapiRequestParam, opts: IRequestOpts) {
  const { instanceSettings } = opts;
  const serviceInfo = GetServiceAPIInfo(serviceType, region);
  const backendSrc = getBackendSrv();
  const requestOptions = await GetRequestParams(
    { url: instanceSettings.url + serviceInfo.path, data },
    serviceType,
    {
      region: getTemplateSrv().replace(region),
      action,
    },
    '', // 这个参数内部没有使用？
    instanceSettings.id,
    backendSrc,
  );
  return backendSrc
    .datasourceRequest(requestOptions)
    .then((response) => {
      const result = _.get(response, 'data.Response', {});
      if (result.Error) {
        // eslint-disable-next-line no-throw-literal,@typescript-eslint/consistent-type-assertions
        throw {
          name: result.Error.Code,
          code: result.Error.Code,
          message: result.Error.Message,
          data: {
            Response: result,
          },
        } as IApiError;
      }
      return result;
    })
    .catch((error: Error) => {
      console.error('error', error);
      throw error;
    });
}

/**
 * CLS 云api v3 请求
 */
export async function clsCapiRequest({ action, region, data = {} }: IRequestParam, opts: IRequestOpts) {
  return capiRequest(
    {
      serviceType: 'cls',
      region,
      action,
      data,
    },
    {
      ...opts,
    },
  );
}

/**
 * REGION 云api v3 请求
 */
export async function regionCapiRequest({ action, region, data = {} }: IRequestParam, opts: IRequestOpts) {
  return capiRequest(
    {
      serviceType: 'region',
      region,
      action,
      data,
    },
    {
      ...opts,
    },
  );
}

/** 本接口用于搜索日志, 该接口除受默认接口请求频率限制外，针对单个日志主题，并发数不能超过15 */
export async function SearchLog(
  data: TYPES.SearchLogParams,
  region: string,
  opts: IRequestOpts,
): Promise<TYPES.SearchLogResult> {
  return clsCapiRequest(
    {
      action: 'SearchLog',
      region,
      data: {
        UseNewAnalysis: true,
        ...data,
      },
    },
    opts,
  );
}

/** 本接口用于搜索日志上下文附近的内容 */
export async function DescribeLogContext(
  data: TYPES.DescribeLogContextParams,
  region: string,
  opts: IRequestOpts,
): Promise<TYPES.DescribeLogContextResult> {
  return clsCapiRequest(
    {
      action: 'DescribeLogContext',
      data,
      region,
    },
    opts,
  );
}

/**  本接口用于获取日志主题列表，支持分页 */
export async function DescribeTopics(
  data: TYPES.DescribeTopicsParams,
  region: string,
  opts: IRequestOpts,
): Promise<TYPES.DescribeTopicsResult> {
  return clsCapiRequest(
    {
      action: 'DescribeTopics',
      data,
      region,
    },
    opts,
  );
}

/**
 * @description 请求当前用户支持cls所有地域，已做白名单过滤
 */
async function DescribeRegionsAndZonesRequest(product: string, opts: IRequestOpts): Promise<IResourceRegionInfo[]> {
  return regionCapiRequest({ action: 'DescribeRegionsAndZones', data: { Product: product } }, opts).then(
    (data) => data.ResourceRegionSet,
  );
}

export async function DescribeRegions(opts: IRequestOpts): Promise<{ regionList: IRegionItem[] }> {
  return DescribeRegionsAndZonesRequest('cls', opts).then((clsRegions) => ({
    regionList: (clsRegions || []).map(
      ({ Region, RegionId, RegionName, RegionShortName, RegionTypeMC, RegionType, Location }) => {
        const regionItem: IRegionItem = {
          region: Region,
          regionId: Number(RegionId),
          regionName: RegionName,
          regionShortName: RegionShortName,

          oversea: typeof RegionTypeMC === 'number' ? Boolean(RegionTypeMC) : RegionType === '海外',
          area: Location,
        };
        return regionItem;
      },
    ),
  }));
}
