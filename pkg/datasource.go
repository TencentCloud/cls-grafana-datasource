package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	"sort"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-model/go/datasource"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin"
	clsAPI "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/cls/v20201016"
	"golang.org/x/net/context"
)

type ClsDatasource struct {
	plugin.NetRPCUnsupportedPlugin
	logger hclog.Logger
}

var cpf = profile.NewClientProfile()
var intranetCpf = profile.NewClientProfile()

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
	xcol := queryInfo.Xcol

	queryType := queryInfo.QueryType
	if queryType == "histograms" {
		request := clsAPI.NewDescribeLogHistogramRequest()
		request.TopicId = common.StringPtr(jsonData.TopicId)
		request.From = common.Int64Ptr(from)
		request.To = common.Int64Ptr(to)
		request.Query = common.StringPtr(queryInfo.Query)
		request.SyntaxRule = common.Uint64Ptr(1)
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

	var ycols []string
	request := clsAPI.NewSearchLogRequest()
	request.TopicId = common.StringPtr(jsonData.TopicId)
	request.From = common.Int64Ptr(from)
	request.To = common.Int64Ptr(to)
	request.Query = common.StringPtr(queryInfo.Query)
	request.UseNewAnalysis = common.BoolPtr(true)
	request.SyntaxRule = common.Uint64Ptr(1)
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

	queryInfo.Ycol = strings.Replace(queryInfo.Ycol, " ", "", -1)
	isFlowGraph := strings.Contains(queryInfo.Ycol, "#:#")
	if isFlowGraph {
		ycols = strings.Split(queryInfo.Ycol, "#:#")
	} else {
		ycols = strings.Split(queryInfo.Ycol, ",")
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

		if isFlowGraph {
			ds.BuildFlowGraph(ch, logs, xcol, ycols, query.RefId)
			return
		} else if xcol == "pie" {
			ds.BuildPieGraph(ch, logs, xcol, ycols, query.RefId)
			return
		} else if xcol != "" && xcol != "map" && xcol != "pie" && xcol != "bar" && xcol != "table" {
			ds.BuildTimingGraph(ch, logs, xcol, ycols, &series)
		} else {
			ds.BuildTable(ch, logs, xcol, ycols, columns, &tables)
		}
		ch <- &datasource.QueryResult{
			RefId:  query.RefId,
			Series: series,
			Tables: tables,
		}
	}

}

func (ds *ClsDatasource) BuildFlowGraph(ch chan *datasource.QueryResult, logs []map[string]interface{}, xcol string, ycols []string, refId string) {
	ds.SortLogs(logs, xcol)
	if len(ycols) < 2 {
		ch <- &datasource.QueryResult{
			Error: "The len of ycols must greater than 2 ",
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
				if alog[ycols[1]] == "null" {
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
				floatV1, err := convertTimeStrToTimestamp(fmt.Sprintf("%v", alog[xcol]), ds)
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

func (ds *ClsDatasource) BuildPieGraph(ch chan *datasource.QueryResult, logs []map[string]interface{}, xcol string, ycols []string, refId string) {
	if len(ycols) < 2 {
		ch <- &datasource.QueryResult{
			Error: "The len of ycols must greater than 2 ",
		}
	}
	var series []*datasource.TimeSeries
	for _, alog := range logs {
		if alog[ycols[1]] == "null" {
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
		point := &datasource.Point{
			Timestamp: 0,
			Value:     floatV,
		}
		var points []*datasource.Point
		points = append(points, point)
		timeSeries := &datasource.TimeSeries{
			Name:   fmt.Sprintf("%v", alog[ycols[0]]),
			Points: points,
		}
		series = append(series, timeSeries)
	}

	ch <- &datasource.QueryResult{
		RefId:  refId,
		Series: series,
	}
}

func (ds *ClsDatasource) BuildTimingGraph(ch chan *datasource.QueryResult, logs []map[string]interface{}, xcol string, ycols []string, series *[]*datasource.TimeSeries) {
	ds.SortLogs(logs, xcol)
	for _, ycol := range ycols {
		var points []*datasource.Point
		for _, alog := range logs {
			var timestamp int64
			var value float64
			for k, v := range alog {
				if k == xcol {
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
		timeSeries := &datasource.TimeSeries{
			Name:   ycol,
			Points: points,
		}
		*series = append(*series, timeSeries)
	}
}

func (ds *ClsDatasource) BuildTable(ch chan *datasource.QueryResult, logs []map[string]interface{}, xcol string, ycols []string, resColumns []*clsAPI.Column, tables *[]*datasource.Table) {
	var columns []*datasource.TableColumn

	if len(ycols) > 0 && !(len(ycols) == 1 && ycols[0] == "") {
		for _, ycol := range ycols {
			columns = append(columns, &datasource.TableColumn{
				Name: ycol,
			})
			ds.logger.Debug("BuildTable ycols", "ycol ", ycol)

		}
	} else {
		for _, ycol := range resColumns {
			columns = append(columns, &datasource.TableColumn{
				Name: *ycol.Name,
			})
			ds.logger.Debug("BuildTable resColumns", "ycol name", *ycol.Name, "ycol type", *ycol.Type)
		}
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
