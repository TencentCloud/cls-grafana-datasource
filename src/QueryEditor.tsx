import React, { ChangeEvent, PureComponent } from 'react'
import { InlineFieldRow, InlineField, Input, Select } from '@grafana/ui'
import { QueryEditorProps, SelectableValue } from '@grafana/data'
import * as _ from 'lodash'
import * as Constants from './common/constants'
import { DataSource } from './DataSource'
import { defaultQuery, MyDataSourceOptions, MyQuery } from './types'

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>

export class QueryEditor extends PureComponent<Props> {
  onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props
    const targetDataset: any = event?.target.dataset
    onChange({ ...query, [targetDataset.key]: event.target.value })
  }

  onNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props
    const targetDataset: any = event?.target.dataset
    const val = isNaN(Number(event.target.value)) ? 0 : Number(event.target.value)
    onChange({ ...query, [targetDataset.key]: val })
  }

  onFormatChange = (val: SelectableValue) => {
    const { onChange, query, onRunQuery } = this.props
    onChange({ ...query, format: val.value })
    onRunQuery()
  }

  render() {
    const query = _.defaults(this.props.query, defaultQuery)
    return (
      <div>
        <InlineFieldRow>
          <InlineField label="Query" labelWidth={12} grow>
            <Input
              placeholder="log query"
              value={query.Query || ''}
              data-key="Query"
              onChange={this.onInputChange}
              onBlur={this.props.onRunQuery}
              css={false}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Format" labelWidth={12} grow tooltip="待展示图表类型">
            <Select
              onChange={this.onFormatChange}
              value={query.format}
              options={Constants.QueryEditorFormatOptions}
            />
          </InlineField>
        </InlineFieldRow>
        {query.format === 'Graph' && (
          <InlineFieldRow>
            <InlineField label="Metrics" labelWidth={12} tooltip="待统计指标" grow>
              <Input
                placeholder="metrics"
                value={query.metrics || ''}
                data-key="metrics"
                onChange={this.onInputChange}
                css={false}
              />
            </InlineField>
            <InlineField label="Bucket" labelWidth={12} tooltip="聚合列名称（选填）" grow>
              <Input
                placeholder="bucket"
                value={query.bucket || ''}
                data-key="bucket"
                onChange={this.onInputChange}
                css={false}
              />
            </InlineField>
            <InlineField
              label="Time"
              labelWidth={12}
              tooltip="若查询结果为连续时间数据，则需指定 time 字段。否则不填写"
              grow
            >
              <Input
                placeholder="timeSeries"
                value={query.timeSeriesKey || ''}
                data-key="timeSeriesKey"
                onChange={this.onInputChange}
                css={false}
              />
            </InlineField>
          </InlineFieldRow>
        )}
        {query.format === 'Log' && (
          <InlineFieldRow>
            <InlineField label="Limit" labelWidth={12} tooltip="用于指定返回日志检索结果条数" grow>
              <Input
                value={query.Limit}
                data-key="Limit"
                onChange={this.onNumberChange}
                onKeyPress={(event) => /[\d]/.test(String.fromCharCode(event.keyCode))}
                css={false}
                type="number"
                step={1}
                min={1}
              />
            </InlineField>
          </InlineFieldRow>
        )}
      </div>
    )
  }
}
