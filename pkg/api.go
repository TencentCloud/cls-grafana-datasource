package main

import (
	cls "github.com/tencentcloud/tencent-cls-grafana-datasource/pkg/cls/v20201016"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
)

func SearchLog() (response *cls.SearchLogResponse, err error) {
	// 这里采用的是从环境变量读取的方式，需要在环境变量中先设置这两个值
	credential := common.NewCredential("", "")

	// 实例化一个客户端配置对象，可以指定超时时间等配置
	cpf := profile.NewClientProfile()
	//cpf.HttpProfile.ReqMethod = "GET"
	//cpf.HttpProfile.ReqTimeout = 5
	cpf.Debug = true

	// 实例化要请求产品（以 cvm 为例）的 client 对象
	client, _ := cls.NewClient(credential, "ap-chongqing", cpf)
	// 实例化一个请求对象，根据调用的接口和实际情况，可以进一步设置请求参数
	request := cls.NewSearchLogRequest()

	request.Query = common.StringPtr(string(""))
	request.TopicId = common.StringPtr("")
	request.Limit = common.Int64Ptr(1)
	request.From = common.Int64Ptr(1609084800000)
	request.To = common.Int64Ptr(1609413753246)
	//request.Context = common.StringPtr(string("123"))
	//request.Sort = common.StringPtr(string(rune(123)))
	//request.HighLight = common.BoolPtr(false)

	// 通过 client 对象调用想要访问的接口，需要传入请求对象
	response, err = client.SearchLog(request)
	return
	// 处理异常
	//if _, ok := err.(*errors.TencentCloudSDKError); ok {
	//  fmt.Printf("An API error has returned: %s", err)
	//  return
	//}
	//// unexpected errors
	//if err != nil {
	//  panic(err)
	//}
	//// 打印返回的 json 字符串
	//fmt.Printf("%s", response.ToJsonString())
}
