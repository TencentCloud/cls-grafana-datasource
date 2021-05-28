package main

import (
	"encoding/json"
	"fmt"
)

func Stringify(v interface{}) string {
	str, err := json.Marshal(v)
	if err != nil {
		return err.Error()
	} else {
		return string(str)
	}
}

func StringifyAll(args ...interface{}) []string {
	var info []string
	for arg := range args {
		info = append(info, Stringify(arg))
	}
	return info
}

func GetRequestClient() string {
	return fmt.Sprint("GF_", GrafanaVersion, "_PL_CLS_", PluginVersion)
}
