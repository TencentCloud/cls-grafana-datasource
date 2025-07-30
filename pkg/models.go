package main

type JsonData struct {
	SecretId string `json:"SecretId"`
	Intranet bool   `json:"Intranet"`
	Region   string `json:"Region"`
	TopicId  string `json:"TopicId"`
}

type QueryInfo struct {
	QueryType        string `json:"queryType"`
	QueryMode        string `json:"mode"`
	Query            string `json:"query"`
	SyntaxRule       uint64 `json:"syntaxRule"`
	Xcol             string `json:"xcol"`
	Ycol             string `json:"ycol"`
	Tcol             string `json:"tcol"`
	PanelDisplayType string `json:"panelDisplayType"`
	LogsPerPage      int64  `json:"logsPerPage"`
	CurrentPage      int64  `json:"currentPage"`
	MaxResultNumber  int64  `json:"maxResultNumber"`
}
