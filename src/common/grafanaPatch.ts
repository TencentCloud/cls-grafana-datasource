/**
 * Return the first string or non-time field as the value
 *
 * @beta
 */
import { DataFrame, FieldType, MetricFindValue } from '@grafana/data'

export function frameToMetricFindValue(frame: DataFrame): MetricFindValue[] {
  if (!frame || !frame.length) {
    return []
  }

  const values: MetricFindValue[] = []
  let field = frame.fields.find((f) => f.type === FieldType.string)
  if (!field) {
    field = frame.fields.find((f) => f.type !== FieldType.time)
  }
  if (field) {
    for (let i = 0; i < field.values.length; i++) {
      values.push({ text: String(field.values.get(i)) })
    }
  }
  return values
}
