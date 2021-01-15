# Grafana展示CLS数据

日志服务CLS与Grafana打通，支持将CLS的原始日志数据与SQL聚合分析结果导出至Grafana展示。用户只需安装CLS日志服务grafana插件，在grafana填写检索分析的语句，即可在Grafana上展示结果。


## 前提条件

1. 安装 Grafana，具体操作请参见[Grafana官网文档](https://grafana.com/docs/grafana/latest/installation/)

   以Centos安装grafana 7.3.6为例

   ```
   sudo yum install initscripts urw-fonts wget
   wget https://dl.grafana.com/oss/release/grafana-7.3.6-1.x86_64.rpm
   sudo yum install grafana-7.3.6-1.x86_64.rpm
   sudo systemctl daemon-reload
   sudo systemctl start grafana-server
   sudo systemctl status grafana-server 
   sudo systemctl enable grafana-server  
   ```

   若需要安装更多可视化图表，如饼图，趋势速览图，需执行命令安装grafana的panel插件，如安装饼图pie panel。

   ```
   grafana-cli plugins install grafana-piechart-panel
   service grafana-server restart
   ```

   更多插件安装请参考[Grafana plugins](https://grafana.com/grafana/plugins?type=panel)

2. 安装CLS对接Grafana插件

   请确认Grafana的插件目录位置。在Centos的插件目录/var/lib/grafana/plugins/安装插件，重启grafana-server。

   ```
   cd /var/lib/grafana/plugins/
   wget https://github.com/TencentCloud/cls-grafana-datasource/releases/latest/download/cls-grafana-datasource.zip
   unzip cls-grafana-datasource.zip
   ```

   如果安装的是Grafana 7.0及以上版本，需修改Grafana配置文件

1. 打开配置文件。

- macOS系统中的文件路径：/usr/local/etc/grafana/grafana.ini
- Linux系统中的文件路径：/etc/grafana/grafana.ini

2. 在**plugins**中设置**allow_loading_unsigned_plugins**参数

   ```
   allow_loading_unsigned_plugins = tencent-cls-grafana-datasource
   ```

重启grafana服务

   ```
   service grafana-server restart
   ```

3. 配置日志数据源

1. 登陆Grafana

   > 若您是本机部署，默认是安装在3000端口。请提前在浏览器打开3000端口

2. 左侧菜单栏点击设置图标，进入**Data Sources**

   在**Data Sources**页，单击**Add data source**，选中**Tencent Cloud Log Service Datasource**，按照以下说明配置数据源。

   | 配置项               | 说明                                                         |
   | -------------------- | ------------------------------------------------------------ |
   | Security Credentials | SecretId、SecretKey：API请求密钥，用于身份鉴权。获取地址前往[API密钥管理](https://console.cloud.tencent.com/cam/capi) |
   | Log Service Info     | region：日志服务区域简称，例如北京区域填写`ap-beijing`，完整区域列表格式参考 [地域列表](https://cloud.tencent.com/document/product/614/18940)。<br />TopicId：日志主题ID |

   ![image-20201229200229285](https://main.qcloudimg.com/raw/275835ded7a0826d6027984ab9aa0b84.png)

## dashboard配置

1. 在左侧导航栏， **Creat Dashboards**，Dashboard页面**Add new panel**

2. 数据源选择用户刚刚新建的CLS datasource

   ![image-20201229200254913](https://main.qcloudimg.com/raw/b0981c7c5e43d803d0eb694f3b737060.png)

3. 用户输入Query语句，根据待展示图表类型，选择Format形式，系统会做数据转换以满足grafana展示需要。

   | Format格式            | 描述                                                         | 配置项                                                       |
   | --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
   | Log panel             | log panel is used to shown log search result. Query syntax supports searching by keyword, fuzzy match. For more information, see [Syntax and Rules](https://intl.cloud.tencent.com/document/product/614/30439). Eg. status:400 | limit:用于指定返回日志检索结果条数                           |
   | Table panle           | Table panel will automatically show the results of whatever columns and rows your query returns | 无                                                           |
   | Graph,Pie,Gauge panel | In this pattern, there is a format transformation where data will be adapted to graph,pie,gauge panel | Metrics：待统计指标<br />Bucket：（选填）聚合列名称 <br />Time : （选填）若query返回结果为连续时间数据，则需指定 time 字段。若无，则不填写 |

## 示例

### 时间折线图Graph

展示pv，uv数据曲线

![image-20201230174944290](https://main.qcloudimg.com/raw/a2251243a6e592bed01ad372a8ebbc55.png)

query语句：

```
* | select histogram( cast(__TIMESTAMP__ as timestamp),interval 1 minute) as time, count(*) as pv,count( distinct remote_addr) as uv group by time order by time limit 1000
```

Format：选择 **Graph,Pie,Gauge panel**

Metrics：**pv，uv**

Bucket：无聚合列，**不填写**

Time : **time**

### 饼图Pie

展示请求状态码分布

![image-20201229205154667](https://main.qcloudimg.com/raw/95bee33d6332e70ee01c49c5f69d13ac.png)

query语句：

```
* | select count(*) as count, status group by status
```

Format：选择 **Graph,Pie,Gauge panel**

Metrics：**count**

Bucket：**status**

Time：不是连续时间数据，**不填**

### 柱状图，压力图bar gauge

统计访问延时前10页面

![image-20201230175052388](https://main.qcloudimg.com/raw/c8c9cade19d03458a99747b851a2df4e.png)

query语句：

```
* | select http_referer,avg(request_time) as lagency group by http_referer order by lagency desc limit 10
```

Format：选择 **Graph,Pie,Gauge panel**

Metrics：lagency

Bucket：http_referer

Time：不是连续时间数据，**不填**

### 表格Table

展示访问量前10用户

![image-20201229211653406](https://main.qcloudimg.com/raw/afbde7667f22458e5ae6e34ede848a56.png)

query语句：

```
* | select remote_addr,count(*) as count group by remote_addr order by count desc limit 10
```

Format：Table

<br/>
