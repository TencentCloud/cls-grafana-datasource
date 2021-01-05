import React, { ChangeEvent, PureComponent } from 'react'
import { LegacyForms, Legend, Icon, Tooltip } from '@grafana/ui'
import { DataSourcePluginOptionsEditorProps } from '@grafana/data'
import { MyDataSourceOptions, MySecureJsonData } from './types'
const { FormField, SecretFormField } = LegacyForms

type Props = DataSourcePluginOptionsEditorProps<MyDataSourceOptions>

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface State {}

export class ConfigEditor extends PureComponent<Props, State> {
  onJsonDataChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props
    const targetDataset = event?.target.dataset
    console.log('event', event)
    if (targetDataset.key) {
      const jsonData = {
        ...options.jsonData,
        [targetDataset.key]: event.target.value,
      }
      onOptionsChange({ ...options, jsonData })
    }
  }

  // Secure field (only sent to the backend)
  onSecureJsonChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props
    const targetDataset = event?.target.dataset
    console.log('event', event)
    if (targetDataset.key) {
      onOptionsChange({
        ...options,
        secureJsonData: {
          ...options.secureJsonData,
          [targetDataset.key]: event.target.value,
        },
      })
    }
  }

  onResetSecureJson = (key: string) => {
    const { onOptionsChange, options } = this.props
    if (key) {
      onOptionsChange({
        ...options,
        secureJsonFields: {
          ...options.secureJsonFields,
          [key]: false,
        },
        secureJsonData: {
          ...options.secureJsonData,
          [key]: '',
        },
      })
    }
  }

  render() {
    const { options } = this.props
    const { jsonData, secureJsonFields } = options
    const secureJsonData = (options.secureJsonData || {}) as MySecureJsonData

    return (
      <>
        <div className="gf-form-group">
          <Legend>
            Security Credentials
            <Tooltip
              content={
                <span>
                  SecretId、SecretKey：API请求密钥，用于身份鉴权。获取地址前往
                  <a
                    style={{ marginLeft: 5 }}
                    href="https://console.cloud.tencent.com/cam/capi"
                    target="_blank"
                  >
                    API密钥管理
                  </a>
                </span>
              }
              placement="top"
            >
              <Icon name="info-circle" />
            </Tooltip>
          </Legend>

          <div className="gf-form">
            <SecretFormField
              isConfigured={secureJsonFields?.secretId as boolean}
              value={secureJsonData.secretId || ''}
              label="SecretId"
              labelWidth={6}
              inputWidth={20}
              data-key="secretId"
              onReset={() => this.onResetSecureJson('secretId')}
              onChange={this.onSecureJsonChange}
            />
          </div>
          <div className="gf-form">
            <SecretFormField
              isConfigured={secureJsonFields?.secretKey as boolean}
              value={secureJsonData.secretKey || ''}
              label="SecretKey"
              labelWidth={6}
              inputWidth={20}
              data-key="secretKey"
              onReset={() => this.onResetSecureJson('secretKey')}
              onChange={this.onSecureJsonChange}
            />
          </div>
        </div>
        <div className="gf-form-group">
          <Legend>
            Log Service Info
            <Tooltip
              content={
                <span>
                  SecretId、SecretKey：API请求密钥，用于身份鉴权。获取地址前往
                  <a
                    style={{ marginLeft: 5 }}
                    href="https://console.cloud.tencent.com/cam/capi"
                    target="_blank"
                  >
                    API密钥管理
                  </a>
                </span>
              }
              placement="top"
            >
              <Icon style={{ marginLeft: 5 }} name="info-circle" />
            </Tooltip>
          </Legend>
          <div className="gf-form">
            <FormField
              tooltip={
                <span>
                  日志服务区域简称，例如北京区域填写ap-beijing，完整区域列表格式参考
                  <a
                    style={{ marginLeft: 5 }}
                    href="https://cloud.tencent.com/document/product/614/18940"
                    target="_blank"
                  >
                    地域列表
                  </a>
                </span>
              }
              label="Region"
              labelWidth={6}
              inputWidth={20}
              placeholder=""
              data-key="region"
              value={jsonData.region || ''}
              onChange={this.onJsonDataChange}
            />
          </div>
          <div className="gf-form">
            <FormField
              tooltip={
                <span>
                  <a href="https://cloud.tencent.com/document/product/614/35677" target="_blank">
                    日志主题ID
                  </a>
                </span>
              }
              label="TopicId"
              labelWidth={6}
              inputWidth={20}
              placeholder=""
              data-key="topicId"
              value={jsonData.topicId || ''}
              onChange={this.onJsonDataChange}
            />
          </div>
        </div>
      </>
    )
  }
}
