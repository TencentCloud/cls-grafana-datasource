import { getTemplateSrv } from '@grafana/runtime';

import { QueryInfo } from '../../../types';

/**
 * 检索语法切割正则
 */
export const CQL_SPLIT_PATTERN = /(\s*\|\s*)(select\b.*)/i;

/**
 * @param queryString 用户输入的原始检索语句
 * @description 判断用户是要检索原始日志，还是图表分析
 */
export function isQueryContainSql(queryString: string): boolean {
  const pattern = CQL_SPLIT_PATTERN;
  return pattern.test(queryString);
}

/**
 * 解析query，获取前面原始数据部分
 */
export function getRawQuery(queryString = ''): string {
  const querySplit = queryString.split(CQL_SPLIT_PATTERN);
  let rawQuery = '';
  if (querySplit.length === 1) {
    // lucene语法 => 只能用管道符
    // 这里只是照抄了后台逻辑，实际上此时接口返回sql_flag会是false，不用管
    rawQuery = queryString;
  } else if (querySplit.length >= 2) {
    rawQuery = querySplit[0];
  } else {
    // sql_flag为true时，后台有逻辑校验，代码不会走到这一步
    return '';
  }
  return rawQuery;
}

export function replaceClsQueryWithTemplateSrv(queryString: string, scopedVars: any = {}): string {
  const luceneQuery = getRawQuery(queryString ?? '');
  const sqlQuery = (queryString ?? '').slice(luceneQuery.length);
  const Query =
    getTemplateSrv().replace(luceneQuery, scopedVars, 'lucene') + getTemplateSrv().replace(sqlQuery, scopedVars, 'raw');
  return Query;
}

export function addQueryResultLimit(queryString: string, logServiceParams: QueryInfo['logServiceParams']) {
  const luceneQuery = getRawQuery(queryString ?? '');
  const sqlQuery = (queryString ?? '').slice(luceneQuery.length);
  const resultLimit = logServiceParams?.MaxResultNum;

  if (!resultLimit || !sqlQuery) {
    //  不包含 sql 或resultLimit取值有误 直接返回
    return queryString;
  }
  if (/limit/.test(sqlQuery)) {
    //  已有 limit 关键字，直接返回
    return queryString;
  }
  return `${queryString} limit ${resultLimit}`;
}
