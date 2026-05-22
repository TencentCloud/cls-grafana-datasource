package cls

import (
	"context"
	"fmt"
	"regexp"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	pluginCommon "github.com/tencentcloud/tencent-cls-grafana-datasource/pkg/common"
	clsAPI "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/cls/v20201016"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
)

var topicIdRegex = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func isTopicId(s string) bool {
	return topicIdRegex.MatchString(s)
}

type topicCacheEntry struct {
	topicId   string
	expiresAt time.Time
}

// topicCache stores resolved topic name → ID mappings.
// Key: "region:topicName:secretId"
var topicCache sync.Map

const topicCacheTTL = 5 * time.Minute

// resolveTopicId returns the TopicId for the given topicNameOrId.
// If it's already a UUID, returns it as-is.
// Otherwise queries the CLS DescribeTopics API (with exact match, falling back to fuzzy)
// and caches the result for topicCacheTTL.
func resolveTopicId(ctx context.Context, region, topicNameOrId string, opts pluginCommon.ApiOpts) (string, error) {
	if isTopicId(topicNameOrId) {
		return topicNameOrId, nil
	}

	cacheKey := region + ":" + topicNameOrId + ":" + opts.SecretId
	if entry, ok := topicCache.Load(cacheKey); ok {
		e := entry.(topicCacheEntry)
		if time.Now().Before(e.expiresAt) {
			return e.topicId, nil
		}
		topicCache.Delete(cacheKey)
	}

	credential := common.NewTokenCredential(opts.SecretId, opts.SecretKey, opts.Token)
	client, err := clsAPI.NewClient(credential, region, cpf)
	if err != nil {
		return "", fmt.Errorf("resolve topic %q: create client: %w", topicNameOrId, err)
	}
	if opts.Intranet {
		client, _ = clsAPI.NewClient(credential, region, intranetCpf)
	}

	topicId, err := describeTopicByName(client, topicNameOrId, true)
	if err != nil || topicId == "" {
		// fallback to fuzzy match
		topicId, err = describeTopicByName(client, topicNameOrId, false)
	}
	if err != nil {
		return "", fmt.Errorf("resolve topic %q: %w", topicNameOrId, err)
	}
	if topicId == "" {
		return "", fmt.Errorf("topic not found: %q", topicNameOrId)
	}

	log.DefaultLogger.Info("TOPIC_RESOLVED", "name", topicNameOrId, "id", topicId, "region", region)
	topicCache.Store(cacheKey, topicCacheEntry{topicId: topicId, expiresAt: time.Now().Add(topicCacheTTL)})
	return topicId, nil
}

func describeTopicByName(client *clsAPI.Client, name string, exact bool) (string, error) {
	req := clsAPI.NewDescribeTopicsRequest()
	req.Filters = []*clsAPI.Filter{{
		Key:    common.StringPtr("topicName"),
		Values: []*string{common.StringPtr(name)},
	}}
	if exact {
		req.PreciseSearch = common.Uint64Ptr(1)
	}
	limit := int64(10)
	req.Limit = &limit

	resp, err := client.DescribeTopics(req)
	if err != nil {
		return "", err
	}
	if resp.Response == nil || len(resp.Response.Topics) == 0 {
		return "", nil
	}
	// prefer exact name match
	for _, t := range resp.Response.Topics {
		if t.TopicName != nil && *t.TopicName == name && t.TopicId != nil {
			return *t.TopicId, nil
		}
	}
	if resp.Response.Topics[0].TopicId != nil {
		return *resp.Response.Topics[0].TopicId, nil
	}
	return "", nil
}
