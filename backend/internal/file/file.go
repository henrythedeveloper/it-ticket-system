package file

import (
	"context"
	"fmt"
	"io"
	"log"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/henrythedeveloper/bus-it-ticket/internal/config"
)

type StorageConfig struct {
	Endpoint  string
	Region    string
	AccessKey string
	SecretKey string
	Bucket    string
}

// Service defines the file storage service interface
type Service interface {
	UploadFile(ctx context.Context, ticketID, filename string, fileContent io.Reader, contentType string) (string, error)
	GetObject(ctx context.Context, filePath string) (io.ReadCloser, error)
}

// S3Service is an implementation of the file Service using S3/MinIO
type S3Service struct {
	client     *s3.Client
	bucketName string
}

// NewService creates a new file storage service
func NewService(cfg config.StorageConfig) (Service, error) {
	// Create custom endpoint resolver
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:               cfg.Endpoint,
			HostnameImmutable: true,
			PartitionID:       "aws",
			SigningRegion:     cfg.Region,
		}, nil
	})

	// Create AWS config
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
		awsconfig.WithEndpointResolverWithOptions(customResolver),
		awsconfig.WithRegion(cfg.Region),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create S3 client
	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})

	return &S3Service{
		client:     s3Client,
		bucketName: cfg.Bucket,
	}, nil
}

// UploadFile uploads a file to the storage service
func (s *S3Service) UploadFile(ctx context.Context, ticketID, filename string, fileContent io.Reader, contentType string) (string, error) {
	// Generate a unique file path
	ext := filepath.Ext(filename)
	storageKey := fmt.Sprintf("tickets/%s/%d%s", ticketID, time.Now().UnixNano(), ext)

	// Upload the file
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucketName),
		Key:         aws.String(storageKey),
		Body:        fileContent,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload file: %w", err)
	}

	return storageKey, nil
}

func (s *S3Service) GetObject(ctx context.Context, filePath string) (io.ReadCloser, error) {
	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(filePath),
	})
	if err != nil {
		log.Printf("ERROR: S3 GetObject failed for key %s: %v", filePath, err)
		return nil, fmt.Errorf("S3 GetObject failed: %w", err)
	}
	// The Body field is an io.ReadCloser
	return output.Body, nil
}
