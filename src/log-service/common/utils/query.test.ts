import { calcClsInterval, replaceClsIntervalMacro } from './query';

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

describe('replaceClsIntervalMacro', () => {
  it('replaces $__cls_interval in SQL query', () => {
    const query =
      '* | SELECT histogram(cast(__TIMESTAMP__ as timestamp), interval $__cls_interval) as time, count(*) as cnt';
    const result = replaceClsIntervalMacro(query, 0, h(6));
    expect(result).toBe(
      '* | SELECT histogram(cast(__TIMESTAMP__ as timestamp), interval 144 second) as time, count(*) as cnt',
    );
  });

  it('replaces multiple occurrences', () => {
    const query = 'SELECT $__cls_interval, $__cls_interval FROM t';
    const result = replaceClsIntervalMacro(query, 0, h(24));
    expect(result).toBe('SELECT 576 second, 576 second FROM t');
  });

  it('returns query unchanged when macro is absent', () => {
    const query = '* | SELECT count(*) FROM t';
    expect(replaceClsIntervalMacro(query, 0, h(6))).toBe(query);
  });

  it('handles empty string', () => {
    expect(replaceClsIntervalMacro('', 0, h(1))).toBe('');
  });

  it('replaces $__cls_interval_ms with exact bucket milliseconds (6h → 144000)', () => {
    const query = 'count(*) / ($__cls_interval_ms / 60000.0) as rpm';
    expect(replaceClsIntervalMacro(query, 0, h(6))).toBe('count(*) / (144000 / 60000.0) as rpm');
  });

  it('replaces both $__cls_interval_ms and $__cls_interval in same query', () => {
    const query = 'histogram(ts, interval $__cls_interval), count(*) / ($__cls_interval_ms / 60000.0) as rpm';
    // 6h → 144 second = 144000ms
    expect(replaceClsIntervalMacro(query, 0, h(6))).toBe(
      'histogram(ts, interval 144 second), count(*) / (144000 / 60000.0) as rpm',
    );
  });

  it('$__cls_interval_ms and $__cls_interval are exactly consistent', () => {
    // 12h → ceil(43200000/150/1000) = 288 second = 288000ms
    const query = '$__cls_interval_ms $__cls_interval';
    expect(replaceClsIntervalMacro(query, 0, h(12))).toBe('288000 288 second');
  });

  it('$__cls_interval_ms is not corrupted by $__cls_interval replacement', () => {
    const query = '$__cls_interval_ms';
    expect(replaceClsIntervalMacro(query, 0, h(1))).toBe('24000');
  });
});
