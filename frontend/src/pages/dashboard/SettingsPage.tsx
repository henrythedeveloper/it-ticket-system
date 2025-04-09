import React, { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { APIResponse } from '../../types/models';

interface AppSettings {
  email_notifications_enabled: boolean;
  default_ticket_assignee: string;
  auto_close_resolved_tickets_days: number;
  available_issue_types: string[];
  new_issue_type?: string;
}

// Schema for validation
const SettingsSchema = Yup.object().shape({
  email_notifications_enabled: Yup.boolean(),
  default_ticket_assignee: Yup.string().nullable(),
  auto_close_resolved_tickets_days: Yup.number()
    .positive('Value must be positive')
    .integer('Value must be an integer')
    .min(1, 'Minimum value is 1')
    .nullable(),
  available_issue_types: Yup.array().of(Yup.string()),
  new_issue_type: Yup.string()
    .matches(/^[a-zA-Z0-9\s-]+$/, 'Only alphanumeric characters, spaces, and hyphens are allowed')
    .max(50, 'Issue type cannot be more than 50 characters')
    .nullable()
});

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>({
    email_notifications_enabled: true,
    default_ticket_assignee: '',
    auto_close_resolved_tickets_days: 7,
    available_issue_types: [
      'Hardware Problem',
      'Software Issue',
      'Network Issue',
      'Account Access',
      'Email Problem',
      'Printer Issue',
      'New Equipment Request',
      'Other'
    ]
  });
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Check if user is admin, otherwise show limited settings
  const isAdmin = user?.role === 'Admin';
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch settings
        try {
          const settingsResponse = await api.get<APIResponse<AppSettings>>('/settings');
          if (settingsResponse.data.success && settingsResponse.data.data) {
            setSettings(settingsResponse.data.data);
          }
        } catch (err) {
          console.error('Settings API not implemented yet, using defaults');
          // Using default settings if API not implemented yet
        }
        
        // Fetch users for assignee dropdown (admin only)
        if (isAdmin) {
          try {
            const usersResponse = await api.get<APIResponse<any>>('/users');
            if (usersResponse.data.success && usersResponse.data.data) {
              setUsers(usersResponse.data.data.map((u: any) => ({
                id: u.id,
                name: u.name
              })));
            }
          } catch (err) {
            console.error('Error fetching users:', err);
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [isAdmin]);
  
  const handleSubmit = async (values: AppSettings) => {
    try {
      setError(null);
      setSuccess(null);
      
      // Add new issue type if provided
      if (values.new_issue_type) {
        const trimmedType = values.new_issue_type.trim();
        if (trimmedType && !values.available_issue_types.includes(trimmedType)) {
          values.available_issue_types = [...values.available_issue_types, trimmedType];
        }
      }
      
      // Remove the temporary field before submitting
      const { new_issue_type, ...settingsToSave } = values;
      
      // In a real implementation, this would be an API call
      console.log('Saving settings:', settingsToSave);
      
      // Mock successful update
      setSettings(prevSettings => ({
        ...prevSettings,
        ...settingsToSave
      }));
      
      setSuccess('Settings updated successfully');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.error || 'Failed to update settings');
    }
  };
  
  const handleRemoveIssueType = (index: number, setFieldValue: any, values: AppSettings) => {
    const newTypes = [...values.available_issue_types];
    newTypes.splice(index, 1);
    setFieldValue('available_issue_types', newTypes);
  };
  
  if (loading) {
    return (
      <div className="settings-page loading">
        <div className="loader"></div>
        <p>Loading settings...</p>
      </div>
    );
  }
  
  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Application Settings</h1>
      </div>
      
      {!isAdmin && (
        <div className="admin-notice">
          <p>Some settings are only available to administrators</p>
        </div>
      )}
      
      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}
      
      <div className="settings-container">
        <Formik
          initialValues={{
            ...settings,
            new_issue_type: ''
          }}
          validationSchema={SettingsSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ isSubmitting, values, setFieldValue }) => (
            <Form className="settings-form">
              <div className="settings-section">
                <h2>Notification Settings</h2>
                
                <div className="form-group checkbox">
                  <label>
                    <Field type="checkbox" name="email_notifications_enabled" />
                    Enable email notifications
                  </label>
                  <div className="field-description">
                    Receive email notifications for ticket updates and task assignments
                  </div>
                </div>
              </div>
              
              {isAdmin && (
                <>
                  <div className="settings-section">
                    <h2>Ticket Management</h2>
                    
                    <div className="form-group">
                      <label htmlFor="default_ticket_assignee">Default Ticket Assignee</label>
                      <Field as="select" name="default_ticket_assignee" id="default_ticket_assignee">
                        <option value="">No default (tickets start unassigned)</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </Field>
                      <div className="field-description">
                        Automatically assign new tickets to this user
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="auto_close_resolved_tickets_days">
                        Auto-close Resolved Tickets (days)
                      </label>
                      <Field
                        type="number"
                        name="auto_close_resolved_tickets_days"
                        id="auto_close_resolved_tickets_days"
                        min="1"
                      />
                      <div className="field-description">
                        Number of days after which resolved tickets are automatically closed
                      </div>
                      <ErrorMessage name="auto_close_resolved_tickets_days" component="div" className="error" />
                    </div>
                  </div>
                  
                  <div className="settings-section">
                    <h2>Issue Types</h2>
                    <div className="issue-types-list">
                      {values.available_issue_types.map((type, index) => (
                        <div key={index} className="issue-type-item">
                          <span>{type}</span>
                          <button
                            type="button"
                            className="remove-btn"
                            onClick={() => handleRemoveIssueType(index, setFieldValue, values)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="new_issue_type">Add New Issue Type</label>
                      <div className="input-with-button">
                        <Field
                          type="text"
                          name="new_issue_type"
                          id="new_issue_type"
                          placeholder="Enter new issue type"
                        />
                        <button
                          type="button"
                          className="add-btn"
                          onClick={() => {
                            if (values.new_issue_type) {
                              const trimmedType = values.new_issue_type.trim();
                              if (trimmedType && !values.available_issue_types.includes(trimmedType)) {
                                setFieldValue('available_issue_types', [
                                  ...values.available_issue_types,
                                  trimmedType
                                ]);
                                setFieldValue('new_issue_type', '');
                              }
                            }
                          }}
                        >
                          Add
                        </button>
                      </div>
                      <ErrorMessage name="new_issue_type" component="div" className="error" />
                    </div>
                  </div>
                </>
              )}
              
              <div className="form-actions">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="submit-btn"
                >
                  {isSubmitting ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default SettingsPage;