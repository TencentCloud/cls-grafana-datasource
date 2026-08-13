import { CLS_SQL_MACRO_NAMES, replaceClsSqlMacros } from './query';

const h = (n: number) => n * 3_600_000;

const fromMs = 1_700_000_000_000;
const toMs = fromMs + h(6);

describe('CLS SQL macro metadata', () => {
  it('mirrors Grafana SQL macro names and interval aliases', () => {
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
    ]);
  });
});

describe('replaceClsSqlMacros interval aliases', () => {
  it('replaces $__interval and $__interval_ms', () => {
    const query = 'histogram(ts, interval $__interval), count(*) / ($__interval_ms / 60000.0) as rpm';
    expect(replaceClsSqlMacros(query, 0, h(6))).toBe(
      'histogram(ts, interval 144 second), count(*) / (144000 / 60000.0) as rpm'
    );
  });

  it('does not replace legacy CLS interval aliases', () => {
    const query = '$__cls_interval $__cls_interval_ms $__interval $__interval_ms';
    expect(replaceClsSqlMacros(query, 0, h(1))).toBe('$__cls_interval $__cls_interval_ms 24 second 24000');
  });

  it('returns query unchanged when no macro exists', () => {
    const query = '* | select count(*)';
    expect(replaceClsSqlMacros(query, 0, h(1))).toBe(query);
  });
});

describe('replaceClsSqlMacros time macros', () => {
  it('expands $__timeGroup to CLS histogram syntax', () => {
    const query = '* | select $__timeGroup(__TIMESTAMP__, $__interval), count(*) as cnt group by 1';
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      '* | select histogram(cast(__TIMESTAMP__ as timestamp), interval 144 second), count(*) as cnt group by 1'
    );
  });

  it('expands $__timeGroupAlias with time alias', () => {
    const query = '* | select $__timeGroupAlias(__TIMESTAMP__, $__interval), count(*) group by time';
    expect(replaceClsSqlMacros(query, fromMs, toMs, 1000)).toBe(
      '* | select histogram(cast(__TIMESTAMP__ as timestamp), interval 22 second) as time, count(*) group by time'
    );
  });

  it('converts Grafana shorthand intervals to CLS interval syntax', () => {
    const query = '* | select $__timeGroupAlias(__TIMESTAMP__, \'5m\'), $__timeGroup(ts, "1h")';
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      '* | select histogram(cast(__TIMESTAMP__ as timestamp), interval 5 minute) as time, histogram(cast(ts as timestamp), interval 1 hour)'
    );
  });

  it('uses $__interval when time group interval is omitted', () => {
    const query = '* | select $__timeGroupAlias(__TIMESTAMP__), count(*) group by time';
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      '* | select histogram(cast(__TIMESTAMP__ as timestamp), interval 144 second) as time, count(*) group by time'
    );
  });

  it('expands $__time and $__timeEpoch', () => {
    expect(replaceClsSqlMacros('$__time(__TIMESTAMP__)', fromMs, toMs)).toBe(
      'cast(__TIMESTAMP__ as timestamp) as time'
    );
    expect(replaceClsSqlMacros('$__time(cast(ts as timestamp))', fromMs, toMs)).toBe('cast(ts as timestamp) as time');
    expect(replaceClsSqlMacros('$__timeEpoch(__TIMESTAMP__)', fromMs, toMs)).toBe(
      'to_unixtime(cast(__TIMESTAMP__ as timestamp)) as time'
    );
  });

  it('expands $__timeFilter and zero-arg time bounds', () => {
    const query = '* | select count(*) where $__timeFilter(__TIMESTAMP__) and ts >= $__timeFrom() and ts <= $__timeTo';
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      '* | select count(*) where cast(__TIMESTAMP__ as timestamp) >= from_unixtime(1700000000) AND cast(__TIMESTAMP__ as timestamp) <= from_unixtime(1700021600) and ts >= from_unixtime(1700000000) and ts <= from_unixtime(1700021600)'
    );
  });

  it('parses nested comma expressions inside macro arguments', () => {
    const query = "* | select $__timeGroupAlias(date_parse(ts, '%Y-%m-%d,%H:%i:%s'), $__interval), count(*)";
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      "* | select histogram(date_parse(ts, '%Y-%m-%d,%H:%i:%s'), interval 144 second) as time, count(*)"
    );
  });
});

describe('replaceClsSqlMacros unix epoch macros', () => {
  it('expands $__unixEpochFilter', () => {
    expect(replaceClsSqlMacros('$__unixEpochFilter(epoch_s)', fromMs, toMs)).toBe(
      'epoch_s >= 1700000000 AND epoch_s <= 1700021600'
    );
  });

  it('expands $__unixEpochNanoFilter and nano bounds', () => {
    const query = '$__unixEpochNanoFilter(epoch_ns) $__unixEpochNanoFrom() $__unixEpochNanoTo';
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      'epoch_ns >= 1700000000000000000 AND epoch_ns <= 1700021600000000000 1700000000000000000 1700021600000000000'
    );
  });

  it('expands unix epoch group macros using from_unixtime', () => {
    const query = "$__unixEpochGroupAlias(epoch_s, $__interval), $__unixEpochGroup(epoch_s, '5m')";
    expect(replaceClsSqlMacros(query, fromMs, toMs)).toBe(
      'histogram(from_unixtime(epoch_s), interval 144 second) as time, histogram(from_unixtime(epoch_s), interval 5 minute)'
    );
  });
});
