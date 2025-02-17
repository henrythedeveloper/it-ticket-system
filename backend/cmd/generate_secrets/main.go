package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
)

const (
	jwtSecretLength    = 32
	secretKeyLength    = 32
	defaultOutputFile = ".env"
)

func generateRandomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	_, err := rand.Read(b)
	return b, err
}

func main() {
	// Generate JWT secret
	jwtSecret, err := generateRandomBytes(jwtSecretLength)
	if err != nil {
		fmt.Printf("Error generating JWT secret: %v\n", err)
		os.Exit(1)
	}

	// Generate secret key
	secretKey, err := generateRandomBytes(secretKeyLength)
	if err != nil {
		fmt.Printf("Error generating secret key: %v\n", err)
		os.Exit(1)
	}

	// Convert to base64
	jwtSecretBase64 := base64.StdEncoding.EncodeToString(jwtSecret)
	secretKeyBase64 := base64.StdEncoding.EncodeToString(secretKey)

	// Write to .env file
	envContent := fmt.Sprintf(`JWT_SECRET=%s
SECRET_KEY=%s
`, jwtSecretBase64, secretKeyBase64)

	err = os.WriteFile(defaultOutputFile, []byte(envContent), 0600)
	if err != nil {
		fmt.Printf("Error writing to %s: %v\n", defaultOutputFile, err)
		os.Exit(1)
	}

	fmt.Printf("Successfully generated secrets and wrote to %s\n", defaultOutputFile)
}