package main

import (
	"context"
	"encoding/json"
	"fmt"
	cls "github.com/tencentcloud/tencent-cls-grafana-datasource/pkg/cls/v20201016"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/errors"
)

// newDatasource returns datasource.ServeOpts.
func newDatasource() datasource.ServeOpts {
	// creates a instance manager for your plugin. The function passed
	// into `NewInstanceManger` is called when the instance is created
	// for the first time or when a datasource configuration changed.
	im := datasource.NewInstanceManager(newDataSourceInstance)
	ds := &clsDatasource{
		im: im,
	}

	return datasource.ServeOpts{
		QueryDataHandler:   ds,
		CheckHealthHandler: ds,
	}
}

// clsDatasource is an example datasource used to scaffold
// new datasource plugins with an backend.
type clsDatasource struct {
	// The instance manager can help with lifecycle management
	// of datasource instances in plugins. It's not a requirements
	// but a best practice that we recommend that you follow.
	im instancemgmt.InstanceManager
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifer).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).

const (
	MaxQueryDataConcurrentGoroutines = 20 // 每个TopicId拥有一个容量为20的并发池
)

// TopicId为key, 并发池为value
var topicIdGoroutinesMap = make(map[string]chan int)

func (td *clsDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	camOpts, jsonData, err := GetApiOpts(*req.PluginContext.DataSourceInstanceSettings)
	if err != nil {
		return nil, err
	}

	if topicIdGoroutinesMap[jsonData.TopicId] == nil {
		topicIdGoroutinesMap[jsonData.TopicId] = make(chan int, MaxQueryDataConcurrentGoroutines)
	}
	queryDataGoroutines := topicIdGoroutinesMap[jsonData.TopicId]

	var wg sync.WaitGroup
	for _, query := range req.Queries {
		wg.Add(1)
		go func(q backend.DataQuery) {
			defer wg.Done()
			queryDataGoroutines <- 1
			response.Responses[q.RefID] = td.query(ctx, q, jsonData, camOpts)
			<-queryDataGoroutines
		}(query)
	}
	wg.Wait()
	return response, nil
}

type queryModel struct {
	Query string `json:"Query"`
	Limit int64  `json:"Limit,omitempty"`
	Sort  string `json:"Sort,omitempty"`
	// 解析使用字段
	Format        string `json:"format,omitempty"`
	TimeSeriesKey string `json:"timeSeriesKey,omitempty"`
	Bucket        string `json:"bucket,omitempty"`
	Metrics       string `json:"metrics,omitempty"`
}

func (td *clsDatasource) query(ctx context.Context, query backend.DataQuery, jsonData *dsJsonData, camOpts CamOpts) backend.DataResponse {
	// Unmarshal the json into our queryModel
	var qm queryModel
	dataRes := backend.DataResponse{}
	dataRes.Error = json.Unmarshal(query.JSON, &qm)
	if dataRes.Error != nil {
		return dataRes
	}

	requestParam := cls.SearchLogRequest{
		TopicId: common.StringPtr(jsonData.TopicId),
		From:    common.Int64Ptr(query.TimeRange.From.UnixNano() / 1e6),
		To:      common.Int64Ptr(query.TimeRange.To.UnixNano() / 1e6),
		Query:   common.StringPtr(qm.Query),
		Sort:    common.StringPtr(qm.Sort),
	}
	if qm.Format == "Log" {
		requestParam.Limit = common.Int64Ptr(qm.Limit)
	}
	searchLogResponse, searchLogErr := SearchLog(ctx, &requestParam, jsonData.Region, camOpts)
	log.DefaultLogger.Info("CLS_API_INFO", Stringify(query), Stringify(searchLogResponse))
	if searchLogErr != nil {
		log.DefaultLogger.Error("CLS_API_ERROR", Stringify(query), Stringify(searchLogErr))
		dataRes.Error = searchLogErr
		return dataRes
	}
	searchLogResult := *searchLogResponse.Response

	switch qm.Format {
	case "Graph":
		{
			if *searchLogResult.Analysis {
				var logItems []map[string]string
				for _, v := range searchLogResult.AnalysisResults {
					logItems = append(logItems, ArrayToMap(v.Data))
				}
				var metricNames []string
				for _, name := range strings.Split(qm.Metrics, ",") {
					for _, me := range searchLogResult.ColNames {
						if name == *me {
							metricNames = append(metricNames, *me)
							break
						}
					}
				}
				dataRes.Frames = Aggregate(logItems, metricNames, qm.Bucket, qm.TimeSeriesKey, query.RefID)
			} else {
				dataRes.Frames = GetLog(searchLogResult.Results, query.RefID)
			}
		}
	case "Table":
		{
			if *searchLogResult.Analysis {
				var logItems []map[string]string
				for _, v := range searchLogResult.AnalysisResults {
					logItems = append(logItems, ArrayToMap(v.Data))
				}
				var colNames []string
				for _, col := range searchLogResult.ColNames {
					colNames = append(colNames, *col)
				}
				dataRes.Frames = TransferRecordToTable(logItems, colNames, query.RefID)
			} else {
				dataRes.Frames = GetLog(searchLogResult.Results, query.RefID)
			}
		}
	case "Log":
		{
			dataRes.Frames = GetLog(searchLogResult.Results, query.RefID)
		}
	}
	return dataRes
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (td *clsDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	camOpts, jsonData, err := GetApiOpts(*req.PluginContext.DataSourceInstanceSettings)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}

	_, err = SearchLog(ctx, &cls.SearchLogRequest{
		TopicId: common.StringPtr(jsonData.TopicId),
		From:    common.Int64Ptr(time.Now().AddDate(0, 0, -1).UnixNano() / 1e6),
		To:      common.Int64Ptr(time.Now().UnixNano() / 1e6),
		Query:   common.StringPtr(""),
		Limit:   common.Int64Ptr(1),
	}, jsonData.Region, camOpts)

	var status = backend.HealthStatusOk
	var message = "CheckHealth Success"
	if _, ok := err.(*errors.TencentCloudSDKError); ok {
		status = backend.HealthStatusError
		message = fmt.Sprintf("An API error has returned: %s", err)
	}
	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}

type instanceSettings struct {
	httpClient *http.Client
}

func newDataSourceInstance(setting backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return &instanceSettings{
		httpClient: &http.Client{},
	}, nil
}

func (s *instanceSettings) Dispose() {
	// Called before creatinga a new instance to allow plugin authors
	// to cleanup.
}
