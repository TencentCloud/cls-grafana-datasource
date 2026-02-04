# Grafana shows CLS data

[English](README.md) | [中文](README_ZH.md)

Cloud Log Service (CLS) connects with Grafana, supporting the export of raw log data and SQL aggregated analysis results from CLS to Grafana for display. Users only need to install the CLS Grafana plug-in, fill in the search and analysis statement in Grafana, and the display result can be shown on Grafana.

> Note: Starting from version 1.0.3, the plug-in uses the new retrieval interface of Tencent Cloud log service, making log queries more stable and quick.
>
> For versions 1.0.2 and lower, retrieval abnormality may exist when querying raw Logs. Please proactively upgrade to the latest version as soon as possible.


## Prerequisite

Install Grafana 7 or later version. For details, see the [Grafana installation guide](https://grafana.com/docs/grafana/latest/installation/). For legacy Grafana, refer to the [Grafana upgrade guide](https://grafana.com/docs/grafana/latest/installation/upgrading).

For RPM-based Linux, you can use the [source installation](https://grafana.com/docs/grafana/latest/installation/rpm/#install-from-yum-repository) (recommended) or [manual installation](https://grafana.com/docs/grafana/latest/installation/rpm/#install-manually-with-yum) method

[Start the TencentCloud Managed Service for Grafana (TCMG)](https://grafana.com/docs/grafana/latest/installation/rpm/#2-start-the-server)
   ```sh
   sudo systemctl daemon-reload
   sudo systemctl start grafana-server
   sudo systemctl status grafana-server
   sudo systemctl enable grafana-server
   ```

To install more visual charts, such as pie charts and trend overview charts, run the command to install grafana panel plug-ins, for example, the pie panel.
   ```sh
   grafana-cli plugins install grafana-piechart-panel
   service grafana-server restart
   ```

For more plugin installation, see [Grafana plugins](https://grafana.com/grafana/plugins?type=panel)

## Install the CLS plug-in for Grafana integration

For different Grafana installation methods, you need to install the CLS data source plugin using the following different methods.

### Server installation and deployment

1. Please confirm the Grafana plug-in directory location. Install plug-in in the Centos plugin directory /var/lib/grafana/plugins/, then restart grafana-server.

   ```sh
   cd /var/lib/grafana/plugins/
   timeout 60s wget --timeout=10 --tries=1 -O tencent-cls-grafana-datasource.zip https://github.com/TencentCloud/cls-grafana-datasource/releases/latest/download/tencent-cls-grafana-datasource.zip || wget -O tencent-cls-grafana-datasource.zip https://cnb.cool/tencent/cloud/cls/frontend/cls-grafana-datasource/-/releases/latest/download/tencent-cls-grafana-datasource.zip
   unzip tencent-cls-grafana-datasource
   ```
Or use the one-click installation script (parameter at the end is the plug-in installation directory).
   ```shell
   /bin/bash -c "$(curl -fsL --max-time 10 https://raw.githubusercontent.com/TencentCloud/cls-grafana-datasource/master/toolkit/update.sh || curl -fsSL https://cnb.cool/tencent/cloud/cls/frontend/cls-grafana-datasource/-/git/raw/main/toolkit/update_from_cnb.sh)" bash /var/lib/grafana/plugins/
   ```

2. Modify the Grafana configuration file to configure the CLS data source ID. For the path to the configuration file, see the configuration document (https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/)
* 1. Set the **allow_loading_unsigned_plugins** parameter in **plugins**
```
[plugins]
allow_loading_unsigned_plugins = tencent-cls-grafana-datasource
```
* 2. Set the **timeout**, **dialTimeout**, and **keep_alive_seconds** parameters in **dataproxy**
```
[dataproxy]
timeout = 60
dialTimeout = 60
keep_alive_seconds = 60
```

3. Restart the grafana service
```sh
service grafana-server restart
```

### Docker deployment

Refer to the [plugin guide for Grafana installation in Docker](https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/#install-plugins-in-the-docker-container) and install the CLS plug-in using the following environment variable.

docker run command:
```
docker run -d -p 3000:3000 --name=grafana \
  -e "GF_INSTALL_PLUGINS=https://github.com/TencentCloud/cls-grafana-datasource/releases/latest/download/tencent-cls-grafana-datasource.zip;tencent-cls-grafana-datasource" \
  -e "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=tencent-cls-grafana-datasource" \
  -e "GF_DATAPROXY_TIMEOUT=60" \
  -e "GF_DATAPROXY_DIALTIMEOUT=60" \
  -e "GF_DATAPROXY_KEEP_ALIVE_SECONDS=60" \
  grafana/grafana
```

docker compose:
```
version: '3'

services:
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - '3000:3000'
    environment:
      - GF_INSTALL_PLUGINS=https://github.com/TencentCloud/cls-grafana-datasource/releases/latest/download/tencent-cls-grafana-datasource.zip;tencent-cls-grafana-datasource
      - GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=tencent-cls-grafana-datasource
      - GF_DATAPROXY_TIMEOUT=60
      - GF_DATAPROXY_DIALTIMEOUT=60
      - GF_DATAPROXY_KEEP_ALIVE_SECONDS=60
```

#### Note:
1. If accessing the docker software source is slow on Tencent Cloud CVM, see [Using Tencent Cloud Docker Software Source on Cloud Virtual Machine](https://cloud.tencent.com/document/product/213/8623#.E4.BD.BF.E7.94.A8.E8.85.BE.E8.AE.AF.E4.BA.91.E9.95.9C.E5.83.8F.E6.BA.90.E5.8A.A0.E9.80.9F-docker) to speed up.
2. If accessing github is slow, replace the `GF_INSTALL_PLUGINS` environment variable with `GF_INSTALL_PLUGINS=https://cnb.cool/tencent/cloud/cls/frontend/cls-grafana-datasource/-/releases/latest/download/tencent-cls-grafana-datasource.zip;tencent-cls-grafana-datasource`

### Tencent Cloud Grafana service

1. Refer to [configuration management](https://cloud.tencent.com/document/product/1437/65673) and add the following configuration in Grafana configuration.

```
[plugins]
allow_loading_unsigned_plugins = tencent-cls-grafana-datasource

[dataproxy]
timeout = 60
dialTimeout = 60
keep_alive_seconds = 60
```

![Configuration Management](https://main.qcloudimg.com/raw/8f8b426137dea9b41c3fd584056a1822.png)

2. Refer to [install plugin](https://cloud.tencent.com/document/product/1437/61612) and select tencent-cls-grafana-datasource.

![Install plugin](https://main.qcloudimg.com/raw/218f2fe5b35a4356b5b156d5d575c681.png)

## Configure log data source

1. Log in to Grafana

If you deploy on the local machine, port 3000 is selected by default. Please advise in advance to open port 3000 in browser.

2. Click the settings icon in the left menu bar to enter **Data Sources**.

On the **Data Sources** page, click **Add data source**, select **Tencent Cloud Log Service Datasource**, and configure the data source according to the following instructions.

| Configuration Item               | Description |
|----------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Credential Type                  | "Permanent key": Initiate request by filling in SecretId and SecretKey;<br>"[Assume Role](https://cloud.tencent.com/document/product/598/19419)": Initiate request by obtaining temporary key after assuming role identity;<br>"[CVM Role](https://cloud.tencent.com/document/product/213/47668)": Initiate request by obtaining temporary key after assuming CVM-bound role. Supports only Grafana instances deployed on Tencent Cloud CVM. |
| SecretId, SecretKey              | API request key for identity authentication. Go to [API key management](https://console.cloud.tencent.com/cam/capi) to get address. Fill in when credential Type is "permanent key" or "Assume Role".
| RoleArn                          | The resource description of the role, which can be obtained by clicking the role name in [Cloud Access Management (CAM)](https://console.cloud.tencent.com/cam/role). Fill in when the credential type is "Assume Role".
| Role name                        | The role name can be obtained in [Access Management (CAM)](https://console.cloud.tencent.com/cam/role). Fill in when the credential type is "CVM Role". It must match the role name bound to the CVM.                                                                                                                                                         |
| Language                         | Plug-in display language
|  Enable private network API Mode | Whether to access cloud API through private network
| Enable the display type option on the explore page | Enable the display type option on the explore page to control the chart type shown

![Configure Data Source](https://main.qcloudimg.com/raw/b83785ce4e92a85d5749031dbad626d9.png)

## dashboard configuration

1. In the left sidebar, **Create Dashboards**, **Add new panel** on the Dashboard webpage

2. Select the newly created CLS datasource in data source selection

![Select Data Source](https://main.qcloudimg.com/raw/a8cb26d3afbfd1213a3ddee1888692a9.png)

3. Enter the Query statement, select the Format based on the chart type to show, and the system will perform data transformation to meet grafana display requirements.

| Format                            | Description                                                 | Configuration Item        |
   |-------------------------------------| ------------------------------------------------------------ |----------------------|
| Log Panel                           | The Log Panel is used to show Log retrieval results. Query syntax supports searching by keyword and fuzzy match. For more details, see [syntax and Rules](https://intl.cloud.tencent.com/document/product/614/30439). Eg. status:400 | limit: used to specify the number of entries returned |
Table Panel | the Table Panel automatically displays the query results, including all returned columns and rows | None
Graph, Pie, Gauge, Time Series Panel | data is transformed to fit Graph, Pie, Gauge, or Time Series Panel | None

## Example

### Time Series

Show pv and uv data curve

![Time Series](https://main.qcloudimg.com/raw/6f3a420e4a36085a57c23d23297143a1.png)

query statement:

```
* | select histogram( cast(__TIMESTAMP__ as timestamp),interval 1 minute) as time, count(*) as pv,count( distinct remote_addr) as uv group by time order by time limit 1000
```

Format: Select **Graph, Pie, Gauge, Time Series Panel**

### Pie Chart

Show request status code distribution

![Pie](https://main.qcloudimg.com/raw/14c3adbafe7e753ee762e0fce312ee87.png)

query statement:

```
* | select count(*) as count, status group by status
```

Format: Select **Graph, Pie, Gauge, Time Series Panel**

### Bar gauge

Statistics of top 10 webpages by access latency

![Bar](https://main.qcloudimg.com/raw/830bb0cfa6ea07ab468987a766ecb39a.png)

query statement:

```
* | select url, avg(request_time) as lagency group by url order by lagency desc limit 10
```

Format: Select **Graph, Pie, Gauge, Time Series Panel**

### Table

Show top 10 users by access traffic

![Table](https://main.qcloudimg.com/raw/6aebc70dfa66a07ed422be32ab0628dc.png)

query statement:

```
* | select remote_addr,count(*) as count group by remote_addr order by count desc limit 10
```

Format:Table Panel

### Logs

Show raw log

![Logs](https://main.qcloudimg.com/raw/412a26c93a36e36e871c4cd4e96530bf.png)

query statement:

```
*
```

Format:Log Panel

<br/>


## Template Variables [Templates and variables](https://grafana.com/docs/grafana/latest/variables/)
The CLS data source plugin supports the use of template variables. Refer to the [add variable](https://grafana.com/docs/grafana/latest/variables/variable-types/) document to create dashboard variables and use them.
Note: Charts that use template variables cannot be used to create Alarms (https://grafana.com/docs/grafana/latest/alerting/create-alerts/#conditions).


Here is a usage example for Custom, Query, and DataSources variable types. Other variable types are basically the same in usage.

### Custom variable
Enter the variable name Interval, select type as Custom. In Custom Options, add the variable options separated by commas. For example, enter the following content to get the options shown in figure.
```text
1 MINUTE,5 MINUTE,15 MINUTE,30 MINUTE,1 HOUR,1 DAY
```

![Custom Type Variable](https://main.qcloudimg.com/raw/9f9a6ee136ecb01fe5a73f9668f4d4f3.png)

During use, refer to the time line chart in the instance, replace 1 minute with ${Interval} in the Query statement, keep other configuration unchanged, and variables in queries will be replaced with the selected variable value.
```sql
* | select histogram( cast(__TIMESTAMP__ as timestamp),interval ${Interval}) as time, count(*) as pv group by time order by time
```


### Query Type Variable
Enter the variable name HttpStatus, select type as Query. In Query Options, select data source as CLS data source, refresh time available as On Time Range Changed or On Dashboard Load.
Enter the following Query statement (modify according to business Topic), enter Regex to filter results, and select Sort to Sort results.

```sql
* | select status
```
![Query Type Variable](https://main.qcloudimg.com/raw/c5e3e9beb4665b05f957e0bb4ccfea43.png)

When using variables, you can query with the following statement
```sql
status:${HttpStatus}
```

### Cloud API list type variable

Select "Cloud API" for the service type selection variable. The variable dropdown option supports querying via Cloud API (https://cloud.tencent.com/document/api) API requests. Only list-type interfaces are supported for querying.

For example, configure CLS region variables + log topic variables.

region:
```
ServiceType=region&Action=DescribeRegions&payload={"Product":"cls"}
```
topic (all)
```
Region=${region}&ServiceType=cls&Action=DescribeTopics&field=Topics&id=TopicId&name=TopicName
```
topic (filter by TopicName):
```
Region=${region}&ServiceType=cls&Action=DescribeTopics&field=Topics&id=TopicId&name=TopicName&payload={"Filters":[{"Key":"topicName","Values":["your topic name"]}]}
```

![Cloud API List Type Variable](https://main.qcloudimg.com/raw/a261d0c4cdebe36aafa5cc0b73da0aaf.png)
![Cloud API List Type Variable Effect](https://main.qcloudimg.com/raw/095189d680b57386b50408c004ab1bfd.png)

Statement parameter description:

Region (optional): Tencent Cloud region, default `ap-guangzhou`

ServiceType (required): Cloud API service name/product name, such as `cls`

Action (required): Cloud API Interface name, such as `DescribeTopics`

field (DescribeRegions API not required, other required): list returned array field name, such as `Topics`

id (not required for DescribeRegions API, other fields required): list returned with the field name of ID in the instance, such as `TopicId`

name (DescribeRegions API not required, other required): list returned instance name field name in the instance, such as `TopicName`

payload (optional): Other parameters that require the input of the cloud API, in JSON String Format. For example `{"Filters":[{"Key":"topicName","Values":["your topic name"]}]}`

### Datasource variable
Enter the variable name Datasource, select the variable type as Datasource, and set Type to Tencent CLS Datasource in Data source options.
Preview effect usage as follows

Note: Datasource Type variable is applicable only to the case where multiple indexes of CLS data sources with same configuration (or similar) exist in Grafana.

![Datasource Type Variable](https://main.qcloudimg.com/raw/f59b65ef166f440fafab0886d95ba5bf.png)



## Log Query and Troubleshoot

- macOS system log path: /usr/local/var/log/grafana/grafana.log
- Linux system log path: /var/log/grafana/grafana.log
- Troubleshoot: https://grafana.com/docs/grafana/latest/troubleshooting/
- Tencent Cloud log service official website document: https://cloud.tencent.com/document/product/614/52102
