package cls

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	clsAPI "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/cls/v20201016"
)

func TestTransferAnalysisRecordsToFrameHandlesNullableValues(t *testing.T) {
	loc := time.UTC
	columns := []clsAPI.Column{
		{Name: stringPtr("message"), Type: stringPtr("varchar")},
		{Name: stringPtr("count"), Type: stringPtr("bigint")},
		{Name: stringPtr("ratio"), Type: stringPtr("double")},
		{Name: stringPtr("created_at"), Type: stringPtr("timestamp")},
		{Name: stringPtr("ok"), Type: stringPtr("boolean")},
		{Name: stringPtr("payload"), Type: stringPtr("json")},
		{Name: stringPtr("missing"), Type: stringPtr("varchar")},
	}
	list := []map[string]interface{}{
		{
			"message":    "hello",
			"count":      float64(1),
			"ratio":      "2.5",
			"created_at": "2026-06-26 11:39:44",
			"ok":         true,
			"payload":    map[string]interface{}{"k": "v"},
		},
		{
			"message":    nil,
			"count":      nil,
			"ratio":      "",
			"created_at": nil,
			"ok":         "false",
			"payload":    nil,
		},
		{
			"message":    float64(42),
			"count":      "3.5",
			"ratio":      []byte("4.25"),
			"created_at": "not-a-time",
			"ok":         1,
			"payload":    []string{"a", "b"},
		},
	}

	frames := TransferAnalysisRecordsToFrame(list, columns, "frame", "", loc)
	if len(frames) != 1 {
		t.Fatalf("expected 1 frame, got %d", len(frames))
	}
	frame := frames[0]
	if frame.Name != "frame" {
		t.Fatalf("unexpected frame name: %q", frame.Name)
	}
	if got := len(frame.Fields); got != len(columns) {
		t.Fatalf("expected %d fields, got %d", len(columns), got)
	}

	message := frame.Fields[0]
	assertField(t, message, "message", data.FieldTypeNullableString, 3)
	assertStringPtr(t, message.At(0), "hello")
	assertNilAt(t, message, 1)
	assertStringPtr(t, message.At(2), "42")

	count := frame.Fields[1]
	assertField(t, count, "count", data.FieldTypeNullableFloat64, 3)
	assertFloatPtr(t, count.At(0), 1)
	assertNilAt(t, count, 1)
	assertFloatPtr(t, count.At(2), 3.5)

	ratio := frame.Fields[2]
	assertField(t, ratio, "ratio", data.FieldTypeNullableFloat64, 3)
	assertFloatPtr(t, ratio.At(0), 2.5)
	assertNilAt(t, ratio, 1)
	assertFloatPtr(t, ratio.At(2), 4.25)

	createdAt := frame.Fields[3]
	assertField(t, createdAt, "created_at", data.FieldTypeNullableTime, 3)
	expectedTime := time.Date(2026, 6, 26, 11, 39, 44, 0, time.UTC)
	assertTimePtr(t, createdAt.At(0), expectedTime)
	assertNilAt(t, createdAt, 1)
	assertNilAt(t, createdAt, 2)

	ok := frame.Fields[4]
	assertField(t, ok, "ok", data.FieldTypeNullableBool, 3)
	assertBoolPtr(t, ok.At(0), true)
	assertBoolPtr(t, ok.At(1), false)
	assertBoolPtr(t, ok.At(2), true)

	payload := frame.Fields[5]
	assertField(t, payload, "payload", data.FieldTypeNullableString, 3)
	assertStringPtr(t, payload.At(0), "map[k:v]")
	assertNilAt(t, payload, 1)
	assertStringPtr(t, payload.At(2), "[a b]")

	missing := frame.Fields[6]
	assertField(t, missing, "missing", data.FieldTypeNullableString, 3)
	assertNilAt(t, missing, 0)
	assertNilAt(t, missing, 1)
	assertNilAt(t, missing, 2)
}

func TestTransferAnalysisRecordsToFrameHandlesColumnMetadataEdges(t *testing.T) {
	columns := []clsAPI.Column{
		{Name: nil, Type: stringPtr("varchar")},
		{Name: stringPtr("unknown_type"), Type: nil},
	}
	list := []map[string]interface{}{{"unknown_type": "value"}}

	frames := TransferAnalysisRecordsToFrame(list, columns, "", "", time.UTC)
	if len(frames) != 1 {
		t.Fatalf("expected 1 frame, got %d", len(frames))
	}
	frame := frames[0]
	if got := len(frame.Fields); got != 1 {
		t.Fatalf("expected nil-name column to be skipped, got %d fields", got)
	}
	assertField(t, frame.Fields[0], "unknown_type", data.FieldTypeNullableString, 1)
	assertStringPtr(t, frame.Fields[0].At(0), "value")
}

func TestTransferAnalysisRecordsToFrameAppliesFieldNameOverride(t *testing.T) {
	columns := []clsAPI.Column{{Name: stringPtr("message"), Type: stringPtr("varchar")}}
	list := []map[string]interface{}{{"message": "hello"}}

	frames := TransferAnalysisRecordsToFrame(list, columns, "", "alias", time.UTC)
	if len(frames) != 1 || len(frames[0].Fields) != 1 {
		t.Fatalf("unexpected frames: %#v", frames)
	}
	assertField(t, frames[0].Fields[0], "alias", data.FieldTypeNullableString, 1)
	assertStringPtr(t, frames[0].Fields[0].At(0), "hello")
}

func stringPtr(v string) *string {
	return &v
}

func assertField(t *testing.T, field *data.Field, name string, fieldType data.FieldType, length int) {
	t.Helper()
	if field.Name != name {
		t.Fatalf("unexpected field name: got %q want %q", field.Name, name)
	}
	if field.Type() != fieldType {
		t.Fatalf("unexpected field type for %s: got %v want %v", name, field.Type(), fieldType)
	}
	if field.Len() != length {
		t.Fatalf("unexpected field length for %s: got %d want %d", name, field.Len(), length)
	}
}

func assertNilAt(t *testing.T, field *data.Field, idx int) {
	t.Helper()
	if !field.NilAt(idx) {
		t.Fatalf("expected %s[%d] to be nil, got %#v", field.Name, idx, field.At(idx))
	}
}

func assertStringPtr(t *testing.T, got interface{}, want string) {
	t.Helper()
	value, ok := got.(*string)
	if !ok || value == nil {
		t.Fatalf("expected *string %q, got %#v", want, got)
	}
	if *value != want {
		t.Fatalf("unexpected string: got %q want %q", *value, want)
	}
}

func assertFloatPtr(t *testing.T, got interface{}, want float64) {
	t.Helper()
	value, ok := got.(*float64)
	if !ok || value == nil {
		t.Fatalf("expected *float64 %v, got %#v", want, got)
	}
	if *value != want {
		t.Fatalf("unexpected float: got %v want %v", *value, want)
	}
}

func assertTimePtr(t *testing.T, got interface{}, want time.Time) {
	t.Helper()
	value, ok := got.(*time.Time)
	if !ok || value == nil {
		t.Fatalf("expected *time.Time %v, got %#v", want, got)
	}
	if !value.Equal(want) {
		t.Fatalf("unexpected time: got %v want %v", *value, want)
	}
}

func assertBoolPtr(t *testing.T, got interface{}, want bool) {
	t.Helper()
	value, ok := got.(*bool)
	if !ok || value == nil {
		t.Fatalf("expected *bool %v, got %#v", want, got)
	}
	if *value != want {
		t.Fatalf("unexpected bool: got %v want %v", *value, want)
	}
}
