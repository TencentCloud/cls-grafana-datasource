import { DataSourceWithBackend } from '@grafana/runtime';
import moment from 'moment-timezone';

import { getRequestClient } from './utils';

const HttpRequestMethod = 'POST';
const CanonicalUri = '/';
const CanonicalQueryString = '';
const ContentType = 'application/json';

export default class Sign {
  /**
   * Tencent Cloud API Signature v3 reference: https://cloud.tencent.com/document/api/213/30654
   * secretId: SecretId for identifying identity that is applied for on Cloud API Key.
   * A SecretId corresponds to a unique SecretKey, which is used to generate the request Signature.
   * secretKey: SecretKey is used to encrypt the signature string and verify the signature string on the server
   * service: the name of service, which must be consistent with the request domain, such as cvm
   * action: The name of the API for the desired operation
   * host: the domain of service，which must be consistent with the request domain, such as cvm.tencentcloudapi.com
   * version:  PI version, such as 2017-03-12
   * payload: The request parameters
   */

  secretId: string;

  service: string;
  action: string;
  host: string;
  version: string;
  payload: Record<string, any> | string;
  region: string;
  timestamp: number;
  date: string;
  // Use DataSourceWithBackend.postResource so the SDK picks the correct URL
  // (uid-based on Grafana >=7.4, numeric-id on older releases). Grafana 13
  // removed the legacy numeric-id routes, so hand-rolling the URL breaks there.
  ds: DataSourceWithBackend<any, any>;
  constructor(options: {
    secretId: string;
    service: string;
    action: string;
    host: string;
    version: string;
    payload?: Record<string, any> | string;
    region: string;
    ds: DataSourceWithBackend<any, any>;
  }) {
    const { secretId, service, action, host, version, payload = '', region, ds } = options;
    this.secretId = secretId;
    // this.secretKey = secretKey;
    this.service = service;
    this.action = action;
    this.host = host;
    this.version = version;
    this.payload = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.region = region;
    const nowDate = moment().utc();
    this.timestamp = nowDate.unix();
    this.date = nowDate.format('YYYY-MM-DD');
    this.ds = ds;
  }

  async getHeader() {
    return this.getResourceHeader();
  }

  async getResourceHeader() {
    let res: { authorization?: string; token?: string; intranet?: boolean; host?: string } = {};
    try {
      res = await this.ds.postResource('sign_v3', {
        Host: this.host,
        Service: this.service,
        Version: this.version,
        Action: this.action,
        Region: this.region,
        Timestamp: this.timestamp,
        Method: HttpRequestMethod,
        Uri: CanonicalUri,
        Query: CanonicalQueryString,
        Body: this.payload,
        Headers: {
          'content-type': ContentType,
          host: this.host,
        },
      });
    } catch (err) {
      console.error(err);
    }
    const { authorization, token, intranet, host } = res;
    const headers = {
      Authorization: authorization,
      'Content-Type': ContentType,
      Host: host,
      'X-TC-Action': this.action,
      'X-TC-Timestamp': this.timestamp.toString(),
      'X-TC-Version': this.version,
      'X-TC-RequestClient': getRequestClient(),
      ...(this.region && {
        'X-TC-Region': this.region,
      }),
      ...(token && {
        'X-TC-Token': token,
      }),
      intranet,
    };
    return headers;
  }
}
