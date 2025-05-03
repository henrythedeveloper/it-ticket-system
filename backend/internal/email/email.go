// backend/internal/email/email.go
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
var templateFS embed.FS
var templates *template.Template

func init() {
	var err error
	templates, err = template.ParseFS(templateFS, "templates/*.html")
	if err != nil {
		slog.Error("CRITICAL: Failed to parse embedded email templates", "error", err)
		panic(fmt.Sprintf("failed to parse email templates: %v", err))
	}
	slog.Info("Email templates parsed successfully")
}

// Service interface - simplified for unified email template
type Service interface {
	SendTicketConfirmation(recipient, submitterName, ticketID, subject string) error
	SendTicketClosure(recipient, ticketID, subject, resolution string) error
	SendTicketInProgress(recipient, ticketID, subject, assignedStaffName string) error
}

// SMTPSandboxService is now the primary implementation
type SMTPSandboxService struct {
	host      string
	port      int
	username  string
	password  string
	from      string
	portalURL string
	logger    *slog.Logger
}

// NewService now directly returns the SMTP service
func NewService(cfg config.EmailConfig, portalURL string) (Service, error) {
	logger := slog.With("service", "EmailService", "provider", "smtp") // Hardcode provider type

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

// renderTemplate helper remains the same
func renderTemplate(logger *slog.Logger, templateName string, data interface{}) (string, error) {
	var body bytes.Buffer
	err := templates.ExecuteTemplate(&body, templateName, data)
	if err != nil {
		logger.Error("Failed to execute email template", "template", templateName, "error", err)
		return "", fmt.Errorf("template execution failed for %s: %w", templateName, err)
	}
	return body.String(), nil
}

// sendEmail method for SMTPSandboxService remains the same
func (s *SMTPSandboxService) sendEmail(templateName, recipient, subject string, data map[string]string) error {
	if s.portalURL != "" {
		data["PortalURL"] = s.portalURL
	} else {
		data["PortalURL"] = ""
	}
	htmlContent, err := renderTemplate(s.logger, templateName, data)
	if err != nil {
		return err
	}
	msg := []byte("To: " + recipient + "\r\n" +
		"From: " + s.from + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"Content-Type: text/html; charset=UTF-8\r\n" +
		"\r\n" +
		htmlContent + "\r\n")
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

// Implement Service interface methods for SMTPSandboxService
func (s *SMTPSandboxService) SendTicketConfirmation(recipient, submitterName, ticketID, subject string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket Received [#%s]", ticketID)
	data := map[string]string{
		"Title":            "Ticket Received",
		"NotificationType": "new",
		"Status":           "new",
		"StatusLabel":      "New",
		"TicketID":         ticketID,
		"Subject":          subject,
		"RecipientName":    submitterName,
	}
	return s.sendEmail("ticket_notification.html", recipient, emailSubject, data)
}

func (s *SMTPSandboxService) SendTicketClosure(recipient, ticketID, subject, resolution string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket Closed [#%s]", ticketID)
	data := map[string]string{
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

func (s *SMTPSandboxService) SendTicketInProgress(recipient, ticketID, subject, assignedStaffName string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket In Progress [#%s]", ticketID)
	data := map[string]string{
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
