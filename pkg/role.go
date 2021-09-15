package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"sync"
	"time"
)

type TmpCredential struct {
	TmpSecretId  string `json:"TmpSecretId"`
	TmpSecretKey string `json:"TmpSecretKey"`
	ExpiredTime  int64  `json:"ExpiredTime"`
	Expiration   string `json:"Expiration"`
	Token        string `json:"Token"`
	Code         string `json:"Code"`
}

var secretCache sync.Map

// GetUserSecretByRole get user secret from cache first if found and not expired, else got from metadata server
func GetUserSecretByRole() (string, string, string, error) {
	// 在TPS环境下，使用Role参数获取临时秘钥
	role := "TKE_QCSLinkedRoleInPrometheusService"
	secretObj, ok := secretCache.Load(role)
	if ok {
		if secret, ok := secretObj.(*TmpCredential); ok {
			expiredTime := time.Unix(0, secret.ExpiredTime)
			if expiredTime.Before(time.Now()) {
				return secret.TmpSecretId, secret.TmpSecretKey, secret.Token, nil
			}
		}
	}

	secret, err := getUserCredentialByRole(role)
	if err != nil {
		return "", "", "", err
	}
	secretCache.Store(role, secret)
	return secret.TmpSecretId, secret.TmpSecretKey, secret.Token, nil
}

// getUserCredentialByRole get user credentials from metadata by role
func getUserCredentialByRole(role string) (*TmpCredential, error) {
	resp, err := http.Get("http://metadata.tencentyun.com/meta-data/cam/security-credentials/" + role)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status code error: %s", resp.Status)
	}
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	r := TmpCredential{}
	err = json.Unmarshal(data, &r)
	if err != nil {
		return nil, err
	}

	if strings.ToLower(r.Code) != "success" {
		return nil, fmt.Errorf("status code error: %s", r.Code)
	}
	return &r, nil
}
