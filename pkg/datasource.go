package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	"golang.org/x/net/context"

	"github.com/grafana/grafana-plugin-model/go/datasource"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin"
	"github.com/samber/lo"
	clsAPI "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/cls/v20201016"
)

type ClsDatasource struct {
	plugin.NetRPCUnsupportedPlugin
	logger hclog.Logger
}

var cpf = profile.NewClientProfile()
var intranetCpf = profile.NewClientProfile()

type PanelType string

const (
	TimeseriesType PanelType = "timeseries"
	TableType      PanelType = "table"
	LogsType       PanelType = "logs"
)

func init() {
	intranetCpf.HttpProfile.RootDomain = "internal.tencentcloudapi.com"
}

func (ds *ClsDatasource) Query(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {

	//ds.logger.Debug("Query", "datasource", tsdbReq.Datasource.Name, "TimeRange", tsdbReq.TimeRange)

	jsonData := JsonData{}

	err := json.Unmarshal([]byte(tsdbReq.Datasource.JsonData), &jsonData)
	if err != nil {
		ds.logger.Error("Unmarshal logSource", "error ", err)
		return nil, err
	}

	SecretId := jsonData.SecretId
	if len(SecretId) == 0 {
		ds.logger.Error("SecretId cannot be null")
		return nil, errors.New("SecretId cannot be null")
	}
	SecretKey := tsdbReq.Datasource.DecryptedSecureJsonData["SecretKey"]
	if len(SecretKey) == 0 {
		ds.logger.Error("SecretKey cannot be null")
		return nil, errors.New("SecretKey cannot be null")
	}
	Region := jsonData.Region
	if len(Region) == 0 {
		ds.logger.Error("Region cannot be null")
		return nil, errors.New("Region cannot be null")
	}
	TopicId := jsonData.TopicId
	if len(TopicId) == 0 {
		ds.logger.Error("TopicId cannot be null")
		return nil, errors.New("TopicId cannot be null")
	}

	credential := common.NewTokenCredential(SecretId, SecretKey, "")
	var client *clsAPI.Client
	if jsonData.Intranet {
		client, _ = clsAPI.NewClient(credential, Region, intranetCpf)
	} else {
		client, _ = clsAPI.NewClient(credential, Region, cpf)
	}
	injectRequestClientHeader(client)

	queries := tsdbReq.Queries

	from := tsdbReq.TimeRange.FromEpochMs
	to := tsdbReq.TimeRange.ToEpochMs

	var results []*datasource.QueryResult

	ch := make(chan *datasource.QueryResult, len(queries))

	for _, query := range queries {
		go ds.QueryLogs(ch, query, client, jsonData, from, to)
	}
	c := 0
	for result := range ch {
		c = c + 1
		if c == len(queries) {
			close(ch)
		}
		results = append(results, result)
	}
	rt := &datasource.DatasourceResponse{
		Results: results,
	}
	return rt, nil
}

// 统计插件用户量
func injectRequestClientHeader(client *clsAPI.Client) {
	client.WithRequestClient(GetRequestClient())
}

func (ds *ClsDatasource) GetValue(v interface{}) *datasource.RowValue {
	rowValue := &datasource.RowValue{}

	switch val := v.(type) {
	case string:
		rowValue.StringValue = val
		rowValue.Kind = datasource.RowValue_TYPE_STRING
	case bool:
		rowValue.BoolValue = val
		rowValue.Kind = datasource.RowValue_TYPE_BOOL
	case nil:
		rowValue.Kind = datasource.RowValue_TYPE_NULL
	case int, int32, int64:
		rowValue.Int64Value = val.(int64)
		rowValue.Kind = datasource.RowValue_TYPE_INT64
	case float32, float64:
		rowValue.DoubleValue = val.(float64)
		rowValue.Kind = datasource.RowValue_TYPE_DOUBLE
	default:
		// 其他类型处理
		rowValue.StringValue = fmt.Sprintf("%v", val)
		rowValue.Kind = datasource.RowValue_TYPE_STRING
	}
	return rowValue
}

func (ds *ClsDatasource) ParseTimestamp(v string) (int64, error) {
	floatV, err := strconv.ParseFloat(v, 10)
	if err != nil {
		return 0, err
	}
	int64V := int64(floatV)
	return int64V, nil
}

func (ds *ClsDatasource) SortLogs(logs []map[string]interface{}, xcol string) {
	sort.Slice(logs, func(i, j int) bool {
		timestamp1, err := convertTimeStrToTimestamp(fmt.Sprintf("%v", logs[i][xcol]), ds)
		if err != nil {
			ds.logger.Error("SortLogs1", "error ", err)
		}
		timestamp2, err := convertTimeStrToTimestamp(fmt.Sprintf("%v", logs[j][xcol]), ds)
		if err != nil {
			ds.logger.Error("SortLogs2", "error ", err)
		}
		if timestamp1 < timestamp2 {
			return true
		}
		return false
	})
}

func (ds *ClsDatasource) QueryLogs(ch chan *datasource.QueryResult, query *datasource.Query, client *clsAPI.Client, jsonData JsonData, from int64, to int64) {
	modelJson := query.ModelJson

	queryInfo := &QueryInfo{}
	err := json.Unmarshal([]byte(modelJson), &queryInfo)
	if err != nil {
		ds.logger.Error("Unmarshal queryInfo", "error ", err)
		ch <- &datasource.QueryResult{
			Error: err.Error(),
		}
		return
	}

	panelDisplayType := queryInfo.PanelDisplayType
	// 时间列
	tcol := queryInfo.Tcol

	queryType := queryInfo.QueryType
	if queryType == "histograms" {
		request := clsAPI.NewDescribeLogHistogramRequest()
		request.TopicId = common.StringPtr(jsonData.TopicId)
		request.From = common.Int64Ptr(from)
		request.To = common.Int64Ptr(to)
		request.Query = common.StringPtr(queryInfo.Query)
		request.SyntaxRule = common.Uint64Ptr(queryInfo.SyntaxRule)
		ds.logger.Info("DescribeLogHistogram request", "request", Stringify(request))

		describeHistogramsResp, err := client.DescribeLogHistogram(request)
		if err != nil {
			ds.logger.Error("DescribeLogHistogram ", "query : ", queryInfo.Query, "error ", err)
			ch <- &datasource.QueryResult{
				Error: err.Error(),
			}
			return
		}
		ds.logger.Info("SearchLog RequestId", "RequestId : ", *describeHistogramsResp.Response.RequestId)
		ds.logger.Debug("SearchLog Result ", "result : ", Stringify(*describeHistogramsResp.Response))
		ch <- &datasource.QueryResult{
			RefId:    query.RefId,
			MetaJson: "{\"count\":" + strconv.FormatInt(*describeHistogramsResp.Response.TotalCount, 10) + "}",
		}
		return
	}
	// 维度列
	var xcols []string = lo.Filter(strings.Split(queryInfo.Xcol, ","), func(str string, _ int) bool {
		return str != ""
	})
	// 指标列
	var ycols []string
	request := clsAPI.NewSearchLogRequest()
	request.TopicId = common.StringPtr(jsonData.TopicId)
	request.From = common.Int64Ptr(from)
	request.To = common.Int64Ptr(to)
	request.Query = common.StringPtr(queryInfo.Query)
	request.UseNewAnalysis = common.BoolPtr(true)
	request.SyntaxRule = common.Uint64Ptr(queryInfo.SyntaxRule)
	request.Limit = common.Int64Ptr(queryInfo.MaxResultNumber)
	ds.logger.Info("SearchLog request", "request", Stringify(request))

	searchLogResponse, err := client.SearchLog(request)
	if err != nil {
		ds.logger.Error("SearchLog Error", "request", Stringify(request), "error ", err)
		ch <- &datasource.QueryResult{
			Error: err.Error(),
		}
		return
	}
	searchLogResult := *searchLogResponse.Response
	ds.logger.Info("SearchLog RequestId", "RequestId : ", *searchLogResult.RequestId)
	ds.logger.Debug("SearchLog Result ", "result : ", Stringify(searchLogResult))

	isFlowGraph := strings.Contains(queryInfo.Ycol, "#:#")
	if isFlowGraph {
		ycols = lo.Filter(strings.Split(queryInfo.Ycol, "#:#"), func(str string, _ int) bool {
			return str != ""
		})
	} else {
		ycols = lo.Filter(strings.Split(queryInfo.Ycol, ","), func(str string, _ int) bool {
			return str != ""
		})
	}

	var series []*datasource.TimeSeries
	var tables []*datasource.Table
	if !*searchLogResult.Analysis {
		ds.BuildLogs(ch, searchLogResult.Results, &tables)
		ch <- &datasource.QueryResult{
			RefId:    query.RefId,
			Tables:   tables,
			Series:   series,
			MetaJson: "",
		}
		return
	} else {
		var logs, err = parseJSONStrings(searchLogResult.AnalysisRecords, ds)
		var columns = searchLogResult.Columns
		if err != nil {
			ds.logger.Error("parseJSONStrings", "error ", err)
			ch <- &datasource.QueryResult{
				Error: err.Error(),
			}
		}
		logColumnsMap := make(map[string]bool)
		for _, column := range columns {
			logColumnsMap[*column.Name] = true
		}

		if tcol == "" {
			// display type is timeseries, but not set any time columns, should display first time columns
			timeColumnNames := lo.Map(
				lo.Filter(columns, func(column *clsAPI.Column, _ int) bool {
					return isTimeColumn(*column.Type)
				}),
				func(column *clsAPI.Column, _ int) string { return *column.Name },
			)
			if len(timeColumnNames) > 0 {
				tcol = timeColumnNames[0]
				ds.logger.Debug("no time columns found. use first time column", "columns", timeColumnNames[0])
			}
		}
		if len(xcols) < 1 {
			// display type is timeseries, but not set any dimension columns, should display all dimension columns
			textColumnNames := lo.Map(
				lo.Filter(columns, func(column *clsAPI.Column, _ int) bool {
					return isTextColumn(*column.Type) && *column.Name != tcol
				}),
				func(column *clsAPI.Column, _ int) string { return *column.Name },
			)
			if len(textColumnNames) > 0 {
				xcols = append(xcols, textColumnNames...)
				ds.logger.Debug("no dimension columns found. use all text columns as dimensions", "columns", textColumnNames)
			}
		}
		if len(ycols) < 1 {
			// display type is timeseries, but not set any metric columns, should display all metric columns
			numericColumnNames := lo.Map(
				lo.Filter(columns, func(column *clsAPI.Column, _ int) bool {
					return isNumericColumn(*column.Type)
				}),
				func(column *clsAPI.Column, _ int) string { return *column.Name },
			)
			if len(numericColumnNames) > 0 {
				ycols = append(ycols, numericColumnNames...)
				ds.logger.Debug("no metric columns found. use all numeric columns as metric", "columns", numericColumnNames)
			}
		}

		xcols = lo.Filter(xcols, func(xcol string, _ int) bool {
			if !logColumnsMap[xcol] {
				ds.logger.Debug(fmt.Sprintf("dimension column \"%s\" is not in search result columns", xcol))
			}
			return logColumnsMap[xcol]
		})
		ycols = lo.Filter(ycols, func(ycol string, _ int) bool {
			if !logColumnsMap[ycol] {
				ds.logger.Debug(fmt.Sprintf("metric column \"%s\" is not in search result columns", ycol))
			}
			return logColumnsMap[ycol]
		})
		if isFlowGraph {
			ds.BuildFlowGraph(ch, logs, tcol, xcols, ycols, query.RefId)
			return
		} else if panelDisplayType == string(TimeseriesType) {
			ds.BuildTimingGraph(ch, logs, tcol, xcols, ycols, &series)
		} else {
			ds.BuildTable(ch, logs, tcol, xcols, ycols, columns, &tables)
		}
		ch <- &datasource.QueryResult{
			RefId:  query.RefId,
			Series: series,
			Tables: tables,
		}
	}

}

func (ds *ClsDatasource) BuildFlowGraph(ch chan *datasource.QueryResult, logs []map[string]interface{}, tcol string, xcols []string, ycols []string, refId string) {
	ds.SortLogs(logs, tcol)
	if len(ycols) < 2 {
		ch <- &datasource.QueryResult{
			Error: "The len of ycols must greater than or equals to 2 ",
		}
	}
	var set map[string]bool
	set = make(map[string]bool)
	for _, alog := range logs {
		set[fmt.Sprintf("%v", alog[ycols[0]])] = true
	}
	var series []*datasource.TimeSeries
	for flowId := range set {
		var points []*datasource.Point
		for _, alog := range logs {
			if flowId == alog[ycols[0]] {
				if len(ycols) < 2 || alog[ycols[1]] == "null" {
					continue
				}
				floatV, err := strconv.ParseFloat(fmt.Sprintf("%v", alog[ycols[1]]), 10)
				if err != nil {
					ds.logger.Error("ParseFloat ycols[1]", "error ", err)
					ch <- &datasource.QueryResult{
						Error: err.Error(),
					}
					return
				}
				floatV1, err := convertTimeStrToTimestamp(fmt.Sprintf("%v", alog[tcol]), ds)
				if err != nil {
					ds.logger.Error("convertTimeStrToTimestamp xcol", "error ", err)
					ch <- &datasource.QueryResult{
						Error: err.Error(),
					}
					return
				}
				int64V := int64(floatV1)
				point := &datasource.Point{
					Timestamp: int64V,
					Value:     floatV,
				}
				points = append(points, point)
			}
		}
		timeSeries := &datasource.TimeSeries{
			Name:   flowId,
			Points: points,
		}
		series = append(series, timeSeries)
	}
	ch <- &datasource.QueryResult{
		RefId:  refId,
		Series: series,
	}
}

func (ds *ClsDatasource) BuildTimingGraph(ch chan *datasource.QueryResult, logs []map[string]interface{}, tcol string, xCols []string, ycols []string, series *[]*datasource.TimeSeries) {
	ds.SortLogs(logs, tcol)
	ds.logger.Debug("BuildTimingGraph logs", "logs ", logs)
	if len(xCols) > 0 {
		// has dimensions
		// group by dimension
		var groupedDimensions = lo.GroupBy(logs, func(alog map[string]interface{}) string {
			// Create a JSON object with all xCols key-values
			dimensionObj := make(map[string]interface{})
			for _, col := range xCols {
				if val, exists := alog[col]; exists {
					dimensionObj[col] = val
				}
			}
			dimensionJson, _ := json.Marshal(dimensionObj)
			return string(dimensionJson)
		})
		for seriesName, groupedLogs := range groupedDimensions {
			// build timeseries for each dimension
			// dimensionValue is a json string, like. { a:1, b:2 }
			ds.BuildTimingGraphCore(ch, groupedLogs, tcol, ycols, seriesName, series)
		}
	} else {
		// has no dimensions
		ds.BuildTimingGraphCore(ch, logs, tcol, ycols, "", series)
	}

}

func (ds *ClsDatasource) BuildTimingGraphCore(ch chan *datasource.QueryResult, logs []map[string]interface{}, tcol string, ycols []string, seriesName string, series *[]*datasource.TimeSeries) {
	yColLen := len(ycols)
	for _, ycol := range ycols {
		var points []*datasource.Point
		for _, alog := range logs {
			var timestamp int64
			var value float64
			for k, v := range alog {
				if k == tcol {
					var err error
					timestamp, err = convertTimeStrToTimestamp(fmt.Sprintf("%v", v), ds)
					if err != nil {
						ds.logger.Error("convertTimeStrToTimestamp v", "error ", err)
						ch <- &datasource.QueryResult{
							Error: err.Error(),
						}
						return
					}
				}
				if k == ycol {
					if v == "null" {
						continue
					}
					floatV, err := strconv.ParseFloat(fmt.Sprintf("%v", v), 10)
					if err != nil {
						ds.logger.Error("ParseFloat v", "error ", err)
						ch <- &datasource.QueryResult{
							Error: err.Error(),
						}
						return
					}
					value = floatV
				}
			}
			point := &datasource.Point{
				Timestamp: timestamp,
				Value:     value,
			}
			points = append(points, point)
		}
		timeSeriesName := ycol
		if seriesName != "" {
			if yColLen == 1 {
				timeSeriesName = seriesName
			} else {
				timeSeriesName = fmt.Sprintf("%s %s", ycol, seriesName)
			}
		}
		timeSeries := &datasource.TimeSeries{
			Name:   timeSeriesName,
			Points: points,
		}
		*series = append(*series, timeSeries)
	}
}

func (ds *ClsDatasource) BuildTable(ch chan *datasource.QueryResult, logs []map[string]interface{}, tcol string, xcol []string, ycols []string, resColumns []*clsAPI.Column, tables *[]*datasource.Table) {
	var columns []*datasource.TableColumn
	availableColumns := lo.Filter(resColumns, func(item *clsAPI.Column, index int) bool {
		columnName := *item.Name
		return columnName == tcol || lo.Contains(ycols, columnName) || lo.Contains(xcol, columnName)
	})
	if len(availableColumns) < 1 {
		availableColumns = resColumns
	}
	for _, ycol := range availableColumns {
		columns = append(columns, &datasource.TableColumn{
			Name: *ycol.Name,
		})
		ds.logger.Debug("BuildTable resColumns", "ycol name", *ycol.Name, "ycol type", *ycol.Type)
	}
	var rows []*datasource.TableRow
	for _, alog := range logs {
		var values []*datasource.RowValue
		for _, col := range columns {
			for k, v := range alog {
				if k == col.Name {
					values = append(values, ds.GetValue(v))
				}
			}
		}
		rows = append(rows, &datasource.TableRow{Values: values})
	}
	table := &datasource.Table{
		Columns: columns,
		Rows:    rows,
	}
	*tables = append(*tables, table)
}

func (ds *ClsDatasource) BuildLogs(ch chan *datasource.QueryResult, logInfos []*clsAPI.LogInfo, tables *[]*datasource.Table) {
	var columns []*datasource.TableColumn
	columns = append(columns, &datasource.TableColumn{
		Name: "Time",
	})
	columns = append(columns, &datasource.TableColumn{
		Name: "Log",
	})

	var rows []*datasource.TableRow
	for _, logInfo := range logInfos {
		var values []*datasource.RowValue

		for _, column := range columns {
			switch column.Name {
			case "Time":
				values = append(values, &datasource.RowValue{
					Kind:       datasource.RowValue_TYPE_INT64,
					Int64Value: *logInfo.Time,
				})
			case "Log":
				var logJson, err = parseLogJson(logInfo.LogJson, ds)
				if err != nil {
					ds.logger.Error("Unmarshal logSource", "error ", err)
					values = append(values, &datasource.RowValue{
						Kind:        datasource.RowValue_TYPE_STRING,
						StringValue: *logInfo.LogJson,
					})
				} else {
					if *logInfo.Source != "" {
						logJson["__SOURCE__"] = *logInfo.Source
					}
					if *logInfo.FileName != "" {
						logJson["__FILENAME__"] = *logInfo.FileName
					}
					if *logInfo.HostName != "" {
						logJson["__HOSTNAME__"] = *logInfo.HostName
					}

					message := ""
					var keys []string
					for k := range logJson {
						keys = append(keys, k)
					}
					sort.Strings(keys)
					for _, k := range keys {
						v := logJson[k]
						message = message + k + "=" + fmt.Sprintf("%v", v) + " "
					}

					values = append(values, &datasource.RowValue{
						Kind:        datasource.RowValue_TYPE_STRING,
						StringValue: message,
					})
				}

			}
		}

		rows = append(rows, &datasource.TableRow{Values: values})
	}
	table := &datasource.Table{
		Columns: columns,
		Rows:    rows,
	}
	*tables = append(*tables, table)
}

// 判断是否为时间类型列
func isTimeColumn(columnType string) bool {
	matched, _ := regexp.MatchString(`(?i)^(timestamp with time zone|timestamp|date|datetime)$`, columnType)
	return matched
}
func isTextColumn(columnType string) bool {
	matched, _ := regexp.MatchString(`(?i)^(varchar|char|text|keyword|uuid|ipaddress|time|time with time zone)$`, columnType)
	return matched
}
func isNumericColumn(columnType string) bool {
	matched, _ := regexp.MatchString(`(?i)^(real|double|decimal|tinyint|samllint|integer|bigint|long)$`, columnType)
	return matched
}
