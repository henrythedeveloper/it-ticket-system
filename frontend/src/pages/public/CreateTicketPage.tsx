import React, { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api';
import { TicketCreate, Tag, APIResponse, Ticket } from '../../types/models';

const TicketSchema = Yup.object().shape({
  end_user_email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  issue_type: Yup.string()
    .required('Issue type is required'),
  urgency: Yup.string()
    .oneOf(['Low', 'Medium', 'High', 'Critical'], 'Invalid urgency level')
    .required('Urgency is required'),
  subject: Yup.string()
    .min(5, 'Subject must be at least 5 characters')
    .max(200, 'Subject must be less than 200 characters')
    .required('Subject is required'),
  body: Yup.string()
    .required('Description is required'),
});

const CreateTicketPage: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayTicketId, setDisplayTicketId] = useState<number | null>(null);

  useEffect(() => {
    // Fetch available tags
    const fetchTags = async () => {
      try {
        const response = await api.get<APIResponse<Tag[]>>('/tags');
        if (response.data.success && response.data.data) {
          setTags(response.data.data);
        }
      } catch (err) {
        console.error('Error fetching tags:', err);
        // Don't show error for tags, as it's not critical
      }
    };

    fetchTags();
  }, []);

  const handleTagToggle = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter(tag => tag !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const issueTypes = [
    'Hardware Problem',
    'Software Issue',
    'Network Issue',
    'Account Access',
    'Email Problem',
    'Printer Issue',
    'New Equipment Request',
    'Other'
  ];

  const handleSubmit = async (values: Omit<TicketCreate, 'tags'>, { resetForm }: { resetForm: () => void }) => {
    try {
      setError(null);
      
      // Add selected tags to the ticket data
      const ticketData: TicketCreate = {
        ...values,
        tags: selectedTags.length > 0 ? selectedTags : undefined
      };
      
      const response = await api.post<APIResponse<Ticket>>('/tickets', ticketData); 
      
      if (response.data.success && response.data.data) {
        setDisplayTicketId(response.data.data.ticket_number); 
        setSuccess(true);
        resetForm();
        setSelectedTags([]);
        
        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(response.data.error || 'Failed to create ticket. Please try again.');
      }
    } catch (err: any) {
      console.error('Error creating ticket:', err);
      setError(err.response?.data?.error || 'Failed to create ticket. Please try again.');
    }
  };

  return (
    <div className="create-ticket-page">
      <div className="page-header">
        <h1>Submit a Support Ticket</h1>
        <p>Fill out the form below to submit a new support request.</p>
      </div>

      {success && (
        <div className="success-message">
          <h2>Ticket Submitted Successfully!</h2>
          <p>Your support ticket (ID: #{displayTicketId}) has been created. You will receive a confirmation email shortly.</p>
          <p>We will respond to your request as soon as possible.</p>
          <button 
            className="new-ticket-btn"
            onClick={() => {
              setSuccess(false);
              setDisplayTicketId(null);
            }}
          >
            Submit Another Ticket
          </button>
        </div>
      )}

      {!success && (
        <>
          {error && <div className="error-message">{error}</div>}

          <Formik
            initialValues={{
              end_user_email: '',
              issue_type: '',
              urgency: 'Medium',
              subject: '',
              body: ''
            }}
            validationSchema={TicketSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting }) => (
              <Form className="ticket-form">
                <div className="form-group">
                  <label htmlFor="end_user_email">Email Address</label>
                  <Field
                    type="email"
                    name="end_user_email"
                    id="end_user_email"
                    placeholder="Enter your email address"
                  />
                  <ErrorMessage name="end_user_email" component="div" className="error" />
                </div>

                <div className="form-group">
                  <label htmlFor="issue_type">Issue Type</label>
                  <Field as="select" name="issue_type" id="issue_type">
                    <option value="">Select an issue type</option>
                    {issueTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </Field>
                  <ErrorMessage name="issue_type" component="div" className="error" />
                </div>

                <div className="form-group">
                  <label htmlFor="urgency">Urgency Level</label>
                  <Field as="select" name="urgency" id="urgency">
                    <option value="Low">Low - Not time-sensitive</option>
                    <option value="Medium">Medium - Standard priority</option>
                    <option value="High">High - Important issue</option>
                    <option value="Critical">Critical - Work-stopping issue</option>
                  </Field>
                  <ErrorMessage name="urgency" component="div" className="error" />
                </div>

                <div className="form-group">
                  <label htmlFor="subject">Subject</label>
                  <Field
                    type="text"
                    name="subject"
                    id="subject"
                    placeholder="Brief summary of your issue"
                  />
                  <ErrorMessage name="subject" component="div" className="error" />
                </div>

                <div className="form-group">
                  <label htmlFor="body">Description</label>
                  <Field
                    as="textarea"
                    name="body"
                    id="body"
                    rows={8}
                    placeholder="Please provide details about your issue..."
                  />
                  <ErrorMessage name="body" component="div" className="error" />
                </div>

                {tags.length > 0 && (
                  <div className="form-group">
                    <label>Related Tags (Optional)</label>
                    <div className="tags-container">
                      {tags.map(tag => (
                        <div
                          key={tag.id}
                          className={`tag ${selectedTags.includes(tag.name) ? 'selected' : ''}`}
                          onClick={() => handleTagToggle(tag.name)}
                        >
                          {tag.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className={`submit-button ${isSubmitting ? 'loading' : ''}`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </Form>
            )}
          </Formik>
        </>
      )}
    </div>
  );
};

export default CreateTicketPage;