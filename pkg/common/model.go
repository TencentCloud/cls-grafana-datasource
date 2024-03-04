package common

type ServiceType string

const (
	ServiceTypeLogService ServiceType = "logService"
)

type QueryModel struct {
	LogServiceParams LogServiceParams `json:"logServiceParams"`
	//  业务类型
	ServiceType ServiceType `json:"serviceType"`
}

type LogServiceParams struct {
	Region  string `json:"region"`
	TopicId string `json:"topicId"`
	Query   string `json:"Query"`
}

type ApiOpts struct {
	SecretId  string `json:"secretId"`
	SecretKey string `json:"secretKey"`
	Token     string
	Intranet  bool
}
