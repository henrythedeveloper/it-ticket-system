// backend/internal/cache/cache.go
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"log/slog"

	"github.com/redis/go-redis/v9"
)

// Options represents configuration options for the cache
type Options struct {
	DefaultExpiration time.Duration
	RedisURL          string
	UseMemoryCache    bool
}

// Cache defines the interface for caching operations
type Cache interface {
	// Get retrieves a value from the cache. Returns true if found, false if not found
	Get(ctx context.Context, key string, dest interface{}) (bool, error)

	// Set stores a value in the cache with the given expiration
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error

	// Delete removes a value from the cache
	Delete(ctx context.Context, key string) error

	// DeletePattern removes all values matching a pattern
	DeletePattern(ctx context.Context, pattern string) error
}

// NewCache creates a new cache based on the provided options
func NewCache(opts Options) (Cache, error) {
	if opts.UseMemoryCache {
		return NewMemoryCache(opts.DefaultExpiration), nil
	}

	// If Redis URL is provided, use Redis cache
	if opts.RedisURL != "" {
		return NewRedisCache(opts.RedisURL, opts.DefaultExpiration)
	}

	// Default to memory cache if no specific provider is configured
	return NewMemoryCache(opts.DefaultExpiration), nil
}

// KeyBuilder helps create consistent cache keys
type KeyBuilder struct {
	prefix string
}

// NewKeyBuilder creates a new KeyBuilder with the given prefix
func NewKeyBuilder(prefix string) *KeyBuilder {
	return &KeyBuilder{prefix: prefix}
}

// Build creates a cache key with the prefix and components
func (kb *KeyBuilder) Build(components ...interface{}) string {
	key := kb.prefix
	for _, c := range components {
		key = fmt.Sprintf("%s:%v", key, c)
	}
	return key
}

// RedisCache implements Cache using Redis
type RedisCache struct {
	client  *redis.Client
	options Options
	logger  *slog.Logger
}

// MemoryCache implements Cache using local memory
type MemoryCache struct {
	items   map[string]memoryItem
	mu      sync.RWMutex
	options Options
	logger  *slog.Logger
}

type memoryItem struct {
	value      []byte
	expiration int64
}

// NewRedisCache creates a new Redis cache
func NewRedisCache(redisURL string, defaultExpiration time.Duration) (*RedisCache, error) {
	client := redis.NewClient(&redis.Options{
		Addr: redisURL,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &RedisCache{
		client: client,
		options: Options{
			DefaultExpiration: defaultExpiration,
			RedisURL:          redisURL,
		},
		logger: slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{})).With("component", "redis_cache"),
	}, nil
}

// Get retrieves a value from Redis
func (c *RedisCache) Get(ctx context.Context, key string, dest interface{}) (bool, error) {
	val, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return false, nil
		}
		return false, fmt.Errorf("redis get error: %w", err)
	}

	if err := json.Unmarshal(val, dest); err != nil {
		return false, fmt.Errorf("unmarshal error: %w", err)
	}

	return true, nil
}

// Set stores a value in Redis
func (c *RedisCache) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	if expiration == 0 {
		expiration = c.options.DefaultExpiration
	}

	jsonValue, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	if err := c.client.Set(ctx, key, jsonValue, expiration).Err(); err != nil {
		return fmt.Errorf("redis set error: %w", err)
	}

	return nil
}

// Delete removes a value from Redis
func (c *RedisCache) Delete(ctx context.Context, key string) error {
	if err := c.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("redis delete error: %w", err)
	}
	return nil
}

// DeletePattern removes values matching a pattern from Redis
func (c *RedisCache) DeletePattern(ctx context.Context, pattern string) error {
	keys, err := c.client.Keys(ctx, pattern).Result()
	if err != nil {
		return fmt.Errorf("redis keys error: %w", err)
	}

	if len(keys) > 0 {
		if err := c.client.Del(ctx, keys...).Err(); err != nil {
			return fmt.Errorf("redis delete error: %w", err)
		}
	}

	return nil
}

// NewMemoryCache creates a new in-memory cache
func NewMemoryCache(defaultExpiration time.Duration) *MemoryCache {
	return &MemoryCache{
		items: make(map[string]memoryItem),
		options: Options{
			DefaultExpiration: defaultExpiration,
		},
		logger: slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{})).With("component", "memory_cache"),
	}
}

// Get retrieves a value from memory
func (c *MemoryCache) Get(ctx context.Context, key string, dest interface{}) (bool, error) {
	c.mu.RLock()
	item, found := c.items[key]
	c.mu.RUnlock()

	if !found {
		return false, nil
	}

	if item.expiration > 0 && item.expiration < time.Now().UnixNano() {
		// Item has expired
		c.mu.Lock()
		delete(c.items, key)
		c.mu.Unlock()
		return false, nil
	}

	if err := json.Unmarshal(item.value, dest); err != nil {
		return false, fmt.Errorf("unmarshal error: %w", err)
	}

	return true, nil
}

// Set stores a value in memory
func (c *MemoryCache) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	if expiration == 0 {
		expiration = c.options.DefaultExpiration
	}

	jsonValue, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	var exp int64
	if expiration > 0 {
		exp = time.Now().Add(expiration).UnixNano()
	}

	c.mu.Lock()
	c.items[key] = memoryItem{
		value:      jsonValue,
		expiration: exp,
	}
	c.mu.Unlock()

	return nil
}

// Delete removes a value from memory
func (c *MemoryCache) Delete(ctx context.Context, key string) error {
	c.mu.Lock()
	delete(c.items, key)
	c.mu.Unlock()
	return nil
}

// DeletePattern removes values matching a pattern from memory
// Note: Simple implementation that only supports * wildcard at the end
func (c *MemoryCache) DeletePattern(ctx context.Context, pattern string) error {
	if len(pattern) == 0 {
		return nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if pattern == "*" {
		// Clear all
		c.items = make(map[string]memoryItem)
		return nil
	}

	// Check if the pattern ends with *
	if pattern[len(pattern)-1] == '*' {
		prefix := pattern[:len(pattern)-1]
		for k := range c.items {
			if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
				delete(c.items, k)
			}
		}
		return nil
	}

	// Exact match
	delete(c.items, pattern)
	return nil
}
