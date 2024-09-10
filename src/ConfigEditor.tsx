import { DataSourcePluginOptionsEditorProps, SelectableValue } from '@grafana/data';
import { LegacyForms, InlineFieldRow, InlineField, Select, InlineSwitch, Input } from '@grafana/ui';
import React, { ChangeEvent, PureComponent } from 'react';

import { getRequestClient } from './common/utils';
import { t, setLanguage, Language } from './locale';
import { MyDataSourceOptions, MySecureJsonData } from './types';

type Props = DataSourcePluginOptionsEditorProps<MyDataSourceOptions, MySecureJsonData>;

const { SecretFormField } = LegacyForms;

export class ConfigEditor extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
    setLanguage(props.options.jsonData.language || Language.Chinese);
  }

  patchJsonData = (kv: Record<string, any>) => {
    const { onOptionsChange, options } = this.props;
    if (kv) {
      const jsonData = {
        ...options.jsonData,
        ...kv,
      };
      onOptionsChange({ ...options, jsonData });
    }
  };

  onJsonDataChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const targetName = event?.target?.name;
    const targetValue = (event?.target?.value || '').trim();
    if (targetName) {
      const jsonData = {
        ...options.jsonData,
        [targetName]: targetValue,
        RequestClient: getRequestClient(),
      };
      onOptionsChange({ ...options, jsonData });
    }
  };

  // Secure field (only sent to the backend)
  onSecureJsonChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const targetName = event?.target?.name;
    const targetValue = (event?.target?.value || '').trim();
    if (targetName) {
      onOptionsChange({
        ...options,
        // @ts-ignore
        secureJsonData: {
          ...options.secureJsonData,
          [targetName]: targetValue,
        },
      });
    }
  };

  onResetSecureJson = (key: string) => {
    const { onOptionsChange, options } = this.props;
    if (key) {
      onOptionsChange({
        ...options,
        secureJsonFields: {
          ...options.secureJsonFields,
          [key]: false,
        },
        // @ts-ignore
        secureJsonData: {
          ...options.secureJsonData,
          [key]: '',
        },
      });
    }
  };

  render() {
    const { options } = this.props;
    const { jsonData, secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as MySecureJsonData;

    return (
      <>
        <div>
          <h3 className="page-heading">Security Credentials</h3>
          <div
            className="card-item"
            style={{
              position: 'relative',
              marginTop: '16px',
              padding: '16px',
              WebkitBoxFlex: 1,
              flexGrow: 1,
              borderTop: '3px solid rgb(50, 115, 217)',
            }}
          >
            <div>
              <h4>Initialize Tencent Cloud CLS Grafana Datasource</h4>
              <p>
                To initialize the CLS Datasource and connect it to your Tencent Cloud service you will need a SecretId
                and a SecretKey for you Tencent Cloud account.
                <br />
                <b>SecretId</b> is used to identify the identity of the API caller.
                <br />
                <b>SecretKey</b> is used to encrypt the signature and validate the signature of the server-side.
              </p>
            </div>
            <div>
              <h5>User Permission</h5>
              <p>
                If you are using a
                <a
                  className="highlight-word"
                  href="https://intl.cloud.tencent.com/document/product/598/13674"
                  target="_blank"
                  style={{ margin: '0 4px' }}
                  rel="noreferrer"
                >
                  sub-user
                </a>
                account, you should at least own read permission to your CLS topics.
              </p>
              <a
                className="highlight-word"
                href="https://console.cloud.tencent.com/cam/capi"
                target="_blank"
                rel="noreferrer"
              >
                Generate a new Tencent Cloud API key
              </a>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <InlineFieldRow>
            <InlineField label="SecretId" labelWidth={30} required={true}>
              <Input
                width={50}
                required={true}
                value={jsonData.secretId}
                name="secretId"
                onChange={this.onJsonDataChange}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow style={{ marginBottom: 4 }}>
            <SecretFormField
              label="SecretKey"
              labelWidth={15}
              inputWidth={25}
              type="password"
              name="secretKey"
              value={secureJsonData?.secretKey || ''}
              isConfigured={secureJsonFields?.secretKey}
              onChange={this.onSecureJsonChange}
              onReset={() => {
                this.onResetSecureJson('secretKey');
              }}
              required={true}
            />
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label={t('language')} labelWidth={30}>
              <Select
                value={jsonData.language || Language.Chinese}
                className="width-10"
                options={[
                  { value: Language.English, label: 'English' },
                  { value: Language.Chinese, label: '简体中文' },
                ]}
                onChange={(option: SelectableValue<Language>) => {
                  setLanguage(option.value as Language);
                  this.patchJsonData({
                    language: option.value,
                  });
                }}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label={t('enable_intranet_API_mode')} labelWidth={30}>
              <InlineSwitch
                value={jsonData.intranet}
                onChange={(e) => {
                  // onIntranetChange
                  this.patchJsonData({
                    intranet: e.currentTarget.checked,
                  });
                }}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label={t('enable_explore_visualization_types')} labelWidth={30}>
              <InlineSwitch
                value={jsonData.enableExploreVisualizationTypes}
                onChange={(e) => {
                  // onIntranetChange
                  this.patchJsonData({
                    enableExploreVisualizationTypes: e.currentTarget.checked,
                  });
                }}
              />
            </InlineField>
          </InlineFieldRow>
        </div>
      </>
    );
  }
}
