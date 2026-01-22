import { DataSourceApi, QueryEditorProps } from '@grafana/data';
import { PreferredVisualisationType } from '@grafana/data/types/data';
import { InlineField, QueryField, Select, InlineFieldRow, Input, Checkbox } from '@grafana/ui';
import { clone, debounce, isNil, pick } from 'lodash-es';
import moment from 'moment-timezone';
import React, { FC, useCallback, useRef } from 'react';
import { useEffectOnce, useLatest } from 'react-use';

import { SearchSyntaxRule } from './common/constants';
import { TopicSelector } from './components/TopicSelector';
import { LogServiceDataSource } from './LogServiceDataSource';
import { CoreApp, QueryEditorFormatOptions, TcDataSourceId } from '../common/constants';
import { t } from '../locale';
import { defaultQueryInfo, MyDataSourceOptions, QueryInfo, queryInfoRuntime } from '../types';

import './index.scss';

type Props = QueryEditorProps<DataSourceApi<any>, QueryInfo, MyDataSourceOptions> & {
  // grafana 8 才有，这里自己定义上
  app?: CoreApp;
};

const browserTimeZone = moment.tz.guess();

export const LogServiceQueryEditor: FC<Props> = React.memo((props: Props) => {
  const propsRef = useLatest(props);
  const { query, datasource, app, onRunQuery: onRunQueryProp } = props;

  const onRunQueryRef = useRef(onRunQueryProp);
  onRunQueryRef.current = onRunQueryProp;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onRunQuery = useCallback(
    debounce(() => {
      // 等待onChange先完成再执行query
      const timeoutId = setTimeout(() => {
        onRunQueryRef.current?.();
      }, 500);
      return () => {
        clearTimeout(timeoutId);
      };
    }),
    [],
  );

  const enableExploreVisualizationTypes =
    (datasource as LogServiceDataSource).instanceSettings.jsonData.enableExploreVisualizationTypes || false;
  const logServiceParamsRef = useRef<Required<QueryInfo>['logServiceParams']>(
    query.logServiceParams || clone(defaultQueryInfo.logServiceParams)!,
  );
  const preferredVisualisationTypes = logServiceParamsRef.current?.preferredVisualisationTypes || [
    ...(defaultQueryInfo.logServiceParams?.preferredVisualisationTypes as PreferredVisualisationType[]),
  ];

  const partialOnChange = useCallback(
    (queryInfo: Partial<QueryInfo>) => {
      const { onChange, query } = propsRef.current;
      // 使用queryInfoRuntime作为配置模板，清除其他不存在的配置字段。
      const oldQuery = pick(query, Object.keys(queryInfoRuntime));
      onChange({ ...oldQuery, ...queryInfo } as unknown as QueryInfo);
    },
    [propsRef],
  );
  useEffectOnce(() => {
    if (isNil(logServiceParamsRef.current.SyntaxRule)) {
      logServiceParamsRef.current.SyntaxRule = SearchSyntaxRule.CQL;
    }
    if (isNil(logServiceParamsRef.current.format)) {
      logServiceParamsRef.current.format = 'Graph';
    }
    if (isNil(logServiceParamsRef.current.TimeZone)) {
      logServiceParamsRef.current.TimeZone = 'UTC';
    }
    partialOnChange({
      app,
      logServiceParams: logServiceParamsRef.current,
    });
  });

  const onPreferredVisualisationTypesChange = useCallback(
    (ev: React.FocusEvent<HTMLInputElement>) => {
      const target = ev.currentTarget;
      const { name, checked } = target;
      let preferredVisualisationTypes = propsRef.current?.query?.logServiceParams?.preferredVisualisationTypes || [
        ...(defaultQueryInfo.logServiceParams?.preferredVisualisationTypes as PreferredVisualisationType[]),
      ];
      if (checked) {
        preferredVisualisationTypes = [...preferredVisualisationTypes, name as PreferredVisualisationType];
      } else {
        preferredVisualisationTypes = preferredVisualisationTypes.filter((type) => type !== name);
      }
      logServiceParamsRef.current.preferredVisualisationTypes = preferredVisualisationTypes;
      partialOnChange({
        logServiceParams: logServiceParamsRef.current,
      });
      onRunQuery?.();
    },
    [onRunQuery, partialOnChange, propsRef],
  );

  const showPanelTypeOption = app === CoreApp.PanelEditor || app === CoreApp.Explore;

  return (
    <div>
      <InlineFieldRow>
        <TopicSelector
          value={{ region: logServiceParamsRef.current.region, TopicId: logServiceParamsRef.current.TopicId }}
          onChange={(v) => {
            logServiceParamsRef.current = {
              ...(propsRef.current?.query?.logServiceParams || ({} as any)),
              ...v,
            };
            partialOnChange({
              logServiceParams: logServiceParamsRef.current,
            });
          }}
          datasource={datasource}
        />
        <InlineField label={t('syntax_rule')} labelWidth={20}>
          <Select
            value={logServiceParamsRef.current.SyntaxRule}
            onChange={(v) => {
              logServiceParamsRef.current = {
                ...(propsRef.current?.query?.logServiceParams || ({} as any)),
                SyntaxRule: v.value,
              };
              partialOnChange({
                logServiceParams: logServiceParamsRef.current,
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

      {/* @ts-ignore*/}
      <InlineField label={t('search_statement')} labelWidth={20} grow={true} shrink={true}>
        <QueryField
          portalOrigin={TcDataSourceId}
          placeholder={`e.g. _SOURCE__: 127.0.0.1 AND "http/1.0"`}
          query={logServiceParamsRef.current.Query}
          onChange={(v) => {
            logServiceParamsRef.current = {
              ...(propsRef.current?.query?.logServiceParams || ({} as any)),
              Query: v,
            };
            partialOnChange({
              logServiceParams: logServiceParamsRef.current,
            });
          }}
          onBlur={onRunQuery}
        />
      </InlineField>

      {showPanelTypeOption ? (
        <>
          <InlineFieldRow>
            <InlineField label={t('panel_type')} labelWidth={20}>
              <Select
                onChange={(v) => {
                  logServiceParamsRef.current = {
                    ...(propsRef.current?.query?.logServiceParams || ({} as any)),
                    format: v.value,
                  };
                  partialOnChange({
                    logServiceParams: logServiceParamsRef.current,
                  });
                  onRunQuery?.();
                }}
                value={logServiceParamsRef.current.format}
                options={QueryEditorFormatOptions}
                width={40}
              />
            </InlineField>
          </InlineFieldRow>
          {logServiceParamsRef.current.format === 'Log' && (
            <InlineFieldRow>
              <MaxResultNumInput
                value={logServiceParamsRef.current.MaxResultNum as number}
                onChange={(val) => {
                  logServiceParamsRef.current = {
                    ...(propsRef.current?.query?.logServiceParams || ({} as any)),
                    MaxResultNum: val,
                  };
                  partialOnChange({
                    logServiceParams: logServiceParamsRef.current,
                  });
                }}
                onBlur={onRunQuery}
              />
            </InlineFieldRow>
          )}
        </>
      ) : null}

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

      {app === CoreApp.UnifiedAlerting ? (
        <InlineField
          label={t('time_zone')}
          tooltip={t('time_zone_description')}
          labelWidth={20}
          style={{
            alignItems: 'center',
            alignSelf: 'center',
          }}
        >
          <Select
            value={logServiceParamsRef.current.TimeZone}
            onChange={(v) => {
              logServiceParamsRef.current = {
                ...(propsRef.current?.query?.logServiceParams || ({} as any)),
                TimeZone: v.value,
              };
              partialOnChange({
                logServiceParams: logServiceParamsRef.current,
              });
              onRunQuery?.();
            }}
            menuPlacement="bottom"
            options={[
              {
                label: 'UTC',
                value: 'UTC',
              },
              {
                label: browserTimeZone,
                value: browserTimeZone,
              },
              ...moment.tz
                .names()
                .filter((name) => name !== 'UTC' && name !== browserTimeZone)
                .map((name) => ({
                  label: name,
                  value: name,
                })),
            ]}
            width={25}
            className="log-service-monospaced-font-family"
          />
        </InlineField>
      ) : null}
    </div>
  );
});

LogServiceQueryEditor.displayName = 'LogServiceQueryEditor';

interface MaxResultNumInputProps {
  value: string | number;
  onChange: (value: number | undefined) => void;
  onBlur: () => void;
}

const MaxResultNumInput: FC<MaxResultNumInputProps> = React.memo((props) => {
  const min = 1;
  const max = 1000;
  const { value, onChange: onChangeFromProps, onBlur } = props;

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
      invalid={Number(value) < min || Number(value) > max}
      // @ts-ignore  这里报error属性不存在，但应该是存在的。
      error="仅支持返回1～1000条日志"
    >
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={onInputChange}
        onBlur={onBlur}
        width={40}
        className="log-service-monospaced-font-family"
      />
    </InlineField>
  );
});
MaxResultNumInput.displayName = 'MaxResultNumInput';
