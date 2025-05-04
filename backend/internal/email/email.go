// backend/internal/email/email.go
// ==========================================================================
// Handles sending emails using SMTP (e.g., MailDev for local, or a real provider).
// Parses HTML templates for different email types.
// **REVISED**: Added SendRegistrationConfirmation and SendPasswordReset methods.
//              Updated init() to ensure new templates are parsed.
// ==========================================================================

package email

import (
	"bytes"
	"embed"
	"errors"
	"fmt"
	"html/template"
	"log/slog"
	"net/smtp" // Standard SMTP library

	"github.com/henrythedeveloper/it-ticket-system/internal/config"
)

//go:embed templates/*.html
var templateFS embed.FS // Embed the templates directory
var templates *template.Template

// init parses all HTML templates from the embedded filesystem.
// It panics on failure as templates are critical for email functionality.
func init() {
	var err error
	// Ensure all templates are parsed, including the new ones
	templates, err = template.ParseFS(templateFS, "templates/*.html")
	if err != nil {
		slog.Error("CRITICAL: Failed to parse embedded email templates", "error", err)
		// Panic because if templates don't load, the service cannot function correctly.
		panic(fmt.Sprintf("failed to parse email templates: %v", err))
	}
	slog.Info("Email templates parsed successfully")
}

// --- Service Interface ---

// Service defines the contract for sending different types of emails.
type Service interface {
	// Sends a confirmation email after successful ticket submission.
	SendTicketConfirmation(recipient, submitterName, ticketID, subject string) error
	// Sends an email notification when a ticket is closed.
	SendTicketClosure(recipient, ticketID, subject, resolution string) error
	// Sends an email notification when a ticket is marked as in progress.
	SendTicketInProgress(recipient, ticketID, subject, assignedStaffName string) error
	// Sends a welcome/confirmation email upon user registration.
	SendRegistrationConfirmation(recipientEmail, userName string) error
	// Sends an email with a link/token to reset the user's password.
	SendPasswordReset(recipientEmail, userName, resetLink string) error // Changed resetToken to resetLink
}

// --- SMTP Implementation ---

// SMTPSandboxService implements the email Service using standard SMTP.
// Suitable for local development with MailDev or configured for a real SMTP server.
type SMTPSandboxService struct {
	host      string
	port      int
	username  string // Optional username for SMTP authentication
	password  string // Optional password for SMTP authentication
	from      string // Sender email address
	portalURL string // Base URL of the frontend portal (for links in emails)
	logger    *slog.Logger
}

// NewService creates a new SMTPSandboxService instance.
func NewService(cfg config.EmailConfig, portalURL string) (Service, error) {
	logger := slog.With("service", "EmailService", "provider", "smtp")

	// Validate required SMTP settings
	if cfg.From == "" {
		err := errors.New("sender email address (EMAIL_FROM) is required")
		logger.Error("Initialization failed", "error", err)
		return nil, err
	}
	if cfg.SMTPHost == "" {
		err := errors.New("SMTP host (SMTP_HOST) is required")
		logger.Error("Initialization failed", "error", err)
		return nil, err
	}
	if cfg.SMTPPort <= 0 {
		err := errors.New("SMTP port (SMTP_PORT) must be positive")
		logger.Error("Initialization failed", "error", err)
		return nil, err
	}

	logger.Info("Initializing SMTP email service", "host", cfg.SMTPHost, "port", cfg.SMTPPort, "fromAddress", cfg.From)
	return &SMTPSandboxService{
		host:      cfg.SMTPHost,
		port:      cfg.SMTPPort,
		username:  cfg.SMTPUser,
		password:  cfg.SMTPPassword,
		from:      cfg.From,
		portalURL: portalURL,
		logger:    logger,
	}, nil
}

// renderTemplate executes the named HTML template with the provided data.
func renderTemplate(logger *slog.Logger, templateName string, data interface{}) (string, error) {
	var body bytes.Buffer
	// Ensure the template exists before executing
	tmpl := templates.Lookup(templateName)
	if tmpl == nil {
		logger.Error("Email template not found", "template", templateName)
		return "", fmt.Errorf("template '%s' not found", templateName)
	}

	err := tmpl.Execute(&body, data)
	if err != nil {
		logger.Error("Failed to execute email template", "template", templateName, "error", err)
		return "", fmt.Errorf("template execution failed for %s: %w", templateName, err)
	}
	return body.String(), nil
}

// sendEmail constructs and sends an email using the configured SMTP server.
func (s *SMTPSandboxService) sendEmail(templateName, recipient, subject string, data map[string]interface{}) error {
	// Add portal URL to data if available
	if s.portalURL != "" {
		data["PortalURL"] = s.portalURL
	} else {
		data["PortalURL"] = "" // Ensure it exists even if empty
	}

	htmlContent, err := renderTemplate(s.logger, templateName, data)
	if err != nil {
		return err // Error already logged in renderTemplate
	}

	// Construct the email message headers and body
	msg := []byte("To: " + recipient + "\r\n" +
		"From: " + s.from + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\r\n" + // Set Content-Type
		"\r\n" +
		htmlContent + "\r\n")

	// SMTP server address
	addr := fmt.Sprintf("%s:%d", s.host, s.port)

	// Setup authentication if username and password are provided
	var auth smtp.Auth
	if s.username != "" && s.password != "" {
		auth = smtp.PlainAuth("", s.username, s.password, s.host)
		s.logger.Debug("Using SMTP authentication", "user", s.username)
	} else {
		s.logger.Debug("No SMTP authentication configured")
	}

	// Send the email
	err = smtp.SendMail(addr, auth, s.from, []string{recipient}, msg)
	if err != nil {
		s.logger.Error("Failed to send email via SMTP", "recipient", recipient, "subject", subject, "smtp_addr", addr, "error", err)
		// Return a generic error to avoid exposing too much detail
		return errors.New("failed to send email via SMTP provider")
	}

	s.logger.Info("Email sent successfully via SMTP", "recipient", recipient, "subject", subject, "template", templateName)
	return nil
}

// --- Interface Implementations ---

// SendTicketConfirmation sends the standard ticket confirmation email.
func (s *SMTPSandboxService) SendTicketConfirmation(recipient, submitterName, ticketID, subject string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket Received [#%s]", ticketID)
	data := map[string]interface{}{ // Use interface{} for map value type
		"Title":            "Ticket Received",
		"NotificationType": "new",
		"Status":           "new",
		"StatusLabel":      "New",
		"TicketID":         ticketID,
		"Subject":          subject,
		"RecipientName":    submitterName, // Use RecipientName for consistency with template
	}
	return s.sendEmail("ticket_notification.html", recipient, emailSubject, data)
}

// SendTicketClosure sends the standard ticket closure email.
func (s *SMTPSandboxService) SendTicketClosure(recipient, ticketID, subject, resolution string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket Closed [#%s]", ticketID)
	data := map[string]interface{}{
		"Title":            "Ticket Closed",
		"NotificationType": "closed",
		"Status":           "closed",
		"StatusLabel":      "Closed",
		"TicketID":         ticketID,
		"Subject":          subject,
		"Resolution":       resolution,
	}
	return s.sendEmail("ticket_notification.html", recipient, emailSubject, data)
}

// SendTicketInProgress sends the standard ticket in-progress email.
func (s *SMTPSandboxService) SendTicketInProgress(recipient, ticketID, subject, assignedStaffName string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket In Progress [#%s]", ticketID)
	data := map[string]interface{}{
		"Title":             "Ticket Update",
		"NotificationType":  "inprogress",
		"Status":            "inprogress",
		"StatusLabel":       "In Progress",
		"TicketID":          ticketID,
		"Subject":           subject,
		"AssignedStaffName": assignedStaffName,
	}
	return s.sendEmail("ticket_notification.html", recipient, emailSubject, data)
}

// SendRegistrationConfirmation sends a welcome email upon successful user registration.
func (s *SMTPSandboxService) SendRegistrationConfirmation(recipientEmail, userName string) error {
	emailSubject := "Welcome to the IT Helpdesk System!"
	data := map[string]interface{}{
		"UserName": userName,
		// Add any other relevant data for the template
	}
	return s.sendEmail("registration_confirmation.html", recipientEmail, emailSubject, data)
}

// SendPasswordReset sends an email containing a password reset link.
func (s *SMTPSandboxService) SendPasswordReset(recipientEmail, userName, resetLink string) error {
	emailSubject := "Password Reset Request - IT Helpdesk System"
	data := map[string]interface{}{
		"UserName":  userName,
		"ResetLink": resetLink, // Pass the full link generated by the handler
		// Add token expiry information if desired (e.g., "This link expires in 1 hour.")
	}
	return s.sendEmail("password_reset.html", recipientEmail, emailSubject, data)
}

