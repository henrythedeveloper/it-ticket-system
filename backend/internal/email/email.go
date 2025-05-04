// backend/internal/email/email.go
// REVISED: Added SendTicketAssignment method for notifying assignees.
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
func init() {
	var err error
	templates, err = template.ParseFS(templateFS, "templates/*.html")
	if err != nil {
		slog.Error("CRITICAL: Failed to parse embedded email templates", "error", err)
		panic(fmt.Sprintf("failed to parse email templates: %v", err))
	}
	slog.Info("Email templates parsed successfully")
}

// --- Service Interface ---

// Service defines the contract for sending different types of emails.
type Service interface {
	SendTicketConfirmation(recipient, submitterName, ticketID, subject string) error
	SendTicketClosure(recipient, ticketID, subject, resolution string) error
	SendTicketInProgress(recipient, ticketID, subject, assignedStaffName string) error
	// Added SendTicketAssignment
	SendTicketAssignment(recipientEmail, ticketID, subject string) error
	SendRegistrationConfirmation(recipientEmail, userName string) error
	SendPasswordReset(recipientEmail, userName, resetLink string) error
}

// --- SMTP Implementation ---

// SMTPSandboxService implements the email Service using standard SMTP.
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
	if cfg.From == "" { return nil, errors.New("sender email address (EMAIL_FROM) is required") }
	if cfg.SMTPHost == "" { return nil, errors.New("SMTP host (SMTP_HOST) is required") }
	if cfg.SMTPPort <= 0 { return nil, errors.New("SMTP port (SMTP_PORT) must be positive") }

	logger.Info("Initializing SMTP email service", "host", cfg.SMTPHost, "port", cfg.SMTPPort, "fromAddress", cfg.From)
	return &SMTPSandboxService{
		host:      cfg.SMTPHost, port:      cfg.SMTPPort, username:  cfg.SMTPUser,
		password:  cfg.SMTPPassword, from:      cfg.From, portalURL: portalURL, logger:    logger,
	}, nil
}

// renderTemplate executes the named HTML template with the provided data.
func renderTemplate(logger *slog.Logger, templateName string, data interface{}) (string, error) {
	var body bytes.Buffer
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
	if s.portalURL != "" { data["PortalURL"] = s.portalURL } else { data["PortalURL"] = "" }

	htmlContent, err := renderTemplate(s.logger, templateName, data)
	if err != nil { return err }

	msg := []byte("To: " + recipient + "\r\n" + "From: " + s.from + "\r\n" + "Subject: " + subject + "\r\n" +
		"MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\r\n" + "\r\n" + htmlContent + "\r\n")
	addr := fmt.Sprintf("%s:%d", s.host, s.port)
	var auth smtp.Auth
	if s.username != "" && s.password != "" {
		auth = smtp.PlainAuth("", s.username, s.password, s.host)
		s.logger.Debug("Using SMTP authentication", "user", s.username)
	} else {
		s.logger.Debug("No SMTP authentication configured")
	}

	err = smtp.SendMail(addr, auth, s.from, []string{recipient}, msg)
	if err != nil {
		s.logger.Error("Failed to send email via SMTP", "recipient", recipient, "subject", subject, "smtp_addr", addr, "error", err)
		return errors.New("failed to send email via SMTP provider")
	}
	s.logger.Info("Email sent successfully via SMTP", "recipient", recipient, "subject", subject, "template", templateName)
	return nil
}

// --- Interface Implementations ---

func (s *SMTPSandboxService) SendTicketConfirmation(recipient, submitterName, ticketID, subject string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket Received [#%s]", ticketID)
	data := map[string]interface{}{
		"Title":            "Ticket Received", "NotificationType": "new", "Status": "new",
		"StatusLabel":      "New", "TicketID": ticketID, "Subject": subject,
		"RecipientName":    submitterName,
	}
	return s.sendEmail("ticket_notification.html", recipient, emailSubject, data)
}

func (s *SMTPSandboxService) SendTicketClosure(recipient, ticketID, subject, resolution string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket Closed [#%s]", ticketID)
	data := map[string]interface{}{
		"Title":            "Ticket Closed", "NotificationType": "closed", "Status": "closed",
		"StatusLabel":      "Closed", "TicketID": ticketID, "Subject": subject,
		"Resolution":       resolution,
	}
	return s.sendEmail("ticket_notification.html", recipient, emailSubject, data)
}

func (s *SMTPSandboxService) SendTicketInProgress(recipient, ticketID, subject, assignedStaffName string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket In Progress [#%s]", ticketID)
	data := map[string]interface{}{
		"Title":             "Ticket Update", "NotificationType": "inprogress", "Status": "inprogress",
		"StatusLabel":       "In Progress", "TicketID": ticketID, "Subject": subject,
		"AssignedStaffName": assignedStaffName,
	}
	return s.sendEmail("ticket_notification.html", recipient, emailSubject, data)
}

// SendTicketAssignment sends an email notification to the newly assigned staff member.
func (s *SMTPSandboxService) SendTicketAssignment(recipientEmail, ticketID, subject string) error {
	emailSubject := fmt.Sprintf("New Ticket Assignment [#%s]", ticketID)
	data := map[string]interface{}{
		"Title":            "New Ticket Assignment", "NotificationType": "assignment", "Status": "assigned", // Use a relevant status for styling if needed
		"StatusLabel":      "Assigned", "TicketID": ticketID, "Subject": subject,
		// Add specific message for assignee
		"CustomMessage": fmt.Sprintf("You have been assigned ticket #%s regarding \"%s\". Please review the ticket details in the portal.", ticketID, subject),
	}
	return s.sendEmail("ticket_notification.html", recipientEmail, emailSubject, data)
}

func (s *SMTPSandboxService) SendRegistrationConfirmation(recipientEmail, userName string) error {
	emailSubject := "Welcome to the IT Helpdesk System!"
	data := map[string]interface{}{ "UserName": userName }
	return s.sendEmail("registration_confirmation.html", recipientEmail, emailSubject, data)
}

func (s *SMTPSandboxService) SendPasswordReset(recipientEmail, userName, resetLink string) error {
	emailSubject := "Password Reset Request - IT Helpdesk System"
	data := map[string]interface{}{ "UserName":  userName, "ResetLink": resetLink }
	return s.sendEmail("password_reset.html", recipientEmail, emailSubject, data)
}
