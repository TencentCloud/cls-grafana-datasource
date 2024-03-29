import { InlineField, InlineFieldRow, Input, RadioButtonGroup } from '@grafana/ui';
import { clone, isString } from 'lodash';
import React, { useCallback, useLayoutEffect } from 'react';
import { useLatest } from 'react-use';

import { DataSource } from './DataSource';
import { Language, setLanguage, t } from './locale';
import { LogServiceQueryEditor } from './log-service/LogServiceQueryEditor';
import { defaultQueryInfo, ServiceType, VariableQuery, SERVICE_TYPE_OPTIONS } from './types';

interface VariableQueryProps {
  query: VariableQuery;
  onChange: (v: VariableQuery, definition: string) => void;
  datasource: DataSource;
}

const InfoPopver: React.FC<any> = () => (
  <a target="_blank" href="https://cloud.tencent.com/document/product/248/54510" rel="noreferrer">
    Click here for more information of query
  </a>
);
export const VariableQueryEditor: React.FC<VariableQueryProps> = (props) => {
  const propsRef = useLatest(props);
  const { query, datasource } = props;

  useLayoutEffect(() => {
    setLanguage(props.datasource.instanceSettings.jsonData.language || Language.Chinese);
  }, [props.datasource.instanceSettings.jsonData.language]);

  const onQueryChange = useCallback(
    (newQuery: VariableQuery) => {
      const { onChange } = propsRef.current;
      let definition;
      if (newQuery.serviceType === ServiceType.logService) {
        definition = `SQL:  ${newQuery.logServiceParams?.Query}`;
      } else {
        definition = newQuery.queryString;
      }
      onChange?.(newQuery, definition);
    },
    [propsRef],
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label={t('service_type')} labelWidth={20}>
          <RadioButtonGroup
            options={SERVICE_TYPE_OPTIONS}
            value={isString(query) ? ServiceType.cloudApi : query.serviceType}
            onChange={(type) => {
              if (type === ServiceType.cloudApi) {
                onQueryChange({
                  serviceType: type,
                  queryString: '',
                });
              }
              if (type === ServiceType.logService) {
                onQueryChange({
                  serviceType: type,
                  queryString: '',
                  logServiceParams: clone(defaultQueryInfo.logServiceParams),
                });
              }
            }}
          />
        </InlineField>
      </InlineFieldRow>
      {query.serviceType === ServiceType.logService && (
        <>
          {/* 复用编辑模式的日志主题输入组件 */}
          <LogServiceQueryEditor
            datasource={datasource}
            query={query as unknown as any}
            onRunQuery={() => {}}
            onChange={(v) => {
              onQueryChange({
                serviceType: ServiceType.logService,
                queryString: '',
                logServiceParams: v.logServiceParams,
              });
            }}
          />
        </>
      )}
      {(isString(query) || query.serviceType === ServiceType.cloudApi) && (
        <InlineFieldRow>
          <InlineField label={t('search_statement')} labelWidth={20} grow tooltip={InfoPopver}>
            <Input
              name="query"
              required
              onChange={(e) =>
                onQueryChange({
                  serviceType: ServiceType.cloudApi,
                  queryString: e.currentTarget.value,
                })
              }
              value={isString(query) ? query : query.queryString}
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </>
  );
};
VariableQueryEditor.displayName = 'VariableQueryEditor';
