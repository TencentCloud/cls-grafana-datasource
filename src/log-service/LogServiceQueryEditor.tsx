import { DataSourceApi, QueryEditorProps } from '@grafana/data';
import { PreferredVisualisationType } from '@grafana/data/types/data';
import { InlineField, QueryField, Select, InlineFieldRow, Input, Checkbox } from '@grafana/ui';
import _ from 'lodash';
import React, { FC, useCallback } from 'react';
import { useLatest } from 'react-use';

import { SearchSyntaxRule } from './common/constants';
import { TopicSelector } from './components/TopicSelector';
import { LogServiceDataSource } from './LogServiceDataSource';
import { CoreApp, TcDataSourceId } from '../common/constants';
import { t } from '../locale';
import { defaultQueryInfo, MyDataSourceOptions, QueryInfo, queryInfoRuntime } from '../types';

import './index.less';

type Props = QueryEditorProps<DataSourceApi<any>, QueryInfo, MyDataSourceOptions> & {
  // grafana 8 才有，这里自己定义上
  app: CoreApp;
};

export const LogServiceQueryEditor: FC<Props> = React.memo((props: Props) => {
  const propsRef = useLatest(props);
  const { query, datasource, app } = props;
  const enableExploreVisualizationTypes =
    (datasource as LogServiceDataSource).instanceSettings.jsonData.enableExploreVisualizationTypes || false;
  const logServiceParams = query.logServiceParams || _.clone(defaultQueryInfo.logServiceParams)!;
  const preferredVisualisationTypes = logServiceParams?.preferredVisualisationTypes || [
    ...defaultQueryInfo.logServiceParams.preferredVisualisationTypes,
  ];

  const partialOnChange = useCallback(
    (queryInfo: Partial<QueryInfo>) => {
      const { onChange, query } = propsRef.current;
      // 使用queryInfoRuntime作为配置模板，清除其他不存在的配置字段。
      const oldQuery = _.pick(query, Object.keys(queryInfoRuntime));
      onChange({ ...oldQuery, ...queryInfo } as unknown as QueryInfo);
    },
    [propsRef],
  );

  const onPreferredVisualisationTypesChange = useCallback(
    (ev: React.FocusEvent<HTMLInputElement>) => {
      const target = ev.currentTarget;
      const { name, checked } = target;
      let preferredVisualisationTypes = propsRef.current?.query?.logServiceParams?.preferredVisualisationTypes || [
        ...defaultQueryInfo.logServiceParams.preferredVisualisationTypes,
      ];
      if (checked) {
        preferredVisualisationTypes = [...preferredVisualisationTypes, name as PreferredVisualisationType];
      } else {
        preferredVisualisationTypes = preferredVisualisationTypes.filter((type) => type !== name);
      }
      partialOnChange({
        logServiceParams: {
          ...(propsRef.current?.query?.logServiceParams || ({} as any)),
          preferredVisualisationTypes,
        },
      });
    },
    [partialOnChange, propsRef],
  );

  return (
    <div>
      <InlineFieldRow>
        <TopicSelector
          value={{ region: logServiceParams.region, TopicId: logServiceParams.TopicId }}
          onChange={(v) => {
            partialOnChange({
              logServiceParams: {
                ...(propsRef.current?.query?.logServiceParams || ({} as any)),
                ...v,
              },
            });
          }}
          datasource={datasource}
        />
        <InlineField label={t('syntax_rule')} labelWidth={20}>
          <Select
            value={logServiceParams.SyntaxRule}
            onChange={(v) => {
              partialOnChange({
                logServiceParams: {
                  ...(propsRef.current?.query?.logServiceParams || ({} as any)),
                  SyntaxRule: v.value,
                },
              });
            }}
            menuPlacement="bottom"
            options={[
              {
                label: 'Lucene',
                value: SearchSyntaxRule.LUCENE,
              },
              {
                label: 'CQL',
                value: SearchSyntaxRule.CQL,
              },
            ]}
            width={25}
            className="log-service-monospaced-font-family"
          />
        </InlineField>
      </InlineFieldRow>

      <MaxResultNumInput
        value={logServiceParams.MaxResultNum}
        onChange={(val) => {
          partialOnChange({
            logServiceParams: {
              ...(propsRef.current?.query?.logServiceParams || ({} as any)),
              MaxResultNum: val,
            },
          });
        }}
      />

      <InlineField label={t('search_statement')} labelWidth={20} grow={true}>
        <QueryField
          portalOrigin={TcDataSourceId}
          placeholder={`e.g. _SOURCE__: 127.0.0.1 AND "http/1.0"`}
          query={logServiceParams.Query}
          onChange={(v) => {
            partialOnChange({
              logServiceParams: {
                ...(propsRef.current?.query?.logServiceParams || ({} as any)),
                Query: v,
              },
            });
          }}
          // By default QueryField calls onChange if onBlur is not defined, this will trigger a rerender
          // And slate will claim the focus, making it impossible to leave the field.
          onBlur={() => {}}
        />
      </InlineField>

      {enableExploreVisualizationTypes && app === CoreApp.Explore ? (
        <InlineField
          label={t('explore_visualization_types')}
          labelWidth={20}
          style={{
            alignItems: 'center',
            alignSelf: 'center',
          }}
        >
          <>
            <Checkbox
              name={'logs'}
              label={t('logs')}
              value={preferredVisualisationTypes?.includes('logs')}
              onChange={onPreferredVisualisationTypesChange}
            />
            <span> </span>
            <Checkbox
              name={'nodeGraph'}
              label={t('node_graph')}
              value={preferredVisualisationTypes?.includes('nodeGraph')}
              onChange={onPreferredVisualisationTypesChange}
            />
            <span> </span>
            <Checkbox
              name={'trace'}
              label={t('trace')}
              value={preferredVisualisationTypes?.includes('trace')}
              onChange={onPreferredVisualisationTypesChange}
            />
          </>
        </InlineField>
      ) : null}
    </div>
  );
});

LogServiceQueryEditor.displayName = 'LogServiceQueryEditor';

interface MaxResultNumInputProps {
  value: string | number;
  onChange: (value: number | undefined) => void;
}

const MaxResultNumInput: FC<MaxResultNumInputProps> = React.memo((props) => {
  const min = 1;
  const max = 1000;
  const { value, onChange: onChangeFromProps } = props;

  const onInputChange = useCallback(
    (e) => {
      const currVal = Number(e.currentTarget.value) || undefined;
      onChangeFromProps(currVal);
    },
    [onChangeFromProps],
  );

  return (
    <InlineField
      label={t('max_result_num')}
      labelWidth={20}
      invalid={value < min || value > max}
      // @ts-ignore  这里报error属性不存在，但应该是存在的。
      error="仅支持返回1～1000条日志"
    >
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={onInputChange}
        width={25}
        className="log-service-monospaced-font-family"
      />
    </InlineField>
  );
});
