import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { APIResponse, User } from '../../types/models';

// Schema for validation
const ProfileSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  email: Yup.string().email('Invalid email address').required('Email is required'),
  currentPassword: Yup.string()
    .test(
      'password-validation',
      'Current password is required to update credentials',
      function(value) {
        // Only require current password if email is changed or new password is provided
        const { email, newPassword } = this.parent;
        if ((email !== this.options.context?.originalEmail || newPassword) && !value) {
          return false;
        }
        return true;
      }
    ),
  newPassword: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .nullable()
    .transform(value => value === '' ? null : value),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .when('newPassword', ([newPassword], schema) =>
      newPassword && newPassword.length > 0
        ? schema.required('Please confirm your password')
        : schema
    )
    .nullable()
    .transform(value => value === '' ? null : value)
});

const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (values: any) => {
    try {
      setError(null);
      setSuccess(null);
      
      // Prepare data for API
      const updateData: any = {
        name: values.name,
        email: values.email
      };
      
      // Only include password if provided
      if (values.newPassword) {
        updateData.password = values.newPassword;
      }
      
      // If sensitive fields are changed, include current password for verification
      if (values.email !== user?.email || values.newPassword) {
        if (!values.currentPassword) {
          setError('Current password is required to update email or password');
          return;
        }
        
        // First verify current password
        try {
          await api.post('/auth/verify-password', {
            password: values.currentPassword
          });
        } catch (err) {
          setError('Current password is incorrect');
          return;
        }
      }
      
      // Update profile
      const response = await api.put<APIResponse<User>>(`/users/${user?.id}`, updateData);
      
      if (response.data.success && response.data.data) {
        updateUser(response.data.data);
        setSuccess('Profile updated successfully');
      } else {
        setError(response.data.error || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.error || 'Failed to update profile');
    }
  };
  
  if (!user) {
    return (
      <div className="profile-page loading">
        <div className="loader"></div>
        <p>Loading profile data...</p>
      </div>
    );
  }
  
  const initialValues = {
    name: user.name,
    email: user.email,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>Your Profile</h1>
      </div>
      
      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}
      
      <div className="profile-container">
        <div className="profile-info">
          <div className="profile-header">
            <div className="avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="profile-meta">
              <h2>{user.name}</h2>
              <div className="profile-details">
                <span className={`role-badge ${user.role.toLowerCase()}`}>
                  {user.role}
                </span>
                <span className="join-date">
                  Member since {formatDate(user.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="profile-form-container">
          <h3>Edit Profile Information</h3>
          <Formik
            initialValues={initialValues}
            validationSchema={ProfileSchema}
            onSubmit={handleSubmit}
            enableReinitialize
            context={{ originalEmail: user.email }}
          >
            {({ isSubmitting, values }) => (
              <Form className="profile-form">
                <div className="form-group">
                  <label htmlFor="name">Name</label>
                  <Field
                    type="text"
                    name="name"
                    id="name"
                  />
                  <ErrorMessage name="name" component="div" className="error" />
                </div>
                
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <Field
                    type="email"
                    name="email"
                    id="email"
                  />
                  <ErrorMessage name="email" component="div" className="error" />
                </div>
                
                <div className="form-group">
                  <label htmlFor="role">Role</label>
                  <div className="static-field">{user.role}</div>
                  <div className="field-note">Role can only be changed by an administrator</div>
                </div>
                
                <h3>Change Password</h3>
                
                <div className="form-group">
                  <label htmlFor="currentPassword">Current Password</label>
                  <Field
                    type="password"
                    name="currentPassword"
                    id="currentPassword"
                    placeholder="Enter your current password"
                  />
                  <div className="field-note">
                    Required to change email or password
                  </div>
                  <ErrorMessage name="currentPassword" component="div" className="error" />
                </div>
                
                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <Field
                    type="password"
                    name="newPassword"
                    id="newPassword"
                    placeholder="Enter new password"
                  />
                  <div className="field-note">
                    Leave blank to keep your current password
                  </div>
                  <ErrorMessage name="newPassword" component="div" className="error" />
                </div>
                
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <Field
                    type="password"
                    name="confirmPassword"
                    id="confirmPassword"
                    placeholder="Confirm new password"
                  />
                  <ErrorMessage name="confirmPassword" component="div" className="error" />
                </div>
                
                <div className="form-actions">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="submit-btn"
                  >
                    {isSubmitting ? 'Saving...' : 'Update Profile'}
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;