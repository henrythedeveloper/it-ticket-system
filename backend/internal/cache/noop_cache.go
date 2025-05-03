// backend/internal/cache/noop_cache.go
package cache

import (
	"context"
	"time"
)

// NoOpCache is a cache implementation that does nothing
// Used as a fallback when caching is disabled or unavailable
type NoOpCache struct{}

// NewNoOpCache creates a new no-op cache
func NewNoOpCache() Cache {
	return &NoOpCache{}
}

// Get always returns false (cache miss)
func (c *NoOpCache) Get(ctx context.Context, key string, dest interface{}) (bool, error) {
	return false, nil
}

// Set does nothing and returns nil
func (c *NoOpCache) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return nil
}

// Delete does nothing and returns nil
func (c *NoOpCache) Delete(ctx context.Context, key string) error {
	return nil
}

// DeletePattern does nothing and returns nil
func (c *NoOpCache) DeletePattern(ctx context.Context, pattern string) error {
	return nil
}
