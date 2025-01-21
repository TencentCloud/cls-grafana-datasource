package assumeRole

import (
	"fmt"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/errors"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/regions"
	sts "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/sts/v20180813"
	"sync"
	"time"
)

type metadataResponse struct {
	TmpSecretId  string
	TmpSecretKey string
	Token        string
	ExpiredTime  int64
	Code         string
}

type Credential struct {
	sync.Mutex
	expiredTime int64
	id          string
	key         string
	token       string
	baseId      string
	baseKey     string
	roleArn     string
	isIntranet  bool
}

// NewCredential return eks credential store with token refresh service
func NewCredential(id string, key string, roleArn string, isIntranet bool) *Credential {
	return &Credential{
		baseId:     id,
		baseKey:    key,
		roleArn:    roleArn,
		isIntranet: isIntranet,
	}
}

func (c *Credential) GetSecret() (string, string, string, error) {
	c.Lock()
	defer c.Unlock()

	// invalidate credentials one minute before actual expired time, to avoid errors in following requests
	if time.Now().Unix() > c.expiredTime-60 {
		if err := c.refresh(); err != nil {
			return "", "", "", err
		}
	}
	return c.id, c.key, c.token, nil
}

func (c *Credential) refresh() error {
	// 实例化一个认证对象，入参需要传入腾讯云账户 SecretId 和 SecretKey，此处还需注意密钥对的保密
	// 代码泄露可能会导致 SecretId 和 SecretKey 泄露，并威胁账号下所有资源的安全性。以下代码示例仅供参考，建议采用更安全的方式来使用密钥，请参见：https://cloud.tencent.com/document/product/1278/85305
	// 密钥可前往官网控制台 https://console.cloud.tencent.com/cam/capi 进行获取
	credential := common.NewCredential(
		c.baseId,
		c.baseKey,
	)
	// 实例化一个client选项，可选的，没有特殊需求可以跳过
	cpf := profile.NewClientProfile()

	if c.isIntranet {
		cpf.HttpProfile.Endpoint = "sts.internal.tencentcloudapi.com"
	} else {
		cpf.HttpProfile.Endpoint = "sts.tencentcloudapi.com"
	}
	// 实例化要请求产品的client对象,clientProfile是可选的
	client, _ := sts.NewClient(credential, regions.Guangzhou, cpf)

	// 实例化一个请求对象,每个接口都会对应一个request对象
	request := sts.NewAssumeRoleRequest()
	request.RoleArn = common.StringPtr(c.roleArn)
	request.RoleSessionName = common.StringPtr("cls-grafana-datasource")

	// 返回的resp是一个AssumeRoleResponse的实例，与请求对象对应
	response, err := client.AssumeRole(request)
	if _, ok := err.(*errors.TencentCloudSDKError); ok {
		fmt.Printf("An API error has returned: %s", err)
		return nil
	}
	if err != nil {
		panic(err)
	}
	// 输出json格式的字符串回包
	fmt.Printf("%s", response.ToJsonString())

	c.id = *response.Response.Credentials.TmpSecretId
	c.key = *response.Response.Credentials.TmpSecretKey
	c.token = *response.Response.Credentials.Token
	c.expiredTime = *response.Response.ExpiredTime
	return nil
}
