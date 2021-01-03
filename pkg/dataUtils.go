package main

import (
	"github.com/araddon/dateparse"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	cls "github.com/tencentcloud/tencent-cls-grafana-datasource/pkg/cls/v20201016"
	"strconv"
	"time"
)

func ArrayToMap(arr []*cls.LogItem) map[string]string {
	m := map[string]string{}
	for _, v := range arr {
		m[*v.Key] = *v.Value
	}
	return m
}

func GroupBy(list []map[string]string, groupBy string) map[string][]map[string]string {
	m := map[string][]map[string]string{}
	for _, item := range list {
		groupByKey := item[groupBy]
		if _, ok := m[groupByKey]; ok {
			m[groupByKey] = append(m[groupByKey], item)
		} else {
			m[groupByKey] = []map[string]string{item}
		}
	}
	return m
}

func Aggregate(list []map[string]string,
	metricNames []string,
	aggregateKey string,
	timeSeriesKey string,
	refId string,
) []*data.Frame {
	var frames []*data.Frame
	if len(aggregateKey) > 0 {
		groupedData := GroupBy(list, aggregateKey)
		for k, v := range groupedData {
			frames = append(frames, TransferRecordToFields(v, k, metricNames, timeSeriesKey))
		}
	} else {
		frames = append(frames, TransferRecordToFields(list, refId, metricNames, timeSeriesKey))
	}
	return frames
}

func TransferRecordToFields(list []map[string]string, fieldName string, colNames []string, timeSeriesKey string) *data.Frame {
	frame := data.NewFrame(fieldName)

	if len(timeSeriesKey) > 0 {
		var timeValues []time.Time
		for _, item := range list {
			timeValues = append(timeValues, convertToTime(item[timeSeriesKey]))
		}
		frame.Fields = append(frame.Fields, data.NewField(timeSeriesKey, nil, timeValues))
	} else {
		var timeValues []time.Time
		for _ = range list {
			timeValues = append(timeValues, time.Unix(0, 0))
		}
		frame.Fields = append(frame.Fields, data.NewField("time", nil, timeValues))
	}

	for _, col := range colNames {
		colType := typeInfer(list[0][col])
		switch colType {
		case "int64":
			{
				var m []int64
				for _, v := range list {
					num, numErr := strconv.ParseInt(v[col], 10, 64)
					if numErr != nil {
						m = append(m, 0)
					} else {
						m = append(m, num)
					}
				}
				frame.Fields = append(frame.Fields, data.NewField(col, nil, m))
			}
		case "float64":
			{
				var m []float64
				for _, v := range list {
					num, numErr := strconv.ParseFloat(v[col], 64)
					if numErr != nil {
						m = append(m, 0)
					} else {
						m = append(m, num)
					}
				}
				frame.Fields = append(frame.Fields, data.NewField(col, nil, m))
			}
		case "string":
			{
				var m []string
				for _, v := range list {
					m = append(m, v[col])
				}
				frame.Fields = append(frame.Fields, data.NewField(col, nil, m))
			}
		}
	}
	return frame
}

func convertToTime(val string) time.Time {
	t, tErr := dateparse.ParseLocal(val)
	if tErr != nil {
		return time.Unix(0, 0)
	} else {
		return t
	}
}

func typeInfer(val string) string {
	_, numErr := strconv.ParseInt(val, 10, 64)
	if numErr == nil {
		return "int64"
	} else {
		_, floErr := strconv.ParseFloat(val, 64)
		if floErr == nil {
			return "float64"
		} else {
			return "string"
		}
	}
}
