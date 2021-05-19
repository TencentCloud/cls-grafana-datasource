// Copyright (c) 2017-2018 THL A29 Limited, a Tencent company. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package v20201016

import (
	"encoding/json"

	tchttp "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/http"
)

type HighLightItem struct {

	// 高亮的日志Key
	Key *string `json:"Key,omitempty" name:"Key"`

	// 高亮的语法
	Values []*string `json:"Values,omitempty" name:"Values" list`
}

type LogInfo struct {

	// 日志时间，单位ms
	Time *int64 `json:"Time,omitempty" name:"Time"`

	// 日志主题ID
	TopicId *string `json:"TopicId,omitempty" name:"TopicId"`

	// 日志主题名称
	TopicName *string `json:"TopicName,omitempty" name:"TopicName"`

	// 日志来源IP
	Source *string `json:"Source,omitempty" name:"Source"`

	// 日志文件名称
	FileName *string `json:"FileName,omitempty" name:"FileName"`

	// 日志上报请求包的ID
	PkgId *string `json:"PkgId,omitempty" name:"PkgId"`

	// 请求包内日志的ID
	PkgLogId *string `json:"PkgLogId,omitempty" name:"PkgLogId"`

	// 日志内容，由多个LogItem (KV结构）组成
	Logs []*LogItem `json:"Logs,omitempty" name:"Logs" list`

	// 日志内容的高亮描述信息
	// 注意：此字段可能返回 null，表示取不到有效值。
	HighLights []*HighLightItem `json:"HighLights,omitempty" name:"HighLights" list`

	// 日志内容的Json序列化字符串
	// 注意：此字段可能返回 null，表示取不到有效值。
	LogJson *string `json:"LogJson,omitempty" name:"LogJson"`
}

type LogItem struct {

	// 日志Key
	Key *string `json:"Key,omitempty" name:"Key"`

	// 日志Value
	Value *string `json:"Value,omitempty" name:"Value"`
}

type LogItems struct {

	// 分析结果返回的KV数据对
	Data []*LogItem `json:"Data,omitempty" name:"Data" list`
}

type SearchLogRequest struct {
	*tchttp.BaseRequest

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

func (r *SearchLogRequest) ToJsonString() string {
	b, _ := json.Marshal(r)
	return string(b)
}

func (r *SearchLogRequest) FromJsonString(s string) error {
	return json.Unmarshal([]byte(s), &r)
}

type SearchLogResponse struct {
	*tchttp.BaseResponse
	Response *struct {

		// 加载后续内容的Context
		Context *string `json:"Context,omitempty" name:"Context"`

		// 日志查询结果是否全部返回
		ListOver *bool `json:"ListOver,omitempty" name:"ListOver"`

		// 返回的是否为分析结果
		Analysis *bool `json:"Analysis,omitempty" name:"Analysis"`

		// 如果Analysis为True，则返回分析结果的列名，否则为空
		// 注意：此字段可能返回 null，表示取不到有效值。
		ColNames []*string `json:"ColNames,omitempty" name:"ColNames" list`

		// 日志查询结果；当Analysis为True时，可能返回为null
		// 注意：此字段可能返回 null，表示取不到有效值。
		Results []*LogInfo `json:"Results,omitempty" name:"Results" list`

		// 日志分析结果；当Analysis为False时，可能返回为null
		// 注意：此字段可能返回 null，表示取不到有效值。
		AnalysisResults []*LogItems `json:"AnalysisResults,omitempty" name:"AnalysisResults" list`

		// 唯一请求 ID，每次请求都会返回。定位问题时需要提供该次请求的 RequestId。
		RequestId *string `json:"RequestId,omitempty" name:"RequestId"`
	} `json:"Response"`
}

func (r *SearchLogResponse) ToJsonString() string {
	b, _ := json.Marshal(r)
	return string(b)
}

func (r *SearchLogResponse) FromJsonString(s string) error {
	return json.Unmarshal([]byte(s), &r)
}
