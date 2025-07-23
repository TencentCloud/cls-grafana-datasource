package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/araddon/dateparse"
	clsAPI "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/cls/v20201016"
)

func GetRequestClient() string {
	// return strings.Replace(fmt.Sprint("GF_", common.GrafanaVersion, "_BE_PL_CLS_", common.PluginVersion), ".", "_", -1)
	return strings.Replace(fmt.Sprint("GF_BE_PL_CLS_OLD"), ".", "_", -1)
}

func parseJSONStrings(jsonStrings []*string, ds *ClsDatasource) ([]map[string]interface{}, error) {
	var result []map[string]interface{}

	for _, jsonStr := range jsonStrings {
		if jsonStr == nil {
			continue // 跳过nil指针
		}

		var m, err = parseJSONString(jsonStr, ds)
		if err != nil {
			return nil, err
		}

		result = append(result, m)
	}

	return result, nil
}

func parseJSONString(jsonStr *string, ds *ClsDatasource) (map[string]interface{}, error) {
	var m map[string]interface{}
	err := json.Unmarshal([]byte(*jsonStr), &m)
	ds.logger.Debug("jsonStr", "jsonStr", *jsonStr)
	if err != nil {
		ds.logger.Error("parse json string failed", "err", err, "jsonStr", *jsonStr)
		return nil, fmt.Errorf("parse json string failed: %v, jsonStr: %s", err, *jsonStr)
	}
	return m, nil
}

// 提取LogJson字段并转换为[]*string
func extractLogJsonToPtrSlice(logInfos []*clsAPI.LogInfo, ds *ClsDatasource) ([]map[string]interface{}, error) {
	var result []map[string]interface{}

	for _, logInfo := range logInfos {
		if logInfo != nil {
			var logJson, err = parseJSONString(logInfo.LogJson, ds)
			if err != nil {
				return nil, err
			}
			if _, ok := logJson["__TAG__"].(map[string]interface{}); ok {
				for tagKey, tagValue := range logJson["__TAG__"].(map[string]interface{}) {
					logJson["__TAG__."+tagKey] = tagValue
				}
				delete(logJson, "__TAG__")
			}
			// 取LogJson字段的地址并添加到结果切片
			result = append(result, logJson)
		}
	}

	return result, nil
}

func parseLogJson(logJsonStr *string, ds *ClsDatasource) (map[string]interface{}, error) {
	var logJson, err = parseJSONString(logJsonStr, ds)
	if err != nil {
		return nil, err
	}
	if _, ok := logJson["__TAG__"].(map[string]interface{}); ok {
		for tagKey, tagValue := range logJson["__TAG__"].(map[string]interface{}) {
			logJson["__TAG__."+tagKey] = tagValue
		}
		delete(logJson, "__TAG__")
	}
	// 取LogJson字段的地址并添加到结果切片
	return logJson, nil
}

func Stringify(v interface{}) string {
	str, err := json.Marshal(v)
	if err != nil {
		return err.Error()
	} else {
		return string(str)
	}
}

func convertToTime(val string, ds *ClsDatasource) (time.Time, error) {
	t, tErr := dateparse.ParseLocal(val)
	if tErr != nil {
		ds.logger.Error("convertToTime", "err", val, tErr)
		return time.Unix(0, 0), tErr
	} else {
		return t, nil
	}
}

// TimeToMilliseconds 将time.Time转换为毫秒时间戳
func TimeToMilliseconds(t time.Time) int64 {

	return t.UnixNano() / int64(time.Millisecond)
}

func convertTimeStrToTimestamp(val string, ds *ClsDatasource) (int64, error) {
	var t, err = convertToTime(val, ds)
	return TimeToMilliseconds(t), err
}
