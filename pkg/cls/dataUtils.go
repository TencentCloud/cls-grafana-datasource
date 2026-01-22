package cls

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	clsAPI "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/cls/v20201016"
)

func jsonParse(jsonStr string) (result map[string]interface{}) {
	err := json.Unmarshal([]byte(jsonStr), &result)
	if err != nil {
		log.DefaultLogger.Error("jsonParse error", "jsonStr", jsonStr)
	}
	return
}

// parseTimeString 尝试多种时间格式解析时间字符串
func parseTimeString(timeStr string, loc *time.Location) (time.Time, error) {
	// 常见的时间格式列表，按优先级排序
	formats := []string{
		time.RFC3339,                    // "2006-01-02T15:04:05Z07:00"
		time.RFC3339Nano,                // "2006-01-02T15:04:05.999999999Z07:00"
		time.RFC1123,                    // "Mon, 02 Jan 2006 15:04:05 MST"
		time.RFC822,                     // "02 Jan 06 15:04 MST"
		time.RFC850,                     // "Monday, 02-Jan-06 15:04:05 MST"
		time.ANSIC,                      // "Mon Jan 2 15:04:05 2006"
		time.UnixDate,                   // "Mon Jan 2 15:04:05 MST 2006"
		time.RubyDate,                   // "Mon Jan 02 15:04:05 -0700 2006"
		"2006-01-02T15:04Z",             // ISO8601 UTC格式（小时分钟）
		"2006-01-02T15:04:05Z",          // ISO8601 UTC格式
		"2006-01-02T15:04:05.000Z",      // ISO8601 UTC带毫秒
		"2006-01-02T15:04:05.000000Z",   // ISO8601 UTC带微秒
		"2006-01-02T15:04+08:00",        // ISO8601 带时区偏移（小时分钟）
		"2006-01-02T15:04:05+08:00",     // ISO8601 带时区偏移
		"2006-01-02T15:04:05.000+08:00", // ISO8601 带毫秒和时区偏移
		"2006-01-02T15:04+00:00",        // ISO8601 UTC带时区偏移（小时分钟）
		"2006-01-02T15:04:05+00:00",     // ISO8601 UTC带时区偏移
		"2006-01-02T15:04:05.000+00:00", // ISO8601 UTC带毫秒和时区偏移
		"2006-01-02 15:04",              // MySQL datetime格式
		"2006-01-02 15:04:05",           // MySQL datetime格式
		"2006-01-02 15:04:05.999",       // MySQL datetime with milliseconds
		"2006-01-02 15:04:05.999999",    // MySQL datetime with microseconds
		"2006-01-02",                    // 日期格式
		"15:04:05",                      // 时间格式
		"2006/01/02 15:04:05",           // 斜杠分隔格式
		"2006/01/02",                    // 斜杠分隔日期
		"02/01/2006 15:04:05",           // 欧洲日期格式
		"02/01/2006",                    // 欧洲日期
	}

	// 尝试每种格式
	for _, format := range formats {
		t, err := time.ParseInLocation(format, timeStr, loc)
		if err == nil {
			return t, nil
		}
	}

	// 如果所有格式都失败，尝试解析时间戳（秒或毫秒）
	if timestamp, err := parseTimestamp(timeStr); err == nil {
		return timestamp, nil
	}

	return time.Time{}, fmt.Errorf("unable to parse time string: %s", timeStr)
}

// parseTimestamp 尝试解析时间戳格式
func parseTimestamp(timeStr string) (time.Time, error) {
	// 尝试解析为毫秒级时间戳
	if millisec, err := strconv.ParseInt(timeStr, 10, 64); err == nil {
		if millisec > 1e12 && millisec < 2e12 { // 合理的毫秒时间戳范围
			return time.Unix(millisec/1000, (millisec%1000)*1e6), nil
		}
	}

	// 尝试解析为秒级时间戳
	if sec, err := strconv.ParseInt(timeStr, 10, 64); err == nil {
		if sec > 1e9 && sec < 2e9 { // 合理的Unix时间戳范围
			return time.Unix(sec, 0), nil
		}
	}

	return time.Time{}, fmt.Errorf("not a valid timestamp")
}

func TransferAnalysisRecordsToFrame(list []map[string]interface{}, Columns []clsAPI.Column, framaName string, fieldName string, loc *time.Location) []*data.Frame {

	frame := data.NewFrame(framaName)
	if len(list) == 0 {
		return []*data.Frame{frame}
	}

	for _, col := range Columns {
		newFieldName := *col.Name
		if len(fieldName) > 0 {
			newFieldName = fieldName
		}
		colType := GetFieldTypeByPrestoType(*col.Type)

		switch colType {
		case data.FieldTypeInt64:
			{
				//  由于是将用 map进行 JSON 解析，故这里用 float64
				var m []float64
				for _, v := range list {
					m = append(m, v[*col.Name].(float64))
				}
				frame.Fields = append(frame.Fields, data.NewField(newFieldName, nil, m))
			}
		case data.FieldTypeFloat64:
			{
				var m []float64
				for _, v := range list {
					m = append(m, v[*col.Name].(float64))
				}
				frame.Fields = append(frame.Fields, data.NewField(newFieldName, nil, m))
			}

		case data.FieldTypeTime:
			{
				var m []time.Time
				for _, v := range list {
					t, err := parseTimeString(v[*col.Name].(string), loc)
					if err != nil {
						// 简单的警告日志，避免依赖问题
						log.DefaultLogger.Warn("time parsing failed, using current time", "timeString", v[*col.Name].(string), "error", err)
						m = append(m, time.Now())
					} else {
						m = append(m, t)
					}
				}
				frame.Fields = append(frame.Fields, data.NewField(newFieldName, nil, m))
			}

			//  其他类型默认当字符串类型处理
		default:
			fallthrough
		case data.FieldTypeString:
			{
				var m []string
				for _, v := range list {
					m = append(m, v[*col.Name].(string))
				}
				frame.Fields = append(frame.Fields, data.NewField(newFieldName, nil, m))
			}
		}
	}
	return []*data.Frame{frame}
}

func GetLog(logInfos []*clsAPI.LogInfo, refId string) []*data.Frame {
	frame := data.NewFrame(refId)
	var timeValues []time.Time
	var logValues []string

	for _, v := range logInfos {
		timeValues = append(timeValues, time.Unix(*v.Time/1000, (*v.Time%1000)*1000000))
		logValues = append(logValues, *v.LogJson)

	}
	frame.Fields = append(frame.Fields, data.NewField("Time", nil, timeValues))
	frame.Fields = append(frame.Fields, data.NewField("Log", nil, logValues))
	return []*data.Frame{frame}
}

type PrestoAndFieldType struct {
	prestoTypeRegex string
	fieldType       data.FieldType
}

/** Presto类型与FieldType转化表
 * @doc https://iwiki.woa.com/pages/viewpage.action?pageId=905584985 */
var PrestoAndFieldTypeMap = []PrestoAndFieldType{
	/** 时间类型分为两类，包含日期和不包含日期 */
	{
		prestoTypeRegex: "timestamp with time zone$",
		fieldType:       data.FieldTypeTime,
	},

	{
		prestoTypeRegex: "timestamp$|^date$|^datetime$",
		fieldType:       data.FieldTypeTime,
		// processor: moment,
	},
	{
		prestoTypeRegex: "time$",
		fieldType:       data.FieldTypeTime,
		// processor: null,
	},
	/** 数字类型。整数、浮点数、定点数 */

	{
		prestoTypeRegex: "tinyint$|^samllint$|^integer$|^bigint$|^long$",
		fieldType:       data.FieldTypeInt64,
		// processor: Number,
	},
	{
		prestoTypeRegex: "real$|^double$|^decimal$",
		fieldType:       data.FieldTypeInt64,
		// processor: Number,
	},
	/** 字符串。字符串和单字符 */
	{
		prestoTypeRegex: "varchar$|^char$|^text$|^keyword$",
		fieldType:       data.FieldTypeString,
		// processor: String,
	},
	{
		prestoTypeRegex: "boolean$",
		fieldType:       data.FieldTypeBool,
		// processor: Boolean,
	},

	/** 未定情况，做简单降级方案 */
	{
		prestoTypeRegex: "uuid$",
		fieldType:       data.FieldTypeString,
		// processor: String,
	},
	{
		prestoTypeRegex: "ipaddress$",
		fieldType:       data.FieldTypeString,
		// processor: String,
	},
	{
		prestoTypeRegex: "array\\(.*\\)",
		fieldType:       data.FieldTypeUnknown,
		// processor: Array.from,
	},
	{
		prestoTypeRegex: "json$",
		fieldType:       data.FieldTypeUnknown,
		// processor: JSON.parse,
	},
	{
		prestoTypeRegex: "map\\(.*\\)", // "map\([\w\s,]+,[\w\s,]+\)",
		fieldType:       data.FieldTypeUnknown,
		// processor: (i) => i,
	},
	{
		prestoTypeRegex: "varbinary$",
		fieldType:       data.FieldTypeUnknown,
		// processor: Array.from,
	},
	{
		prestoTypeRegex: "interval$",
		fieldType:       data.FieldTypeUnknown,
		// processor: String,
	},
	{
		prestoTypeRegex: "row$",
		fieldType:       data.FieldTypeUnknown,
		// processor: String,
	},
}

func GetFieldTypeByPrestoType(prestoType string) data.FieldType {
	for _, item := range PrestoAndFieldTypeMap {
		matched, _ := regexp.Match(item.prestoTypeRegex, []byte(prestoType))
		if matched == true {
			return item.fieldType
		}
	}
	return data.FieldTypeUnknown
}
