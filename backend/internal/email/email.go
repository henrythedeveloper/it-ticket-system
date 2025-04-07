package email

import (
	"errors"
	"fmt"

	"github.com/henrythedeveloper/bus-it-ticket/internal/config"
	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

// Service defines the email service interface
type Service interface {
	SendTicketConfirmation(recipient, ticketID, subject string) error
	SendTicketClosure(recipient, ticketID, subject, resolution string) error
	SendTaskAssignment(recipient, taskTitle, dueDate string) error
}

// SendGridService is an implementation of the email Service using SendGrid
type SendGridService struct {
	client *sendgrid.Client
	from   string
}

// NewService creates a new email service
func NewService(cfg config.EmailConfig) (Service, error) {
	switch cfg.Provider {
	case "sendgrid":
		if cfg.APIKey == "" {
			return nil, errors.New("SendGrid API key is required")
		}
		if cfg.From == "" {
			return nil, errors.New("sender email address is required")
		}
		return &SendGridService{
			client: sendgrid.NewSendClient(cfg.APIKey),
			from:   cfg.From,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported email provider: %s", cfg.Provider)
	}
}

// SendTicketConfirmation sends a confirmation email when a ticket is created
func (s *SendGridService) SendTicketConfirmation(recipient, ticketID, subject string) error {
	from := mail.NewEmail("IT Helpdesk", s.from)
	to := mail.NewEmail("", recipient)
	replyTo := mail.NewEmail("IT Support", s.from) // The end-user replies to the IT team email

	plainTextContent := fmt.Sprintf(
		"Ticket Received\n\nThank you for submitting your support request. Your ticket (ID: %s) has been received.\n\nSubject: %s\n\nWe will respond to your request as soon as possible. You can reply to this email to add more information to your ticket.",
		ticketID, subject,
	)

	htmlContent := fmt.Sprintf(`
		<h2>Ticket Received</h2>
		<p>Thank you for submitting your support request. Your ticket (ID: <strong>%s</strong>) has been received.</p>
		<p><strong>Subject:</strong> %s</p>
		<p>We will respond to your request as soon as possible. You can reply to this email to add more information to your ticket.</p>
	`, ticketID, subject)

	message := mail.NewSingleEmail(from, "IT Helpdesk - Ticket Received", to, plainTextContent, htmlContent)
	message.SetReplyTo(replyTo)

	response, err := s.client.Send(message)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	if response.StatusCode >= 400 {
		return fmt.Errorf("email API returned error: %d %s", response.StatusCode, response.Body)
	}

	return nil
}

// SendTicketClosure sends an email when a ticket is closed
func (s *SendGridService) SendTicketClosure(recipient, ticketID, subject, resolution string) error {
	from := mail.NewEmail("IT Helpdesk", s.from)
	to := mail.NewEmail("", recipient)
	replyTo := mail.NewEmail("IT Support", s.from)

	plainTextContent := fmt.Sprintf(
		"Ticket Closed\n\nYour support ticket (ID: %s) has been closed.\n\nSubject: %s\n\nResolution: %s\n\nIf you have any further questions or if the issue reoccurs, please let us know by creating a new ticket or by replying to this email.",
		ticketID, subject, resolution,
	)

	htmlContent := fmt.Sprintf(`
		<h2>Ticket Closed</h2>
		<p>Your support ticket (ID: <strong>%s</strong>) has been closed.</p>
		<p><strong>Subject:</strong> %s</p>
		<p><strong>Resolution:</strong> %s</p>
		<p>If you have any further questions or if the issue reoccurs, please let us know by creating a new ticket or by replying to this email.</p>
	`, ticketID, subject, resolution)

	message := mail.NewSingleEmail(from, "IT Helpdesk - Ticket Closed", to, plainTextContent, htmlContent)
	message.SetReplyTo(replyTo)

	response, err := s.client.Send(message)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	if response.StatusCode >= 400 {
		return fmt.Errorf("email API returned error: %d %s", response.StatusCode, response.Body)
	}

	return nil
}

// SendTaskAssignment sends an email when a task is assigned
func (s *SendGridService) SendTaskAssignment(recipient, taskTitle, dueDate string) error {
	from := mail.NewEmail("IT Helpdesk", s.from)
	to := mail.NewEmail("", recipient)

	plainTextContent := fmt.Sprintf(
		"Task Assigned\n\nYou have been assigned a new task.\n\nTask: %s\n\nDue Date: %s\n\nPlease log in to the IT Helpdesk portal to view more details and update the task status.",
		taskTitle, dueDate,
	)

	htmlContent := fmt.Sprintf(`
		<h2>Task Assigned</h2>
		<p>You have been assigned a new task.</p>
		<p><strong>Task:</strong> %s</p>
		<p><strong>Due Date:</strong> %s</p>
		<p>Please log in to the <a href="#">IT Helpdesk portal</a> to view more details and update the task status.</p>
	`, taskTitle, dueDate)

	message := mail.NewSingleEmail(from, "IT Helpdesk - Task Assigned", to, plainTextContent, htmlContent)

	response, err := s.client.Send(message)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	if response.StatusCode >= 400 {
		return fmt.Errorf("email API returned error: %d %s", response.StatusCode, response.Body)
	}

	return nil
}
