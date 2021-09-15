package main

import (
	"context"
	"encoding/json"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	cls "github.com/tencentcloud/tencent-cls-grafana-datasource/pkg/cls/v20201016"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	tchttp "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/http"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	"golang.org/x/time/rate"
)

var cpf = profile.NewClientProfile()
var intranetCpf = profile.NewClientProfile()

func init() {
	intranetCpf.HttpProfile.RootDomain = "internal.tencentcloudapi.com"
}

var limiter = rate.NewLimiter(10, 10)

func SearchLog(ctx context.Context, param *cls.SearchLogRequest, region string, opts CamOpts) (response *cls.SearchLogResponse, err error) {
	_ = limiter.Wait(ctx)

	credential := common.NewTokenCredential(opts.SecretId, opts.SecretKey, opts.SecretToken)
	var client, _ = cls.NewClient(credential, region, cpf)
	if opts.Intranet {
		client, _ = cls.NewClient(credential, region, intranetCpf)
	}

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

	injectRequestClientHeader(request)
	// 通过 client 对象调用想要访问的接口，需要传入请求对象
	response, err = client.SearchLog(request)
	return
}

// 与 MyDataSourceOptions 对应
type dsJsonData struct {
	Region   string `json:"region"`
	TopicId  string `json:"topicId"`
	Intranet bool   `json:"intranet"`
}

// CamOpts 与特定请求无关的通用请求数据，主要用于鉴权
type CamOpts struct {
	SecretId    string `json:"secretId"`
	SecretKey   string `json:"secretKey"`
	SecretToken string `json:"secretToken"`
	Intranet    bool   `json:"intranet"`
}

func GetApiOpts(instanceSettings backend.DataSourceInstanceSettings) (camOpts CamOpts, dsData *dsJsonData, err error) {
	err = json.Unmarshal(instanceSettings.JSONData, &dsData)
	if err != nil {
		log.DefaultLogger.Error(err.Error())
	}

	secretId := instanceSettings.DecryptedSecureJSONData["secretId"]
	secretKey := instanceSettings.DecryptedSecureJSONData["secretKey"]
	var token string

	if RoleInstance && secretId == "" && secretKey == "" {
		secretId, secretKey, token, err = GetUserSecretByRole()
		if err != nil {
			log.DefaultLogger.Error("CLS_CREDENTIAL_ERROR ROLE ", err.Error())
			return
		}
		log.DefaultLogger.Info("CLS_CREDENTIAL_INFO ROLE ", "secretId", secretId, "secretKey", secretKey)
	}

	camOpts = CamOpts{
		SecretId:    instanceSettings.DecryptedSecureJSONData["secretId"],
		SecretKey:   instanceSettings.DecryptedSecureJSONData["secretKey"],
		SecretToken: token,
		Intranet:    dsData.Intranet,
	}
	return
}

func injectRequestClientHeader(request tchttp.Request) {
	params := request.GetParams()
	params["RequestClient"] = GetRequestClient()
}
