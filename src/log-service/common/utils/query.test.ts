import { calcClsInterval, CLS_SQL_MACRO_NAMES, replaceClsIntervalMacro, replaceClsSqlMacros } from './query';

const h = (n: number) => n * 3_600_000;
const d = (n: number) => n * 86_400_000;

describe('calcClsInterval', () => {
  // rawSeconds = ceil(rangeMs / 150 / 1000)
  it('1h range → 24 second  (3600000/150/1000 = 24)', () => {
    expect(calcClsInterval(0, h(1))).toBe('24 second');
  });

  it('6h range → 144 second  (21600000/150/1000 = 144)', () => {
    expect(calcClsInterval(0, h(6))).toBe('144 second');
  });

  it('24h range → 576 second  (86400000/150/1000 = 576)', () => {
    expect(calcClsInterval(0, h(24))).toBe('576 second');
  });

  it('7d range → 4032 second  (604800000/150/1000 = 4032)', () => {
    expect(calcClsInterval(0, d(7))).toBe('4032 second');
  });

  it('30d range → 17280 second', () => {
    expect(calcClsInterval(0, d(30))).toBe('17280 second');
  });

  it('very short range → 1 second (minimum)', () => {
    expect(calcClsInterval(0, 1000)).toBe('1 second');
  });

  it('respects custom maxDataPoints', () => {
    // 6h / 1000 = 21.6s → ceil = 22 second
    expect(calcClsInterval(0, h(6), 1000)).toBe('22 second');
  });

  it('works with non-zero from', () => {
    const base = 1_700_000_000_000;
    expect(calcClsInterval(base, base + h(6))).toBe('144 second');
  });
});

describe('CLS SQL macro metadata', () => {
  it('includes Grafana SQL macro names plus CLS interval aliases', () => {
    expect(CLS_SQL_MACRO_NAMES).toEqual([
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
    ]);
  });
});

describe('replaceClsSqlMacros interval aliases', () => {
  it('replaces $__cls_interval in SQL query', () => {
    const query =
      '* | SELECT histogram(cast(__TIMESTAMP__ as timestamp), interval $__cls_interval) as time, count(*) as cnt';
    const result = replaceClsSqlMacros(query, 0, h(6));
    expect(result).toBe(
      '* | SELECT histogram(cast(__TIMESTAMP__ as timestamp), interval 144 second) as time, count(*) as cnt',
    );
  });

  it('replaces $__interval as Grafana SQL compatible alias', () => {
    const query = '* | SELECT histogram(cast(__TIMESTAMP__ as timestamp), interval $__interval) as time';
    expect(replaceClsSqlMacros(query, 0, h(24))).toBe(
      '* | SELECT histogram(cast(__TIMESTAMP__ as timestamp), interval 576 second) as time',
    );
  });

  it('replaces multiple occurrences', () => {
    const query = 'SELECT $__cls_interval, $__interval FROM t';
    const result = replaceClsSqlMacros(query, 0, h(24));
    expect(result).toBe('SELECT 576 second, 576 second FROM t');
  });

  it('returns query unchanged when macro is absent', () => {
    const query = '* | SELECT count(*) FROM t';
    expect(replaceClsSqlMacros(query, 0, h(6))).toBe(query);
  });

  it('handles empty string', () => {
    expect(replaceClsSqlMacros('', 0, h(1))).toBe('');
  });

  it('replaces $__cls_interval_ms and $__interval_ms with exact bucket milliseconds', () => {
    const query = 'count(*) / ($__cls_interval_ms / 60000.0) as rpm, $__interval_ms as bucket_ms';
    expect(replaceClsSqlMacros(query, 0, h(6))).toBe('count(*) / (144000 / 60000.0) as rpm, 144000 as bucket_ms');
  });

  it('$__cls_interval_ms is not corrupted by $__cls_interval replacement', () => {
    const query = '$__cls_interval_ms $__cls_interval $__interval_ms $__interval';
    expect(replaceClsSqlMacros(query, 0, h(1))).toBe('24000 24 second 24000 24 second');
  });

  it('keeps deprecated replaceClsIntervalMacro compatible', () => {
    expect(replaceClsIntervalMacro('$__cls_interval_ms $__cls_interval', 0, h(12))).toBe('288000 288 second');
  });
});

describe('replaceClsSqlMacros Grafana SQL time macros', () => {
  const fromMs = 1_700_000_000_000;
  const toMs = fromMs + h(6);

  it('expands $__timeGroup to CLS histogram expression', () => {
    const query = '* | select $__timeGroup(__TIMESTAMP__, $__interval), count(*) as cnt group by 1';
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      '* | select histogram(cast(__TIMESTAMP__ as timestamp), interval 144 second), count(*) as cnt group by 1',
    );
  });

  it('expands $__timeGroupAlias with time alias', () => {
    const query = '* | select $__timeGroupAlias(__TIMESTAMP__, 5 minute), count(*) group by time';
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      '* | select histogram(cast(__TIMESTAMP__ as timestamp), interval 5 minute) as time, count(*) group by time',
    );
  });

  it('uses $__interval when $__timeGroup interval argument is omitted', () => {
    const query = '* | select $__timeGroupAlias(__TIMESTAMP__), count(*) group by time';
    expect(replaceClsSqlMacros(query, fromMs, toMs, 1000)).toBe(
      '* | select histogram(cast(__TIMESTAMP__ as timestamp), interval 22 second) as time, count(*) group by time',
    );
  });

  it('expands $__time and avoids double casting existing timestamp expressions', () => {
    expect(replaceClsSqlMacros('$__time(__TIMESTAMP__)', fromMs, toMs)).toBe(
      'cast(__TIMESTAMP__ as timestamp) as time',
    );
    expect(replaceClsSqlMacros('$__time(cast(ts as timestamp))', fromMs, toMs)).toBe('cast(ts as timestamp) as time');
  });

  it('expands $__timeEpoch', () => {
    expect(replaceClsSqlMacros('$__timeEpoch(__TIMESTAMP__)', fromMs, toMs)).toBe(
      'to_unixtime(cast(__TIMESTAMP__ as timestamp)) as time',
    );
  });

  it('expands $__timeFilter and zero-arg time bounds', () => {
    const query = '* | select count(*) where $__timeFilter(__TIMESTAMP__) and ts >= $__timeFrom() and ts <= $__timeTo';
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      `* | select count(*) where __TIMESTAMP__ >= ${fromMs} AND __TIMESTAMP__ <= ${toMs} and ts >= ${fromMs} and ts <= ${toMs}`,
    );
  });

  it('parses nested comma expressions inside macro arguments', () => {
    const query = "* | select $__timeGroupAlias(date_parse(ts, '%Y-%m-%d,%H:%i:%s'), $__interval), count(*)";
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      "* | select histogram(date_parse(ts, '%Y-%m-%d,%H:%i:%s'), interval 144 second) as time, count(*)",
    );
  });
});

describe('replaceClsSqlMacros Grafana SQL unix epoch macros', () => {
  const fromMs = 1_700_000_000_000;
  const toMs = fromMs + h(6);

  it('expands $__unixEpochFilter', () => {
    expect(replaceClsSqlMacros('$__unixEpochFilter(epoch_s)', fromMs, toMs)).toBe(
      'epoch_s >= 1700000000 AND epoch_s <= 1700021600',
    );
  });

  it('expands $__unixEpochNanoFilter and nano bounds', () => {
    const query = '$__unixEpochNanoFilter(epoch_ns) $__unixEpochNanoFrom() $__unixEpochNanoTo';
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      'epoch_ns >= 1700000000000000000 AND epoch_ns <= 1700021600000000000 1700000000000000000 1700021600000000000',
    );
  });

  it('expands unix epoch group macros using from_unixtime', () => {
    const query = '$__unixEpochGroupAlias(epoch_s, $__interval), $__unixEpochGroup(epoch_s, 5 minute)';
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      'histogram(from_unixtime(epoch_s), interval 144 second) as time, histogram(from_unixtime(epoch_s), interval 5 minute)',
    );
  });
});
