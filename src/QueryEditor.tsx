import { QueryEditorProps } from '@grafana/data';
import { Tab, TabContent, TabsBar } from '@grafana/ui';
import React, { PureComponent } from 'react';

import { CoreApp } from './common/constants';
import { DataSource } from './DataSource';
import { setLanguage, Language } from './locale';
import { LogServiceQueryEditor } from './log-service/LogServiceQueryEditor';
import { MyDataSourceOptions, QueryInfo, ServiceType, ServiceTypeOptions } from './types';

type Props = QueryEditorProps<DataSource, QueryInfo, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  state = {
    isAlertVisible: false,
  };

  constructor(props) {
    super(props);
    setLanguage(props.datasource.instanceSettings.jsonData.language || Language.Chinese);
  }

  componentDidMount() {
    const { query } = this.props;
    // @ts-ignore
    const app = this.props.app as CoreApp;
    if (app === CoreApp.UnifiedAlerting) {
      //  告警页面
      this.partialOnChange({ serviceType: ServiceType.logService });
      return;
    }
    const firstEnabledService = this.enabledServices[0];
    if (!query.serviceType && firstEnabledService) {
      this.partialOnChange({ serviceType: firstEnabledService });
    }
  }

  partialOnChange = (queryInfo: Partial<QueryInfo>) => {
    const { onChange, query: oldQuery } = this.props;
    // @ts-ignore
    const app = this.props.app as CoreApp;
    const newQuery = { ...oldQuery, ...queryInfo } as unknown as QueryInfo;
    if (app === CoreApp.UnifiedAlerting) {
      //  告警页面
      if (newQuery.serviceType === ServiceType.logService) {
        onChange(newQuery);
        this.setState({
          isAlertVisible: false,
        });
      } else {
        this.setState({
          isAlertVisible: true,
        });
      }
    } else {
      onChange(newQuery);
    }
  };

  get enabledServices() {
    return [ServiceType.logService].filter(Boolean);
  }

  render() {
    const { datasource, query: queryInfo } = this.props;
    if (!datasource) {
      return <div>loading</div>;
    }
    return (
      <div>
        {this.enabledServices.length > 1 && (
          <TabsBar>
            {ServiceTypeOptions.filter((item) => this.enabledServices.includes(item.value)).map((item) => (
              <Tab
                key={item.value}
                label={item.label}
                active={queryInfo.serviceType === item.value}
                onChangeTab={() => {
                  this.partialOnChange({ serviceType: item.value });
                }}
              />
            ))}
          </TabsBar>
        )}
        <TabContent>
          {queryInfo.serviceType === ServiceType.logService && this.renderLogServiceQueryEditor()}
        </TabContent>
      </div>
    );
  }

  renderLogServiceQueryEditor() {
    return <LogServiceQueryEditor {...this.props} />;
  }
}
