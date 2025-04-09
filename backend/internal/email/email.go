package email

import (
	"errors"
	"fmt"

	"github.com/henrythedeveloper/bus-it-ticket/internal/config"
	"github.com/resend/resend-go/v2"
)

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
		return &ResendService{
			client: resend.NewClient(cfg.APIKey),
			from:   cfg.From,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported email provider: %s", cfg.Provider)
	}
}

// SendTicketConfirmation sends a confirmation email when a ticket is created
func (s *ResendService) SendTicketConfirmation(recipient, ticketID, subject string) error {
	htmlContent := fmt.Sprintf(`
		<h2>Ticket Received</h2>
		<p>Thank you for submitting your support request. Your ticket (ID: <strong>%s</strong>) has been received.</p>
		<p><strong>Subject:</strong> %s</p>
		<p>We will respond to your request as soon as possible. You can reply to this email to add more information to your ticket.</p>
	`, ticketID, subject)

	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{recipient},
		Subject: "IT Helpdesk - Ticket Received",
		Html:    htmlContent,
		ReplyTo: s.from,
	}

	_, err := s.client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}


// SendTicketClosure sends an email when a ticket is closed
func (s *ResendService) SendTicketClosure(recipient, ticketID, subject, resolution string) error {
	htmlContent := fmt.Sprintf(`
		<h2>Ticket Closed</h2>
		<p>Your support ticket (ID: <strong>%s</strong>) has been closed.</p>
		<p><strong>Subject:</strong> %s</p>
		<p><strong>Resolution:</strong> %s</p>
		<p>If you have any further questions or if the issue reoccurs, please let us know by creating a new ticket or by replying to this email.</p>
	`, ticketID, subject, resolution)

	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{recipient},
		Subject: "IT Helpdesk - Ticket Closed",
		Html:    htmlContent,
		ReplyTo: s.from,
	}

	_, err := s.client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// SendTaskAssignment sends an email when a task is assigned
func (s *ResendService) SendTaskAssignment(recipient, taskTitle, dueDate string) error {
	htmlContent := fmt.Sprintf(`
		<h2>Task Assigned</h2>
		<p>You have been assigned a new task.</p>
		<p><strong>Task:</strong> %s</p>
		<p><strong>Due Date:</strong> %s</p>
		<p>Please log in to the <a href="#">IT Helpdesk portal</a> to view more details and update the task status.</p>
	`, taskTitle, dueDate)

	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{recipient},
		Subject: "IT Helpdesk - Task Assigned",
		Html:    htmlContent,
	}

	_, err := s.client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}
