import { DataSourcePlugin } from '@grafana/data'
import { DataSource } from './DataSource'
import { ConfigEditor } from './ConfigEditor'
import { QueryEditor } from './QueryEditor'
import { MyQuery, MyDataSourceOptions } from './types'

import './component/component.less'

export const plugin = new DataSourcePlugin<DataSource, MyQuery, MyDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
