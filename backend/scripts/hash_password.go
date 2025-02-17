package scripts

import (
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"
)

func HashPassword() {
	if len(os.Args) != 2 {
		fmt.Println("Usage: go run scripts/hash_password.go <password>")
		os.Exit(1)
	}

	password := os.Args[1]
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Printf("Error hashing password: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Hashed password: %s\n", string(hashedPassword))
}
