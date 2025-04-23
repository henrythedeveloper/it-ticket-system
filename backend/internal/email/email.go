// backend/internal/email/email.go
// ==========================================================================
// Provides email sending functionality using different providers (e.g., Resend).
// Handles HTML template parsing and rendering for various notification types.
// ==========================================================================

package email

import (
	"bytes"
	"embed"   // Used to embed HTML templates into the binary
	"errors"
	"fmt"
	"html/template" // Use html/template for safe HTML rendering
	"log/slog"      // Use structured logging

	"github.com/henrythedeveloper/it-ticket-system/internal/config" // App configuration
	"github.com/resend/resend-go/v2"                             // Resend client library
)

// --- Embedded Templates ---

//go:embed templates/*.html
var templateFS embed.FS // Embed the templates directory

// templates holds the parsed HTML templates, initialized once at startup.
var templates *template.Template

// init parses the embedded HTML templates when the package is loaded.
// It panics if template parsing fails, as this is a critical startup error.
func init() {
	var err error
	// Parse all files matching the pattern within the embedded filesystem
	templates, err = template.ParseFS(templateFS, "templates/*.html")
	if err != nil {
		// Use slog for fatal errors during initialization
		slog.Error("CRITICAL: Failed to parse embedded email templates", "error", err)
		// Panic is appropriate here because the application cannot function correctly
		// without its email templates.
		panic(fmt.Sprintf("failed to parse email templates: %v", err))
	}
	slog.Info("Email templates parsed successfully")
}

// --- Service Interface ---

// Service defines the contract for sending different types of notification emails.
type Service interface {
	// SendTicketConfirmation sends an email to the user when a new ticket is created.
	SendTicketConfirmation(recipient, ticketID, subject string) error
	// SendTicketClosure sends an email when a ticket's status is changed to Closed.
	SendTicketClosure(recipient, ticketID, subject, resolution string) error
	// SendTaskAssignment sends an email when a task is assigned to a user.
	SendTaskAssignment(recipient, taskTitle, dueDate string) error
	// SendTicketInProgress sends an email when a ticket's status changes to In Progress.
	SendTicketInProgress(recipient, ticketNumberStr, subject, assignedStaffName string) error
}

// --- Resend Implementation ---

// ResendService implements the email Service interface using the Resend API.
type ResendService struct {
	client    *resend.Client // Resend API client instance
	from      string         // Default "From" address for emails
	portalURL string         // Base URL of the frontend portal (for links in emails)
	logger    *slog.Logger   // Instance logger
}

// --- Constructor ---

// NewService creates a new email service instance based on the provided configuration.
// Currently supports the "resend" provider.
//
// Parameters:
//   - cfg: The email configuration (config.EmailConfig).
//   - portalURL: The base URL of the frontend portal.
//
// Returns:
//   - Service: An implementation of the email Service interface.
//   - error: An error if the configuration is invalid or the provider is unsupported.
func NewService(cfg config.EmailConfig, portalURL string) (Service, error) {
	// Create a logger specific to the email service
	logger := slog.With("service", "EmailService", "provider", cfg.Provider)

	switch cfg.Provider {
	case "resend":
		// Validate required configuration for Resend
		if cfg.APIKey == "" {
			err := errors.New("resend API key (EMAIL_API_KEY) is required")
			logger.Error("Initialization failed", "error", err)
			return nil, err
		}
		if cfg.From == "" {
			err := errors.New("sender email address (EMAIL_FROM) is required")
			logger.Error("Initialization failed", "error", err)
			return nil, err
		}
		if portalURL == "" {
			// Warn if portal URL is missing, as links might be broken
			logger.Warn("Portal base URL (PORTAL_BASE_URL) is not configured. Links in emails may not work correctly.")
		}

		logger.Info("Initializing Resend email service", "fromAddress", cfg.From)
		return &ResendService{
			client:    resend.NewClient(cfg.APIKey),
			from:      cfg.From,
			portalURL: portalURL, // Store portal URL for use in templates
			logger:    logger,
		}, nil
	// case "smtp": // Example placeholder for future SMTP support
	//     // Initialize SMTP client...
	//     logger.Info("Initializing SMTP email service")
	//     return nil, errors.New("SMTP provider not yet implemented")
	default:
		err := fmt.Errorf("unsupported email provider: '%s'", cfg.Provider)
		logger.Error("Initialization failed", "error", err)
		return nil, err
	}
}

// --- Template Rendering Helper ---

// renderTemplate executes a specific HTML template with the given data.
//
// Parameters:
//   - logger: The slog logger instance for context.
//   - templateName: The filename of the template to render (e.g., "ticket_confirmation.html").
//   - data: The data object to pass to the template.
//
// Returns:
//   - string: The rendered HTML content.
//   - error: An error if template execution fails.
func renderTemplate(logger *slog.Logger, templateName string, data interface{}) (string, error) {
	var body bytes.Buffer
	// Execute the named template from the pre-parsed set
	err := templates.ExecuteTemplate(&body, templateName, data)
	if err != nil {
		logger.Error("Failed to execute email template", "template", templateName, "error", err)
		return "", fmt.Errorf("template execution failed for %s: %w", templateName, err)
	}
	return body.String(), nil
}

// --- Email Sending Methods (Resend Implementation) ---

// sendEmail is a helper function to encapsulate the common Resend API call logic.
func (s *ResendService) sendEmail(templateName, recipient, subject string, data map[string]string) error {
	// Add the PortalURL to the data map for all templates that might need it
	if s.portalURL != "" {
		data["PortalURL"] = s.portalURL
	} else {
		data["PortalURL"] = "#" // Provide a fallback placeholder if not configured
	}

	// Render the HTML content from the template
	htmlContent, err := renderTemplate(s.logger, templateName, data)
	if err != nil {
		// Error already logged by renderTemplate
		return err // Propagate error
	}

	// Prepare the email parameters for the Resend API
	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{recipient},
		Subject: subject,
		Html:    htmlContent,
		ReplyTo: s.from, // Allow users to reply to the support address
	}

	// Send the email using the Resend client
	_, err = s.client.Emails.Send(params)
	if err != nil {
		s.logger.Error("Failed to send email via Resend", "recipient", recipient, "subject", subject, "template", templateName, "error", err)
		// Return a more generic error to the caller, hiding Resend specifics
		return errors.New("failed to send email via provider")
	}

	s.logger.Info("Email sent successfully", "recipient", recipient, "subject", subject, "template", templateName)
	return nil
}

// SendTicketConfirmation sends a confirmation email for a new ticket.
func (s *ResendService) SendTicketConfirmation(recipient, ticketID, subject string) error {
	templateName := "ticket_confirmation.html"
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket Received [#%s]", ticketID)
	data := map[string]string{
		"TicketID": ticketID,
		"Subject":  subject,
	}
	return s.sendEmail(templateName, recipient, emailSubject, data)
}

// SendTicketClosure sends an email notifying the user that their ticket is closed.
func (s *ResendService) SendTicketClosure(recipient, ticketID, subject, resolution string) error {
	templateName := "ticket_closure.html"
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket Closed [#%s]", ticketID)
	data := map[string]string{
		"TicketID":   ticketID,
		"Subject":    subject,
		"Resolution": resolution,
	}
	return s.sendEmail(templateName, recipient, emailSubject, data)
}

// SendTaskAssignment sends an email notifying a user they have been assigned a task.
func (s *ResendService) SendTaskAssignment(recipient, taskTitle, dueDate string) error {
	templateName := "task_assignment.html"
	emailSubject := "IT Helpdesk - New Task Assigned"
	data := map[string]string{
		"TaskTitle": taskTitle,
		"DueDate":   dueDate, // Expect pre-formatted due date string
	}
	// sendEmail helper automatically adds PortalURL
	return s.sendEmail(templateName, recipient, emailSubject, data)
}

// SendTicketInProgress sends an email notifying the user their ticket is being worked on.
func (s *ResendService) SendTicketInProgress(recipient, ticketNumberStr, subject, assignedStaffName string) error {
	templateName := "ticket_in_progress.html"
	emailSubject := fmt.Sprintf("IT Helpdesk - Ticket In Progress [#%s]", ticketNumberStr)
	data := map[string]string{
		"TicketNumber":      ticketNumberStr,
		"Subject":           subject,
		"AssignedStaffName": assignedStaffName,
	}
	return s.sendEmail(templateName, recipient, emailSubject, data)
}

