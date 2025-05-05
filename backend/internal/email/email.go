package email

import (
	"bytes"
	"embed"
	"errors"
	"fmt"
	"html/template"
	"log/slog"
	"os" // Needed for RESEND_API_KEY

	"github.com/henrythedeveloper/it-ticket-system/internal/config"
	"github.com/resend/resend-go/v2" // Import the Resend SDK
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
	SendTicketAssignment(recipientEmail, ticketID, subject string) error
	SendRegistrationConfirmation(recipientEmail, userName string) error
	SendPasswordReset(recipientEmail, userName, resetLink string) error
}

// --- Resend Implementation ---

// ResendService implements the email Service using the Resend API.
type ResendService struct {
	client    *resend.Client
	from      string // Sender email address (verified with Resend)
	portalURL string // Base URL of the frontend portal (for links in emails)
	logger    *slog.Logger
}

// NewService creates a new ResendService instance.
// It now expects the Resend API key to be set as an environment variable.
func NewService(cfg config.EmailConfig, portalURL string) (Service, error) {
	logger := slog.With("service", "EmailService", "provider", "resend")

	// Get Resend API Key from environment variable
	apiKey := os.Getenv("RESEND_API_KEY") // Ensure this is set in Render
	if apiKey == "" {
		return nil, errors.New("RESEND_API_KEY environment variable is not set")
	}

	if cfg.From == "" {
		return nil, errors.New("sender email address (EMAIL_FROM) is required")
	}

	client := resend.NewClient(apiKey)

	logger.Info("Initializing Resend email service", "fromAddress", cfg.From)
	return &ResendService{
		client:    client,
		from:      cfg.From,
		portalURL: portalURL,
		logger:    logger,
	}, nil
}

// renderTemplate executes the named HTML template with the provided data.
// (This function remains the same)
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

// sendEmail constructs and sends an email using the Resend API.
func (s *ResendService) sendEmail(templateName, recipient, subject string, data map[string]interface{}) error {
	if s.portalURL != "" {
		data["PortalURL"] = s.portalURL
	} else {
		data["PortalURL"] = "" // Ensure PortalURL key exists even if empty
	}

	htmlContent, err := renderTemplate(s.logger, templateName, data)
	if err != nil {
		return err // Error already logged by renderTemplate
	}

	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{recipient},
		Subject: subject,
		Html:    htmlContent,
	}

	sent, err := s.client.Emails.Send(params)
	if err != nil {
		s.logger.Error("Failed to send email via Resend API", "recipient", recipient, "subject", subject, "error", err)
		return fmt.Errorf("failed to send email via Resend API: %w", err)
	}

	s.logger.Info("Email sent successfully via Resend API", "recipient", recipient, "subject", subject, "template", templateName, "resend_id", sent.Id)
	return nil
}

// --- Interface Implementations (Remain the same logic, just call the new sendEmail) ---

func (s *ResendService) SendTicketConfirmation(recipient, submitterName, ticketID, subject string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket Received [#%s]", ticketID)
	data := map[string]interface{}{
		"Title":         "Ticket Received",
		"NotificationType": "new",
		"Status":        "new",
		"StatusLabel":   "New",
		"TicketID":      ticketID,
		"Subject":       subject,
		"RecipientName": submitterName, // Name of the person who submitted
	}
	return s.sendEmail("ticket_notification.html", recipient, emailSubject, data)
}

func (s *ResendService) SendTicketClosure(recipient, ticketID, subject, resolution string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket Closed [#%s]", ticketID)
	data := map[string]interface{}{
		"Title":         "Ticket Closed",
		"NotificationType": "closed",
		"Status":        "closed",
		"StatusLabel":   "Closed",
		"TicketID":      ticketID,
		"Subject":       subject,
		"Resolution":    resolution,
	}
	return s.sendEmail("ticket_notification.html", recipient, emailSubject, data)
}

func (s *ResendService) SendTicketInProgress(recipient, ticketID, subject, assignedStaffName string) error {
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket In Progress [#%s]", ticketID)
	data := map[string]interface{}{
		"Title":             "Ticket Update",
		"NotificationType": "inprogress",
		"Status":        "inprogress",
		"StatusLabel":       "In Progress",
		"TicketID":          ticketID,
		"Subject":           subject,
		"AssignedStaffName": assignedStaffName,
	}
	return s.sendEmail("ticket_notification.html", recipient, emailSubject, data)
}

func (s *ResendService) SendTicketAssignment(recipientEmail, ticketID, subject string) error {
	emailSubject := fmt.Sprintf("New Ticket Assignment [#%s]", ticketID)
	data := map[string]interface{}{
		"Title":            "New Ticket Assignment",
		"NotificationType": "assignment",
		"Status":        "assigned", // Use a relevant status for styling if needed
		"StatusLabel":      "Assigned",
		"TicketID":         ticketID,
		"Subject":          subject,
		"CustomMessage":    fmt.Sprintf("You have been assigned ticket #%s regarding \"%s\". Please review the ticket details in the portal.", ticketID, subject),
	}
	return s.sendEmail("ticket_notification.html", recipientEmail, emailSubject, data)
}

func (s *ResendService) SendRegistrationConfirmation(recipientEmail, userName string) error {
	emailSubject := "Welcome to the IT Helpdesk System!"
	data := map[string]interface{}{"UserName": userName}
	return s.sendEmail("registration_confirmation.html", recipientEmail, emailSubject, data)
}

func (s *ResendService) SendPasswordReset(recipientEmail, userName, resetLink string) error {
	emailSubject := "Password Reset Request - IT Helpdesk System"
	data := map[string]interface{}{"UserName": userName, "ResetLink": resetLink}
	return s.sendEmail("password_reset.html", recipientEmail, emailSubject, data)
}
