import JSONBigInt from 'json-bigint';

import { getFieldTypeByPrestoType } from './prestoType';
import { IAnalysisColumn, ISearchLogResult, TYPES } from '../../../common/model';

const JSONBigString = JSONBigInt({ storeAsString: true });

export function formatSearchLog(param: TYPES.SearchLogResult): ISearchLogResult {
  const { Analysis, AnalysisRecords = [], Columns = [] } = param;
  const analysisColumns: IAnalysisColumn[] = [];
  const analysisRecords: Object[] = [];
  if (Analysis) {
    Columns.forEach((column) => {
      const analysisColumn = getFieldTypeByPrestoType(column.Type);
      analysisColumns.push({
        ...column,
        ...analysisColumn,
      });
    });
    AnalysisRecords.forEach((record) => {
      try {
        analysisRecords.push(JSON.parse(record));
      } catch (e) {
        analysisRecords.push({});
      }
    });

    for (const column of analysisColumns) {
      if (column.processor) {
        analysisRecords.forEach((record) => {
          // eslint-disable-next-line no-param-reassign
          record[column.Name] = column.processor(record[column.Name]);
        });
      }
    }
  }
  return {
    ...param,
    analysisRecords,
    analysisColumns,
  };
}

/** 解析stringify的日志，并处理 __TAG__字段 */
export function parseLogJsonStr(logJsonStr: string): Record<string, any> {
  try {
    const logJson = JSON.parse(logJsonStr);
    const tagContent = logJson.__TAG__;
    delete logJson.__TAG__;
    if (tagContent) {
      Object.entries(tagContent).forEach(([tagKey, tagValue]) => {
        logJson[`__TAG__.${tagKey}`] = tagValue;
      });
    }
    return logJson;
  } catch (e) {
    console.error('parseLogJsonStr', e);
    return {};
  }
}
/**
 *
 * @description json平铺
 * @param jsonData likes { a: { a1: 123}
 * @param parent
 * @param result
 * @returns Array likes {'a.a1': 123}
 */
export const parseJsonRec = (jsonData, parent = '', result: Record<string, any> = {}): Record<string, any> => {
  const keys = Object.keys(jsonData ?? {});

  if (keys.length > 0) {
    keys.forEach((subKey) => {
      const key = parent ? `${parent}.${subKey}` : subKey;
      if (typeof jsonData[subKey] === 'object') {
        parseJsonRec(jsonData[subKey], key, result);
      } else {
        result[key] = jsonData[subKey];
      }
    });
  }

  return result;
};
export const safeParseJson = (str: string) => {
  if (typeof str === 'string') {
    try {
      const obj = JSONBigString.parse(str);
      return obj;
    } catch (e) {
      return {};
    }
  }

  return {};
};
