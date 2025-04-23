// backend/internal/file/file.go
// ==========================================================================
// Provides services for interacting with file storage (S3/MinIO).
// Handles uploading, retrieving, and potentially deleting files.
// ==========================================================================

package file

import (
	"context"
	"fmt"
	"io"
	"log/slog" // Use structured logging

	"github.com/aws/aws-sdk-go-v2/aws"              // AWS SDK core
	awsconfig "github.com/aws/aws-sdk-go-v2/config" // AWS SDK config loading
	"github.com/aws/aws-sdk-go-v2/credentials"      // Static credentials provider
	"github.com/aws/aws-sdk-go-v2/service/s3"       // S3 service client

	"github.com/henrythedeveloper/it-ticket-system/internal/config" // App configuration
)

// --- Service Interface ---

// Service defines the contract for file storage operations.
type Service interface {
	// UploadFile uploads content from an io.Reader to the specified storage path.
	UploadFile(ctx context.Context, storagePath string, fileContent io.Reader, fileSize int64, contentType string) (string, error)
	// GetObject retrieves an object's content as a readable stream.
	GetObject(ctx context.Context, storagePath string) (io.ReadCloser, error)
	// DeleteFile removes an object from storage.
	DeleteFile(ctx context.Context, storagePath string) error
	// GetObjectURL generates a presigned URL for temporary access (optional, requires more setup).
	// GetObjectURL(ctx context.Context, storagePath string, expires time.Duration) (string, error)
}

// --- S3/MinIO Implementation ---

// S3Service implements the file Service interface using an S3-compatible API (like AWS S3 or MinIO).
type S3Service struct {
	client     *s3.Client   // S3 client instance
	bucketName string       // Name of the bucket to use
	logger     *slog.Logger // Instance logger
}

// --- Constructor ---

// NewService creates a new S3Service instance based on the provided storage configuration.
// It configures the AWS SDK S3 client to connect to the specified endpoint (S3 or MinIO).
//
// Parameters:
//   - cfg: The storage configuration (config.StorageConfig).
//
// Returns:
//   - Service: An implementation of the file Service interface.
//   - error: An error if configuration loading or client initialization fails.
func NewService(cfg config.StorageConfig) (Service, error) {
	logger := slog.With("service", "FileStorageService", "provider", "S3/MinIO", "endpoint", cfg.Endpoint, "bucket", cfg.Bucket)
	logger.Info("Initializing S3/MinIO file storage service...")

	// --- Configure AWS SDK ---
	// Custom resolver needed for MinIO or non-standard S3 endpoints
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		if cfg.Endpoint != "" {
			return aws.Endpoint{
				URL:               cfg.Endpoint, // Use the configured endpoint
				HostnameImmutable: true,         // Important for MinIO/non-AWS endpoints
				PartitionID:       "aws",        // Standard partition
				SigningRegion:     cfg.Region,   // Use configured region for signing
			}, nil
		}
		// Fallback to default AWS endpoint resolution if no custom endpoint is set
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	// Load AWS configuration
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		// Provide static credentials from config
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
		// Use the custom endpoint resolver
		awsconfig.WithEndpointResolverWithOptions(customResolver),
		// Set the region
		awsconfig.WithRegion(cfg.Region),
	)
	if err != nil {
		logger.Error("Failed to load AWS SDK configuration", "error", err)
		return nil, fmt.Errorf("failed to load S3 configuration: %w", err)
	}

	// --- Create S3 Client ---
	// UsePathStyle is often required for MinIO and some S3 setups
	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true // Set to true for MinIO compatibility
		if cfg.DisableSSL {
			// This part might require more specific SDK configuration depending on the SDK version
			// and how it handles disabling SSL. Forcing HTTP is generally done via the endpoint URL.
			logger.Warn("SSL verification is disabled for S3 connection.")
			// Ensure the Endpoint URL itself starts with http:// if disabling SSL.
		}
	})

	logger.Info("S3/MinIO client initialized successfully")
	return &S3Service{
		client:     s3Client,
		bucketName: cfg.Bucket,
		logger:     logger,
	}, nil
}

// --- Service Methods ---

// UploadFile uploads file content to the configured S3 bucket.
//
// Parameters:
//   - ctx: The request context.
//   - storagePath: The desired key (path) for the object in the bucket.
//   - fileContent: An io.Reader providing the file's content.
//   - fileSize: The total size of the file in bytes (required by S3 PutObject).
//   - contentType: The MIME type of the file (e.g., "image/jpeg", "application/pdf").
//
// Returns:
//   - string: The storage path (key) where the file was uploaded.
//   - error: An error if the upload fails.
func (s *S3Service) UploadFile(ctx context.Context, storagePath string, fileContent io.Reader, fileSize int64, contentType string) (string, error) {
	logger := s.logger.With("operation", "UploadFile", "bucket", s.bucketName, "key", storagePath)
	logger.Debug("Attempting to upload file", "contentType", contentType, "size", fileSize)

	// Prepare the PutObject input
	putInput := &s3.PutObjectInput{
		Bucket:        aws.String(s.bucketName),
		Key:           aws.String(storagePath),
		Body:          fileContent,
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(fileSize), // ContentLength is often useful for S3
		// TODO: Consider adding ACL (e.g., types.ObjectCannedACLPrivate) if needed
		// ACL:           types.ObjectCannedACLPrivate,
	}

	// Execute the upload operation
	_, err := s.client.PutObject(ctx, putInput)
	if err != nil {
		logger.Error("S3 PutObject failed", "error", err)
		return "", fmt.Errorf("failed to upload file to storage: %w", err)
	}

	logger.Info("File uploaded successfully")
	// Return the storage path used, confirming the key
	return storagePath, nil
}

// GetObject retrieves an object's content stream from the S3 bucket.
// The caller is responsible for closing the returned io.ReadCloser.
//
// Parameters:
//   - ctx: The request context.
//   - storagePath: The key (path) of the object to retrieve.
//
// Returns:
//   - io.ReadCloser: A readable stream for the object's content. Needs to be closed by the caller.
//   - error: An error if the object cannot be retrieved (e.g., not found, access denied).
func (s *S3Service) GetObject(ctx context.Context, storagePath string) (io.ReadCloser, error) {
	logger := s.logger.With("operation", "GetObject", "bucket", s.bucketName, "key", storagePath)
	logger.Debug("Attempting to retrieve object")

	// Prepare the GetObject input
	getInput := &s3.GetObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(storagePath),
	}

	// Execute the GetObject operation
	output, err := s.client.GetObject(ctx, getInput)
	if err != nil {
		// Log specific S3 errors if possible (e.g., NoSuchKey)
		// var nsk *types.NoSuchKey
		// if errors.As(err, &nsk) { ... }
		logger.Error("S3 GetObject failed", "error", err)
		return nil, fmt.Errorf("failed to retrieve file from storage: %w", err)
	}

	// The output.Body is the io.ReadCloser containing the file content.
	logger.Info("Object retrieved successfully")
	return output.Body, nil
}

// DeleteFile removes an object from the S3 bucket.
//
// Parameters:
//   - ctx: The request context.
//   - storagePath: The key (path) of the object to delete.
//
// Returns:
//   - error: An error if the deletion fails.
func (s *S3Service) DeleteFile(ctx context.Context, storagePath string) error {
	logger := s.logger.With("operation", "DeleteFile", "bucket", s.bucketName, "key", storagePath)
	logger.Debug("Attempting to delete object")

	// Prepare the DeleteObject input
	deleteInput := &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(storagePath),
	}

	// Execute the DeleteObject operation
	_, err := s.client.DeleteObject(ctx, deleteInput)
	if err != nil {
		logger.Error("S3 DeleteObject failed", "error", err)
		return fmt.Errorf("failed to delete file from storage: %w", err)
	}

	logger.Info("Object deleted successfully")
	return nil
}

// GetObjectURL (Optional Implementation Example)
// Generates a presigned URL for temporary access to an S3 object.
// Requires configuring the S3 client for presigning.
/*
func (s *S3Service) GetObjectURL(ctx context.Context, storagePath string, expires time.Duration) (string, error) {
    logger := s.logger.With("operation", "GetObjectURL", "bucket", s.bucketName, "key", storagePath)
    logger.Debug("Generating presigned URL", "expires", expires)

    // Create a presign client (this might need specific setup based on SDK version)
    presignClient := s3.NewPresignClient(s.client)

    presignedReq, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
        Bucket: aws.String(s.bucketName),
        Key:    aws.String(storagePath),
    }, func(opts *s3.PresignOptions) {
        opts.Expires = expires
    })
    if err != nil {
        logger.Error("Failed to generate presigned URL", "error", err)
        return "", fmt.Errorf("failed to generate object URL: %w", err)
    }

    logger.Info("Presigned URL generated successfully")
    return presignedReq.URL, nil
}
*/
