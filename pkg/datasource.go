package main

import (
	"context"
	"encoding/json"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/tencentcloud/tencent-cls-grafana-datasource/pkg/cam"
	"github.com/tencentcloud/tencent-cls-grafana-datasource/pkg/cls"
	"github.com/tencentcloud/tencent-cls-grafana-datasource/pkg/common"
	"net/http"
	"os"
	"sync"
)

var logger = log.New()

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
		CheckHealthHandler:  ds,
		QueryDataHandler:    ds,
		CallResourceHandler: newResourceHandler(ds),
	}
}

var _ backend.CheckHealthHandler = (*clsDatasource)(nil)

type clsDatasource struct {
	// The instance manager can help with lifecycle management
	// of datasource instances in plugins. It's not a requirements
	// but a best practice that we recommend that you follow.
	im instancemgmt.InstanceManager
}

func (td *clsDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "ok",
	}, nil
}

func (td *clsDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	//log.DefaultLogger.Info("QueryData called", "request", req)

	response := backend.NewQueryDataResponse()

	opts := getInsSetting(*req.PluginContext.DataSourceInstanceSettings)

	var wg sync.WaitGroup
	for _, query := range req.Queries {
		wg.Add(1)
		go func(q backend.DataQuery) {
			defer wg.Done()
			response.Responses[q.RefID] = td.query(ctx, q, opts)
		}(query)
	}
	wg.Wait()
	return response, nil
}

func (td *clsDatasource) query(ctx context.Context, query backend.DataQuery, opts common.ApiOpts) backend.DataResponse {
	response := backend.DataResponse{}
	// Unmarshal the JSON into our queryModel.
	var qm common.QueryModel

	response.Error = json.Unmarshal(query.JSON, &qm)
	if response.Error != nil {
		return response
	}

	switch qm.ServiceType {
	case common.ServiceTypeLogService:
		return cls.Query(ctx, qm.LogServiceParams, query, opts)
	}
	return response

}

func getInsSetting(instanceSettings backend.DataSourceInstanceSettings) (opts common.ApiOpts) {

	jsonData := map[string]interface{}{}
	_ = json.Unmarshal(instanceSettings.JSONData, &jsonData)

	opts = common.ApiOpts{
		SecretId:  jsonData["secretId"].(string),
		SecretKey: instanceSettings.DecryptedSecureJSONData["secretKey"],
	}

	if useRoleData, ok := jsonData["useRole"]; ok {
		if useRole, ok := useRoleData.(bool); ok && useRole {
			client := cam.NewCredential(os.Getenv("GF_PLUGIN_TENCENTCLOUD_CLS_DATASOURCE_ROLE"))
			id, key, token, err := client.GetSecret()
			if err == nil {
				logger.Debug("using eks credentials id: " + id)
				logger.Debug("using eks credentials key: " + key)
				logger.Debug("using eks credentials token: " + token)
				opts.SecretId = id
				opts.SecretKey = key
				opts.Token = token
			}
		}
	}

	if intranet, ok := jsonData["intranet"]; ok {
		if isIntranet, ok := intranet.(bool); ok {
			opts.Intranet = isIntranet
		}
	}

	return
}

type instanceSettings struct {
	httpClient *http.Client
}

func newDataSourceInstance(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return &instanceSettings{
		httpClient: &http.Client{},
	}, nil
}
