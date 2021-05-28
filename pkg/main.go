package main

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"os"
)

// PluginVersion https://www.digitalocean.com/community/tutorials/using-ldflags-to-set-version-information-for-go-applications
var PluginVersion = "0.0.0"

// GrafanaVersion https://github.com/grafana/grafana/issues/34356
var GrafanaVersion = "0.0.0"

func main() {
	// Start listening to requests send from Grafana. This call is blocking so
	// it wont finish until Grafana shutsdown the process or the plugin choose
	// to exit close down by itself
	err := datasource.Serve(newDatasource())

	GrafanaVersion = os.Getenv("GF_VERSION")

	// Log any error if we could start the plugin.
	if err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}
