package user

// SQL queries as constants
const (
	// Basic user queries
	QueryGetAllUsers = `
		SELECT id, name, email, role, created_at, updated_at
		FROM users
		ORDER BY name
	`
	
	QueryGetUserByID = `
		SELECT id, name, email, role, created_at, updated_at
		FROM users
		WHERE id = $1
	`
	
	QueryGetUserWithPasswordByID = `
		SELECT id, name, email, password_hash, role, created_at, updated_at
		FROM users
		WHERE id = $1
	`
	
	QueryGetUserByEmail = `
		SELECT id, name, email, password_hash, role, created_at, updated_at
		FROM users
		WHERE email = $1
	`
	
	// Check queries
	QueryEmailExists = `
		SELECT EXISTS(
			SELECT 1
			FROM users
			WHERE email = $1
		)
	`
	
	QueryEmailExistsExcept = `
		SELECT EXISTS(
			SELECT 1
			FROM users
			WHERE email = $1 AND id != $2
		)
	`
	
	// Modification queries
	QueryCreateUser = `
		INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, email, role, created_at, updated_at
	`
	
	QueryDeleteUser = `
		DELETE FROM users
		WHERE id = $1
	`
)