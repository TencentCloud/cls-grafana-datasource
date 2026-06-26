import { getTemplateSrv } from '@grafana/runtime';

import { QueryInfo } from '../../../types';

const DEFAULT_MAX_DATA_POINTS = 150;
const MS_PER_SECOND = 1000;

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
];

type MacroContext = {
  fromMs: number;
  toMs: number;
  maxDataPoints?: number;
};

function getRawIntervalSeconds({ fromMs, toMs, maxDataPoints = DEFAULT_MAX_DATA_POINTS }: MacroContext): number {
  return Math.max(1, Math.ceil((toMs - fromMs) / maxDataPoints / MS_PER_SECOND));
}

function getInterval(context: MacroContext): string {
  return `${getRawIntervalSeconds(context)} second`;
}

function getIntervalMs(context: MacroContext): string {
  return String(getRawIntervalSeconds(context) * MS_PER_SECOND);
}

function getEpochSeconds(ms: number): string {
  return String(Math.floor(ms / MS_PER_SECOND));
}

function getUnixSeconds(ms: number): string {
  const seconds = Math.trunc(ms) / MS_PER_SECOND;
  if (Number.isInteger(seconds)) {
    return String(seconds);
  }
  return seconds.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function getEpochNano(ms: number): string {
  return `${Math.trunc(ms)}000000`;
}

function getTimeExpression(ms: number): string {
  return `from_unixtime(${getUnixSeconds(ms)})`;
}

function replaceIntervalMacros(queryString: string, context: MacroContext): string {
  return queryString.replace(/\$__interval_ms/g, getIntervalMs(context)).replace(/\$__interval/g, getInterval(context));
}

function normalizeColumn(column: string | undefined): string {
  return column?.trim() || '__TIMESTAMP__';
}

function normalizeInterval(interval: string | undefined, context: MacroContext): string {
  const value = replaceIntervalMacros(interval?.trim() || '$__interval', context).replace(/^['"]|['"]$/g, '');
  const durationMatch = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)$/i.exec(value);
  if (!durationMatch) {
    return value;
  }

  const amount = Number(durationMatch[1]);
  switch (durationMatch[2].toLowerCase()) {
    case 'ms':
      return `${Math.max(1, Math.ceil(amount / MS_PER_SECOND))} second`;
    case 's':
      return `${amount} second`;
    case 'm':
      return `${amount} minute`;
    case 'h':
      return `${amount} hour`;
    case 'd':
      return `${amount} day`;
    case 'w':
      return `${amount * 7} day`;
    default:
      return value;
  }
}

function toTimestampExpression(column: string | undefined): string {
  const normalizedColumn = normalizeColumn(column);
  if (/^(cast|date_parse|from_iso8601_timestamp|from_unixtime)\s*\(/i.test(normalizedColumn)) {
    return normalizedColumn;
  }
  return `cast(${normalizedColumn} as timestamp)`;
}

function toTimeGroupExpression(
  column: string | undefined,
  interval: string | undefined,
  context: MacroContext
): string {
  return `histogram(${toTimestampExpression(column)}, interval ${normalizeInterval(interval, context)})`;
}

function toUnixEpochGroupExpression(
  column: string | undefined,
  interval: string | undefined,
  context: MacroContext
): string {
  return `histogram(from_unixtime(${normalizeColumn(column)}), interval ${normalizeInterval(interval, context)})`;
}

function replaceZeroArgMacro(queryString: string, macroName: string, replacement: string): string {
  return replaceBareMacro(
    replaceMacroFunction(queryString, macroName, () => replacement),
    macroName,
    replacement
  );
}

function replaceBareMacro(queryString: string, macroName: string, replacement: string): string {
  return queryString.replace(new RegExp(`${escapeRegExp(macroName)}(?![A-Za-z0-9_])`, 'g'), replacement);
}

function replaceMacroFunction(
  queryString: string,
  macroName: string,
  replacementFactory: (args: string[], rawArgs: string) => string
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

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace Grafana SQL-style macros in CLS query strings.
 *
 * The macro names mirror Grafana SQL's common macro list, while the generated
 * expressions are adapted to CLS SQL syntax.
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
    const timeColumn = toTimestampExpression(column);
    return `${timeColumn} >= ${getTimeExpression(fromMs)} AND ${timeColumn} <= ${getTimeExpression(toMs)}`;
  });
  result = replaceMacroFunction(result, '$__unixEpochFilter', ([column]) => {
    const timeColumn = normalizeColumn(column);
    return `${timeColumn} >= ${getEpochSeconds(fromMs)} AND ${timeColumn} <= ${getEpochSeconds(toMs)}`;
  });
  result = replaceMacroFunction(result, '$__unixEpochNanoFilter', ([column]) => {
    const timeColumn = normalizeColumn(column);
    return `${timeColumn} >= ${getEpochNano(fromMs)} AND ${timeColumn} <= ${getEpochNano(toMs)}`;
  });
  result = replaceMacroFunction(result, '$__timeEpoch', ([column]) => {
    return `to_unixtime(${toTimestampExpression(column)}) as time`;
  });
  result = replaceMacroFunction(result, '$__time', ([column]) => {
    return `${toTimestampExpression(column)} as time`;
  });
  result = replaceZeroArgMacro(result, '$__timeFrom', getTimeExpression(fromMs));
  result = replaceZeroArgMacro(result, '$__timeTo', getTimeExpression(toMs));
  result = replaceZeroArgMacro(result, '$__unixEpochNanoFrom', getEpochNano(fromMs));
  result = replaceZeroArgMacro(result, '$__unixEpochNanoTo', getEpochNano(toMs));

  return replaceIntervalMacros(result, context);
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
