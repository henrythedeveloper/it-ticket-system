package email

import (
	"bytes"
	"embed" // Import embed package
	"errors"
	"html/template" // Import html/template package
	"log/slog"      // Import slog for structured logging

	"github.com/henrythedeveloper/bus-it-ticket/internal/config"
	"github.com/resend/resend-go/v2"
)

// Embed template files
var templateFS embed.FS

var (
	templates *template.Template
	// Define a placeholder URL
	// Example: portalURL = cfg.Server.BaseURL + "/tasks"
	portalURL = "#" // Replace with actual URL or load from config
)

func init() {
	// Parse all templates once at startup
	var err error
	templates, err = template.ParseFS(templateFS, "templates/*.html")
	if err != nil {
		// Use log.Fatal or panic during init if templates can't load
		slog.Error("Failed to parse email templates", "error", err)
		panic("Failed to parse email templates: " + err.Error())
	}
	slog.Info("Email templates parsed successfully")
}

// Service defines the email service interface
type Service interface {
	SendTicketConfirmation(recipient, ticketID, subject string) error
	SendTicketClosure(recipient, ticketID, subject, resolution string) error
	SendTaskAssignment(recipient, taskTitle, dueDate string) error
}

// ResendService is an implementation of the email Service using Resend
type ResendService struct {
	client *resend.Client
	from   string
	// Add portalURL here if loaded from config
	// portalURL string
}

// NewService creates a new email service
func NewService(cfg config.EmailConfig) (Service, error) {
	switch cfg.Provider {
	case "resend":
		if cfg.APIKey == "" {
			return nil, errors.New("Resend API key is required")
		}
		if cfg.From == "" {
			return nil, errors.New("sender email address is required")
		}
		// You could potentially load the portalURL from cfg here if added
		return &ResendService{
			client: resend.NewClient(cfg.APIKey),
			from:   cfg.From,
			// portalURL: cfg.PortalURL, // Example if loaded from config
		}, nil
	default:
		// Use slog for errors where applicable
		err := errors.New("unsupported email provider")
		slog.Error("Email service initialization failed", "provider", cfg.Provider, "error", err)
		return nil, err
	}
}

// renderTemplate executes the named template with the given data
func renderTemplate(templateName string, data interface{}) (string, error) {
	var body bytes.Buffer
	if err := templates.ExecuteTemplate(&body, templateName, data); err != nil {
		slog.Error("Failed to execute email template", "template", templateName, "error", err)
		return "", err // Return error
	}
	return body.String(), nil
}

// SendTicketConfirmation sends a confirmation email when a ticket is created
func (s *ResendService) SendTicketConfirmation(recipient, ticketID, subject string) error {
	templateName := "ticket_confirmation.html"
	data := map[string]string{
		"TicketID": ticketID,
		"Subject":  subject,
	}

	htmlContent, err := renderTemplate(templateName, data)
	if err != nil {
		return err // Error already logged by renderTemplate
	}

	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{recipient},
		Subject: "IT Helpdesk - Ticket Received",
		Html:    htmlContent,
		ReplyTo: s.from,
	}

	_, err = s.client.Emails.Send(params)
	if err != nil {
		slog.Error("Failed to send ticket confirmation email via Resend", "recipient", recipient, "ticketID", ticketID, "error", err)
		return errors.New("failed to send email") // Return generic error to caller
	}
	slog.Info("Sent ticket confirmation email", "recipient", recipient, "ticketID", ticketID)
	return nil
}

// SendTicketClosure sends an email when a ticket is closed
func (s *ResendService) SendTicketClosure(recipient, ticketID, subject, resolution string) error {
	templateName := "ticket_closure.html"
	data := map[string]string{
		"TicketID":   ticketID,
		"Subject":    subject,
		"Resolution": resolution,
	}

	htmlContent, err := renderTemplate(templateName, data)
	if err != nil {
		return err
	}

	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{recipient},
		Subject: "IT Helpdesk - Ticket Closed",
		Html:    htmlContent,
		ReplyTo: s.from,
	}

	_, err = s.client.Emails.Send(params)
	if err != nil {
		slog.Error("Failed to send ticket closure email via Resend", "recipient", recipient, "ticketID", ticketID, "error", err)
		return errors.New("failed to send email")
	}
	slog.Info("Sent ticket closure email", "recipient", recipient, "ticketID", ticketID)
	return nil
}

// SendTaskAssignment sends an email when a task is assigned
func (s *ResendService) SendTaskAssignment(recipient, taskTitle, dueDate string) error {
	templateName := "task_assignment.html"
	data := map[string]string{
		"TaskTitle": taskTitle,
		"DueDate":   dueDate,
		"PortalURL": portalURL, // Use the defined portal URL
	}

	htmlContent, err := renderTemplate(templateName, data)
	if err != nil {
		return err
	}

	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{recipient},
		Subject: "IT Helpdesk - Task Assigned",
		Html:    htmlContent,
		// No ReplyTo needed usually for task assignments
	}

	_, err = s.client.Emails.Send(params)
	if err != nil {
		slog.Error("Failed to send task assignment email via Resend", "recipient", recipient, "taskTitle", taskTitle, "error", err)
		return errors.New("failed to send email")
	}
	slog.Info("Sent task assignment email", "recipient", recipient, "taskTitle", taskTitle)
	return nil
}