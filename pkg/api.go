package main

import (
	"encoding/json"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	cls "github.com/tencentcloud/tencent-cls-grafana-datasource/pkg/cls/v20201016"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
)

type dsJsonData struct {
	Region  string `json:"region"`
	TopicId string `json:"topicId"`
}

type ApiOpts struct {
	SecretId  string `json:"secretId"`
	SecretKey string `json:"secretKey"`
	Region    string `json:"region"`
	TopicId   string `json:"topicId"`
}

type SearchLogParam struct {
	// 要查询的日志主题ID
	TopicId *string `json:"TopicId,omitempty" name:"TopicId"`

	// 要查询的日志的起始时间，Unix时间戳，单位ms
	From *int64 `json:"From,omitempty" name:"From"`

	// 要查询的日志的结束时间，Unix时间戳，单位ms
	To *int64 `json:"To,omitempty" name:"To"`

	// 查询语句，语句长度最大为1024
	Query *string `json:"Query,omitempty" name:"Query"`

	// 单次查询返回的日志条数，最大值为100
	Limit *int64 `json:"Limit,omitempty" name:"Limit"`

	// 加载更多日志时使用，透传上次返回的Context值，获取后续的日志内容
	Context *string `json:"Context,omitempty" name:"Context"`

	// 日志接口是否按时间排序返回；可选值：asc(升序)、desc(降序)，默认为 desc
	Sort *string `json:"Sort,omitempty" name:"Sort"`

	// 是否返回检索的高亮结果
	HighLight *bool `json:"HighLight,omitempty" name:"HighLight"`
}

func SearchLog(param *SearchLogParam, opts ApiOpts) (response *cls.SearchLogResponse, err error) {
	credential := common.NewCredential(opts.SecretId, opts.SecretKey)
	cpf := profile.NewClientProfile()
	cpf.Debug = true

	// 实例化要请求产品（以 cvm 为例）的 client 对象
	client, _ := cls.NewClient(credential, opts.Region, cpf)
	// 实例化一个请求对象，根据调用的接口和实际情况，可以进一步设置请求参数
	request := cls.NewSearchLogRequest()
	request.TopicId = param.TopicId
	request.From = param.From
	request.To = param.To
	request.Query = param.Query
	request.Limit = param.Limit
	request.Context = param.Context
	request.Sort = param.Sort
	request.HighLight = param.HighLight

	// 通过 client 对象调用想要访问的接口，需要传入请求对象
	response, err = client.SearchLog(request)
	return
}

func GetInsSetting(instanceSettings backend.DataSourceInstanceSettings) (opts ApiOpts) {
	var dsData dsJsonData
	err := json.Unmarshal(instanceSettings.JSONData, &dsData)
	if err != nil {
		log.DefaultLogger.Error(err.Error())
	}
	opts = ApiOpts{
		SecretId:  instanceSettings.DecryptedSecureJSONData["secretId"],
		SecretKey: instanceSettings.DecryptedSecureJSONData["secretKey"],
		Region:    dsData.Region,
		TopicId:   dsData.TopicId,
	}
	return
}
