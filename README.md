# Grafana展示CLS数据

日志服务CLS与Grafana打通，支持将CLS的原始日志数据与SQL聚合分析结果导出至Grafana展示。用户只需安装CLS日志服务grafana插件，在grafana填写检索分析的语句，即可在Grafana上展示结果。

> 注意：当前 old 分支只支持在 Grafana 6 版本运行。如需在更新版本Grafana运行，请切换至main分支。


## 前提条件

安装 Grafana 6版本，具体操作请参见[Grafana安装文档](https://grafana.com/docs/grafana/latest/installation/) 。

   以 RPM-based Linux 为例，可使用 [源安装](https://grafana.com/docs/grafana/latest/installation/rpm/#install-from-yum-repository) (推荐) 与 [手动安装](https://grafana.com/docs/grafana/latest/installation/rpm/#install-manually-with-yum) 方式

   [启动 Grafana 服务](https://grafana.com/docs/grafana/latest/installation/rpm/#2-start-the-server)
   ```sh
   sudo systemctl daemon-reload
   sudo systemctl start grafana-server
   sudo systemctl status grafana-server
   sudo systemctl enable grafana-server
   ```

   若需要安装更多可视化图表，如饼图，趋势速览图，需执行命令安装grafana的panel插件，如安装饼图pie panel。
   ```sh
   grafana-cli plugins install grafana-piechart-panel
   service grafana-server restart
   ```

   更多插件安装请参考[Grafana plugins](https://grafana.com/grafana/plugins?type=panel)

## 安装CLS对接Grafana插件

对于不同的 Grafana 安装方式，需要通过以下不同方式安装 CLS 数据源插件。

### 服务器安装部署

1. 请确认Grafana的插件目录位置。在Centos的插件目录/var/lib/grafana/plugins/安装插件，重启grafana-server。

   ```sh
   cd /var/lib/grafana/plugins/
   wget https://github.com/TencentCloud/cls-grafana-datasource/releases/download/v0.1.1/tencent-cls-grafana-datasource.zip
   unzip tencent-cls-grafana-datasource
   ```

2. 修改Grafana配置文件，配置CLS数据源ID。配置文件路径参考[配置文档](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/)
  * 1. 在**plugins**中设置**allow_loading_unsigned_plugins**参数
```
[plugins]
allow_loading_unsigned_plugins = tencent-cls-grafana-datasource
```
  * 2. 在**dataproxy**中设置**timeout**, **dialTimeout**, **keep_alive_seconds**参数
```
[dataproxy]
timeout = 60
dialTimeout = 60
keep_alive_seconds = 60
```

3. 重启grafana服务
```sh
service grafana-server restart
```

### Docker部署

参考[Docker中安装Grafana插件指引](https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/#install-plugins-in-the-docker-container)，通过以下环境变量安装CLS插件。

docker run命令：
```
docker run -d -p 3000:3000 --name=grafana6 \
  -e "GF_INSTALL_PLUGINS=https://github.com/TencentCloud/cls-grafana-datasource/releases/download/v0.1.1/tencent-cls-grafana-datasource.zip;tencent-cls-grafana-datasource,https://github.com/grafana/piechart-panel/releases/download/v1.6.4/grafana-piechart-panel-1.6.4.zip;grafana-piechart-panel" \
  -e "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=tencent-cls-grafana-datasource" \
  -e "GF_DATAPROXY_TIMEOUT=60" \
  -e "GF_DATAPROXY_DIALTIMEOUT=60" \
  -e "GF_DATAPROXY_KEEP_ALIVE_SECONDS=60" \
  grafana/grafana:6.5.3
```

docker compose:
```
version: '3'

services:
  grafana:
    image: grafana/grafana:6.5.3
    container_name: grafana
    ports:
      - '3000:3000'
    environment:
      - GF_INSTALL_PLUGINS=https://github.com/TencentCloud/cls-grafana-datasource/releases/download/v0.1.1/tencent-cls-grafana-datasource.zip;tencent-cls-grafana-datasource,https://github.com/grafana/piechart-panel/releases/download/v1.6.4/grafana-piechart-panel-1.6.4.zip;grafana-piechart-panel
      - GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=tencent-cls-grafana-datasource
      - GF_DATAPROXY_TIMEOUT=60
      - GF_DATAPROXY_DIALTIMEOUT=60
      - GF_DATAPROXY_KEEP_ALIVE_SECONDS=60
```

## 配置日志数据源

1. 登陆Grafana

   > 若您是本机部署，默认是安装在3000端口。请提前在浏览器打开3000端口

2. 左侧菜单栏点击设置图标，进入**Data Sources**

   在**Data Sources**页，单击**Add data source**，选中**Tencent Cloud Log Service Datasource**，按照以下说明配置数据源。

   | 配置项                    | 说明                                                                          |
   |--------------------------|-----------------------------------------------------------------------------|
   | SecretId, SecretKey      | API请求密钥，用于身份鉴权。获取地址前往[API密钥管理](https://console.cloud.tencent.com/cam/capi)。 |
   | Region                   | 地域，如 ap-guangzhou。                                                          |
   | TopicId                  | 日志主题ID。如 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx。                              |
   | Enable Intranet API Mode | 是否通过内网访问云API。                                                               |

   ![配置数据源](https://main.qcloudimg.com/raw/c070ad7a091b167de55527b0fd51c38b.png)

## dashboard配置

1. 在左侧导航栏， **Creat Dashboards**，Dashboard页面**Add new panel**

2. 数据源选择用户刚刚新建的CLS datasource

   ![选择数据源](https://main.qcloudimg.com/raw/b6c39c32c4a45f26997efcdcfb2d3055.png)

3. 用户输入Query语句、x轴、y轴。下方具体事例会针对具体介绍x轴、y轴配置方式。

## 示例

### Graph 折线图

展示请求状态码按时间分布

![Time Series](https://main.qcloudimg.com//raw/893f9fe08a074c9c2a89ff5b0258ad18.png)

query语句：

```
* | SELECT count(*) AS cnt, cast("status" as varchar) AS "status", histogram(__TIMESTAMP__, INTERVAL 10 SECOND) AS analytic_time WHERE "status" IN (SELECT "status" GROUP BY "status" ORDER BY count(*) DESC LIMIT 5) GROUP BY analytic_time, "status" LIMIT 10000
```

y轴：status#:#cnt

其中status作为维度字段，cnt作为指标字段

x轴(时间字段): analytic_time

### 饼图 Pie

展示请求状态码分布

![Pie](https://main.qcloudimg.com/raw/37d9ed83e755ab591d4ed402bdd50ee1.png)

query语句：

```
* | select "status", count(*) as cnt ,concat(cast(round(100.0 * count(*)/(select count(*)),2) as varchar),'%') as pct group by "status" order by cnt desc limit 1000
```

y轴：status,cnt

其中status作为维度字段，cnt作为指标字段

x轴(时间字段): pie

### 柱状图，压力图 Bar gauge

展示请求状态码分布

![Bar](https://main.qcloudimg.com/raw/f64ade671ec7191adb2b5eee64e3c261.png)

y轴：status,cnt

其中status作为维度字段，cnt作为指标字段

x轴(时间字段): pie

### 表格Table

展示各IP访问量及百分比

![Table](https://main.qcloudimg.com/raw/e7e3c02116f1b1d9eb99f54a1084a9f3.png)

query语句：

```
* | select "remote_addr", count(*) as cnt ,concat(cast(round(100.0 * count(*)/(select count(*)),2) as varchar),'%') as pct group by "remote_addr" order by cnt desc limit 1000
```

y轴：指定列 或 空

x轴(时间字段): table 或 空

### 日志 Logs

展示原始日志

![Logs](https://main.qcloudimg.com/raw/dcc1eece9bf83e56e9d19c0a0e0ea331.png)

query语句：

```
*
```

y轴：空

x轴(时间字段): table 或 空

<br/>

## 模板变量 [Templates and variables](https://grafana.com/docs/grafana/latest/variables/)
CLS 数据源插件支持使用模板变量功能，可参照 [新增变量](https://grafana.com/docs/grafana/latest/variables/variable-types/) 文档，创建仪表盘中的变量并使用。
注意：[使用模板变量的图表无法用于告警](https://grafana.com/docs/grafana/latest/alerting/create-alerts/#conditions)


这里就 Custom、Query、DataSources 类型变量给出一个使用示例, 其他变量类型使用上基本相同。

### Custom 类型变量
输入变量名 Interval, 选择类型为 Custom, 在Custom Options中，输入变量的可选项，不同选项间使用逗号分隔。如输入以下内容可得到图中所示选项。
```text
1 MINUTE,5 MINUTE,15 MINUTE,30 MINUTE,1 HOUR,1 DAY
```

![Custom类型变量](https://main.qcloudimg.com/raw/505ffeed49b94a23070f624eef7971dc.png)

使用时，可参照实例中的 时间折线图Graph，将查询语句中的 1 minute 替换为 ${Interval}, 其他配置不变，查询Query中的变量将会被替换为选中的变量值。
```sql
* | select histogram( cast(__TIMESTAMP__ as timestamp),interval ${Interval}) as time, count(*) as pv group by time order by time
```

### Query 类型变量
输入变量名 HttpStatus, 选择类型为 Query，在Query Options中，选择数据源为CLS数据源，刷新时间可选择 On Time Range Changed 或 On Dashboard Load。
输入如下的 Query 查询语句(请根据业务Topic进行修改)，且可输入Regex对结果进行过滤，可选择Sort对结果进行排序。

```sql
status:* | select distinct(status) as status
```
![Query类型变量](https://main.qcloudimg.com/raw/3140fc015b0be06320501026bac58f6e.png)

使用变量时，可通用以下语句进行查询
```sql
status:${HttpStatus}
```

### Datasource 类型变量
输入变量名 Datasource, 选中变量类型为 Datasource，在Data source options中配置 Type 为 Tencent CLS Datasource。
使用预览效果如下

注意：Datasource 类型变量仅适用于Grafana中存在多个索引配置相同(或相似)的CLS数据源的情况

![Datasource类型变量](https://main.qcloudimg.com/raw/1fae4df60fce1a0dab8761b672b3e37b.png)


## 日志查询与问题排查

- macOS系统日志路径：/usr/local/var/log/grafana/grafana.log
- Linux系统日志路径：/var/log/grafana/grafana.log
- 问题排查：https://grafana.com/docs/grafana/latest/troubleshooting/
- 腾讯云日志服务官网文档：https://cloud.tencent.com/document/product/614/52102
