import * as _ from 'lodash'

export const QueryEditorFormatOptions = [
  { value: 'Graph', label: 'Graph, Pie, Gauge Panel' }, // 必定返回时间列，如果未输入时间列，则补一列时间0
  { value: 'Table', label: 'Table Panel' }, // 将原始日志或分析结果转化为Table
  { value: 'Log', label: 'Log Panel' }, // 只处理原始日志内容
]
