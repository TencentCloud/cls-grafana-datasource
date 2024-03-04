import { FieldType } from '@grafana/data';
import moment from 'moment';

import { IAnalysisColumn } from '../model/interface';

const ProcessorUtils = {
  timestampWithTimeZoneRegex: /(\w+)\[[\w/]+]/g,
};

/** Presto类型与FieldType转化表
 * @doc https://iwiki.woa.com/pages/viewpage.action?pageId=905584985 */
const PrestoAndFieldTypeMap: Omit<IAnalysisColumn, 'Name' | 'Type'>[] = [
  /** 时间类型分为两类，包含日期和不包含日期，不包含日期的转成字符类型 */
  {
    prestoTypeRegex: /^timestamp with time zone$/,
    fieldType: FieldType.time,
    // 包含时区的时间数据，可能带有额外的zone信息，这里进行清理。eg: 2021-11-26T18:41:24+08:00[Asia/Shanghai]
    processor: (value: string) => {
      const newValue = String(value).replace(ProcessorUtils.timestampWithTimeZoneRegex, '$1');
      const time = moment(newValue);
      if (time.isValid()) {
        return time.valueOf();
      }
      return value;
    },
  },
  {
    prestoTypeRegex: /^timestamp$|^date$|^datetime$/,
    fieldType: FieldType.time,
    // 将所有时间类型转化为时间戳。
    // 小问题：如果用户设置了数据转化，且将字段配置为普通维度，此时展示的不是后台返回的字符串，而是时间戳文本。方案：推荐用户使用 time_series 函数生成时间字符串
    processor: (value: any): number | string => {
      const time = moment(value);
      if (time.isValid()) {
        return time.valueOf();
      }
      return value;
    },
  },
  {
    prestoTypeRegex: /^time$|^time with time zone$/,
    fieldType: FieldType.string,
    // processor: null,
  },
  /** 数字类型。整数、浮点数、定点数 */
  {
    prestoTypeRegex: /^tinyint$|^samllint$|^integer$|^bigint$|^long$/,
    fieldType: FieldType.number,
    // processor: Number,
  },
  {
    prestoTypeRegex: /^real$|^double$|^decimal$/,
    fieldType: FieldType.number,
    // processor: Number,
  },
  /** 字符串。字符串和单字符 */
  {
    prestoTypeRegex: /^varchar$|^char$|^text$|^keyword$/,
    fieldType: FieldType.string,
    // processor: String,
  },
  {
    prestoTypeRegex: /^boolean$/,
    fieldType: FieldType.boolean,
    // processor: Boolean,
  },

  /** 未定情况，做简单降级方案 */
  {
    prestoTypeRegex: /^uuid$/,
    fieldType: FieldType.string,
    // processor: String,
  },
  {
    prestoTypeRegex: /^ipaddress$/,
    fieldType: FieldType.string,
    // processor: String,
  },
  {
    prestoTypeRegex: /^array\(.*\)$/,
    fieldType: FieldType.other,
    // processor: Array.from,
  },
  {
    prestoTypeRegex: /^json$/,
    fieldType: FieldType.other,
    // processor: JSON.parse,
  },
  {
    prestoTypeRegex: /^map\(.*\)$/, // /^map\([\w\s,]+,[\w\s,]+\)$/,
    fieldType: FieldType.other,
    // processor: (i) => i,
  },
  {
    prestoTypeRegex: /^varbinary$/,
    fieldType: FieldType.other,
    // processor: Array.from,
  },
  {
    prestoTypeRegex: /^interval$/,
    fieldType: FieldType.other,
    // processor: String,
  },
  {
    prestoTypeRegex: /^row$/,
    fieldType: FieldType.other,
    // processor: String,
  },
];

export function getFieldTypeByPrestoType(prestoType: string): Omit<IAnalysisColumn, 'Name' | 'Type'> {
  return (
    PrestoAndFieldTypeMap.find((item) => item.prestoTypeRegex.test(prestoType)) || {
      prestoTypeRegex: /.*/,
      fieldType: FieldType.other,
    }
  );
}
