package main

import (
	"encoding/json"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"io"
	"net/http"
	"strings"
	"text/template"
)

type SignResultV3 struct {
	Authorization string `json:"authorization"`
	Token         string `json:"token"`

	Host     string `json:"host"`
	Intranet bool   `json:"intranet"`
}

type SignResultV2 struct {
	Query map[string]interface{} `json:"querystring"`

	Host     string `json:"host"`
	Path     string `json:"path"`
	Intranet bool   `json:"intranet"`
}

func newResourceHandler(ds *clsDatasource) backend.CallResourceHandler {
	mux := http.NewServeMux()

	// register route
	mux.HandleFunc("/sign_v3", ds.SignApi(true))
	mux.HandleFunc("/sign_v2", ds.SignApi(false))

	return httpadapter.New(mux)
}

func (ds *clsDatasource) SignApi(isV3 bool) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		if res, err := ds.getSigned(isV3, req); err != nil {
			rw.WriteHeader(http.StatusBadRequest)
			_, _ = rw.Write([]byte(template.HTMLEscapeString(err.Error())))
			return
		} else {
			data, err := json.Marshal(res)
			if err != nil {
				rw.WriteHeader(http.StatusInternalServerError)
				_, _ = rw.Write([]byte(err.Error()))
				return
			}
			rw.Header().Add("Content-Type", "application/json")
			rw.WriteHeader(http.StatusOK)
			_, _ = rw.Write(data)
		}
	}
}

func (ds *clsDatasource) getSigned(isV3 bool, req *http.Request) (interface{}, error) {
	var query signOpts
	body, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(body, &query)
	if err != nil {
		return nil, err
	}
	datasourceInstanceSettings := httpadapter.PluginConfigFromContext(req.Context()).DataSourceInstanceSettings
	apiOpts := getInsSetting(*datasourceInstanceSettings)
	shouldUseIntranet := false
	if apiOpts.Intranet && isV3 && !strings.Contains(query.Host, "fsi") {
		// use internal host
		shouldUseIntranet = true
		slice := strings.Split(query.Host, "tencentcloudapi.com")
		query.Host = slice[0] + "internal.tencentcloudapi.com"
		logger.Debug("using internal host: " + query.Host)
		for k := range query.Headers {
			if strings.ToLower(k) == "host" {
				query.Headers[k] = query.Host
			}
		}
	}
	if !isV3 {
		signed := signV2(query, apiOpts)
		return &SignResultV2{
			Query:    signed.Querystring,
			Path:     signed.Path,
			Host:     query.Host,
			Intranet: shouldUseIntranet,
		}, nil
	}

	signed := signV3(query, apiOpts)
	return &SignResultV3{
		Authorization: signed,
		Token:         apiOpts.Token,
		Host:          query.Host,
		Intranet:      shouldUseIntranet,
	}, nil
}
