import { getTemplateSrv } from '@grafana/runtime';

import { QueryInfo } from '../../../types';

const DEFAULT_MAX_DATA_POINTS = 150;
const MS_PER_SECOND = 1000;
const NS_PER_MS = 1_000_000;

export const CLS_SQL_MACRO_NAMES = [
  '$__time',
  '$__timeEpoch',
  '$__timeFilter',
  '$__timeFrom',
  '$__timeTo',
  '$__timeGroup',
  '$__timeGroupAlias',
  '$__unixEpochFilter',
  '$__unixEpochNanoFilter',
  '$__unixEpochNanoFrom',
  '$__unixEpochNanoTo',
  '$__unixEpochGroup',
  '$__unixEpochGroupAlias',
  '$__interval',
  '$__interval_ms',
  '$__cls_interval',
  '$__cls_interval_ms',
];

type MacroContext = {
  fromMs: number;
  toMs: number;
  maxDataPoints?: number;
};

/**
 * Compute the CLS SQL histogram interval string for the given time range.
 *
 * Uses raw seconds (ceil) matching Grafana's $__interval behavior — no
 * rounding to "nice" steps. This ensures $__cls_interval_ms is the exact
 * divisor for TPM/RPM rate normalization, giving consistent values across
 * different time range selections.
 *
 * Minimum bucket is 1 second.
 *
 * @example
 * calcClsInterval(0, 3_600_000)     // "24 second"  (1 h / 150)
 * calcClsInterval(0, 21_600_000)    // "144 second" (6 h / 150)
 * calcClsInterval(0, 86_400_000)    // "576 second" (24 h / 150)
 */
export function calcClsInterval(fromMs: number, toMs: number, maxDataPoints = DEFAULT_MAX_DATA_POINTS): string {
  const rawSeconds = getRawIntervalSeconds({ fromMs, toMs, maxDataPoints });
  return `${rawSeconds} second`;
}

/**
 * Replace CLS SQL macros and Grafana SQL-style macros in the query string.
 *
 * Supported aliases:
 * - `$__interval` / `$__interval_ms`
 * - `$__cls_interval` / `$__cls_interval_ms`
 *
 * Supported SQL macros, aligned with Grafana SQL macro names where possible:
 * - `$__time`, `$__timeEpoch`, `$__timeFilter`, `$__timeFrom`, `$__timeTo`
 * - `$__timeGroup`, `$__timeGroupAlias`
 * - `$__unixEpochFilter`, `$__unixEpochNanoFilter`, `$__unixEpochNanoFrom`, `$__unixEpochNanoTo`
 * - `$__unixEpochGroup`, `$__unixEpochGroupAlias`
 */
export function replaceClsSqlMacros(queryString: string, fromMs: number, toMs: number, maxDataPoints?: number): string {
  if (!queryString.includes('$__')) {
    return queryString;
  }

  const context: MacroContext = { fromMs, toMs, maxDataPoints };
  let result = queryString;

  result = replaceMacroFunction(result, '$__timeGroupAlias', (args) => {
    const [column, interval] = args;
    return `${toTimeGroupExpression(column, interval, context)} as time`;
  });
  result = replaceMacroFunction(result, '$__timeGroup', (args) => {
    const [column, interval] = args;
    return toTimeGroupExpression(column, interval, context);
  });
  result = replaceMacroFunction(result, '$__unixEpochGroupAlias', (args) => {
    const [column, interval] = args;
    return `${toUnixEpochGroupExpression(column, interval, context)} as time`;
  });
  result = replaceMacroFunction(result, '$__unixEpochGroup', (args) => {
    const [column, interval] = args;
    return toUnixEpochGroupExpression(column, interval, context);
  });
  result = replaceMacroFunction(result, '$__timeFilter', ([column]) => {
    const timeColumn = normalizeColumn(column);
    return `${timeColumn} >= ${fromMs} AND ${timeColumn} <= ${toMs}`;
  });
  result = replaceMacroFunction(result, '$__unixEpochFilter', ([column]) => {
    const timeColumn = normalizeColumn(column);
    return `${timeColumn} >= ${Math.floor(fromMs / MS_PER_SECOND)} AND ${timeColumn} <= ${Math.floor(
      toMs / MS_PER_SECOND,
    )}`;
  });
  result = replaceMacroFunction(result, '$__unixEpochNanoFilter', ([column]) => {
    const timeColumn = normalizeColumn(column);
    return `${timeColumn} >= ${fromMs * NS_PER_MS} AND ${timeColumn} <= ${toMs * NS_PER_MS}`;
  });
  result = replaceMacroFunction(result, '$__timeEpoch', ([column]) => {
    return `to_unixtime(${toTimestampExpression(column)}) as time`;
  });
  result = replaceMacroFunction(result, '$__time', ([column]) => {
    return `${toTimestampExpression(column)} as time`;
  });
  result = replaceZeroArgMacro(result, '$__timeFrom', String(fromMs));
  result = replaceZeroArgMacro(result, '$__timeTo', String(toMs));
  result = replaceZeroArgMacro(result, '$__unixEpochNanoFrom', String(fromMs * NS_PER_MS));
  result = replaceZeroArgMacro(result, '$__unixEpochNanoTo', String(toMs * NS_PER_MS));

  return replaceIntervalTokens(result, context);
}

/** @deprecated Use replaceClsSqlMacros. */
export function replaceClsIntervalMacro(
  queryString: string,
  fromMs: number,
  toMs: number,
  maxDataPoints?: number,
): string {
  return replaceClsSqlMacros(queryString, fromMs, toMs, maxDataPoints);
}

function getRawIntervalSeconds({ fromMs, toMs, maxDataPoints = DEFAULT_MAX_DATA_POINTS }: MacroContext): number {
  return Math.max(1, Math.ceil((toMs - fromMs) / maxDataPoints / MS_PER_SECOND));
}

function replaceIntervalTokens(queryString: string, context: MacroContext): string {
  const rawSeconds = getRawIntervalSeconds(context);
  const intervalMs = String(rawSeconds * MS_PER_SECOND);
  const interval = `${rawSeconds} second`;

  return queryString
    .replace(/\$__cls_interval_ms/g, intervalMs)
    .replace(/\$__interval_ms/g, intervalMs)
    .replace(/\$__cls_interval/g, interval)
    .replace(/\$__interval/g, interval);
}

function replaceZeroArgMacro(queryString: string, macroName: string, replacement: string): string {
  const withParentheses = replaceMacroFunction(queryString, macroName, () => replacement);
  return replaceBareMacro(withParentheses, macroName, replacement);
}

function replaceBareMacro(queryString: string, macroName: string, replacement: string): string {
  return queryString.replace(new RegExp(`${escapeRegExp(macroName)}(?![A-Za-z0-9_])`, 'g'), replacement);
}

function replaceMacroFunction(
  queryString: string,
  macroName: string,
  replacementFactory: (args: string[], rawArgs: string) => string,
): string {
  let result = '';
  let searchIndex = 0;

  while (searchIndex < queryString.length) {
    const macroIndex = queryString.indexOf(macroName, searchIndex);
    if (macroIndex < 0) {
      result += queryString.slice(searchIndex);
      break;
    }

    let openParenIndex = macroIndex + macroName.length;
    while (/\s/.test(queryString[openParenIndex] ?? '')) {
      openParenIndex += 1;
    }

    if (queryString[openParenIndex] !== '(') {
      result += queryString.slice(searchIndex, macroIndex + macroName.length);
      searchIndex = macroIndex + macroName.length;
      continue;
    }

    const closeParenIndex = findClosingParen(queryString, openParenIndex);
    if (closeParenIndex < 0) {
      result += queryString.slice(searchIndex, macroIndex + macroName.length);
      searchIndex = macroIndex + macroName.length;
      continue;
    }

    const rawArgs = queryString.slice(openParenIndex + 1, closeParenIndex);
    result += queryString.slice(searchIndex, macroIndex);
    result += replacementFactory(splitMacroArgs(rawArgs), rawArgs);
    searchIndex = closeParenIndex + 1;
  }

  return result;
}

function findClosingParen(input: string, openParenIndex: number): number {
  let depth = 0;
  let quote: string | undefined;

  for (let index = openParenIndex; index < input.length; index += 1) {
    const char = input[index];
    const previousChar = input[index - 1];

    if (quote) {
      if (char === quote && previousChar !== '\\') {
        quote = undefined;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '(') {
      depth += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function splitMacroArgs(rawArgs: string): string[] {
  const args: string[] = [];
  let argStart = 0;
  let depth = 0;
  let quote: string | undefined;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const char = rawArgs[index];
    const previousChar = rawArgs[index - 1];

    if (quote) {
      if (char === quote && previousChar !== '\\') {
        quote = undefined;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '(') {
      depth += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      continue;
    }

    if (char === ',' && depth === 0) {
      args.push(rawArgs.slice(argStart, index).trim());
      argStart = index + 1;
    }
  }

  args.push(rawArgs.slice(argStart).trim());
  return args.filter((arg) => arg.length > 0);
}

function toTimeGroupExpression(
  column: string | undefined,
  interval: string | undefined,
  context: MacroContext,
): string {
  return `histogram(${toTimestampExpression(column)}, interval ${normalizeInterval(interval, context)})`;
}

function toUnixEpochGroupExpression(
  column: string | undefined,
  interval: string | undefined,
  context: MacroContext,
): string {
  return `histogram(from_unixtime(${normalizeColumn(column)}), interval ${normalizeInterval(interval, context)})`;
}

function toTimestampExpression(column: string | undefined): string {
  const normalizedColumn = normalizeColumn(column);
  if (/^(cast|date_parse|from_iso8601_timestamp|from_unixtime)\s*\(/i.test(normalizedColumn)) {
    return normalizedColumn;
  }
  return `cast(${normalizedColumn} as timestamp)`;
}

function normalizeInterval(interval: string | undefined, context: MacroContext): string {
  return replaceIntervalTokens(interval?.trim() || '$__interval', context);
}

function normalizeColumn(column: string | undefined): string {
  return column?.trim() || '__TIMESTAMP__';
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
