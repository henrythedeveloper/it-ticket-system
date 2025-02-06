package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
)

const (
	secretLength = 32 // 256 bits
)

func generateSecret() (string, error) {
	bytes := make([]byte, secretLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

func main() {
	jwtSecret, err := generateSecret()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating JWT secret: %v\n", err)
		os.Exit(1)
	}

	refreshSecret, err := generateSecret()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating refresh secret: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Generated secrets for your .env file:")
	fmt.Println("\nJWT_SECRET=" + jwtSecret)
	fmt.Println("JWT_REFRESH_SECRET=" + refreshSecret)
	fmt.Println("\nMake sure to update these in your .env file!")
}
