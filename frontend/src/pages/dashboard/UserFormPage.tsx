import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { User, UserCreate, APIResponse } from '../../types/models';

// Schema for validation
const UserSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().when('isNewUser', ([isNewUser], schema) =>
    isNewUser
      ? schema.required('Password is required').min(8, 'Password must be at least 8 characters')
      : schema.min(8, 'Password must be at least 8 characters')
            .nullable()
            .transform(value => value === '' ? null : value)
  ),
  role: Yup.string().oneOf(['Staff', 'Admin'], 'Invalid role').required('Role is required'),
  isNewUser: Yup.boolean()
});

const UserFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNewUser = id === 'new';
  const navigate = useNavigate();
  const { user: currentUser, updateUser } = useAuth();
  const [loading, setLoading] = useState(!isNewUser);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin or editing their own profile
  useEffect(() => {
    if (currentUser) {
      const isAdmin = currentUser.role === 'Admin';
      const isOwnProfile = id === currentUser.id;
      
      if (!isAdmin && !isOwnProfile) {
        navigate('/dashboard');
      }
    }
  }, [currentUser, id, navigate]);

  // Fetch user data if editing existing user
  useEffect(() => {
    const fetchUser = async () => {
      if (!isNewUser && id) {
        try {
          setLoading(true);
          const response = await api.get<APIResponse<User>>(`/users/${id}`);
          if (response.data.success && response.data.data) {
            setUser(response.data.data);
          } else {
            setError('Failed to fetch user data');
          }
        } catch (error) {
          console.error('Error fetching user:', error);
          setError('Failed to fetch user data');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUser();
  }, [id, isNewUser]);

  type UserFormValues = UserCreate & {
    isNewUser: boolean;
    password?: string;  // Make password optional in the form values
  };

  const handleSubmit = async (values: UserFormValues) => {
    try {
      // Prepare data for API by removing helper fields and empty password
      const { isNewUser: _, password, ...baseData } = values;
      const userData = !isNewUser && !password ? baseData : { ...baseData, password };

      if (isNewUser) {
        const response = await api.post<APIResponse<User>>('/users', userData);
        if (response.data.success) {
          navigate('/users');
        } else {
          setError(response.data.error || 'Failed to create user');
        }
      } else {
        const response = await api.put<APIResponse<User>>(`/users/${id}`, userData);
        if (response.data.success && response.data.data) {
          // If user is updating their own profile, update the auth context
          if (id === currentUser?.id) {
            updateUser(response.data.data);
          }
          navigate('/users');
        } else {
          setError(response.data.error || 'Failed to update user');
        }
      }
    } catch (error: any) {
      console.error('Error saving user:', error);
      setError(error.response?.data?.error || 'Failed to save user');
    }
  };

  if (loading) {
    return (
      <div className="user-form-page loading">
        <div className="loader"></div>
        <p>Loading user data...</p>
      </div>
    );
  }

  // Initial form values
  const initialValues = {
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'Staff',
    isNewUser // helper field for validation
  };

  const isOwnProfile = id === currentUser?.id;
  const canChangeRole = currentUser?.role === 'Admin' && !isOwnProfile;

  return (
    <div className="user-form-page">
      <div className="page-header">
        <div className="header-left">
          <button onClick={() => navigate('/users')} className="back-button">
            ← Back to Users
          </button>
          <h1>{isNewUser ? 'Add New User' : `Edit User: ${user?.name}`}</h1>
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="user-form-container">
        <Formik
          initialValues={initialValues}
          validationSchema={UserSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="user-form">
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <Field
                  type="text"
                  name="name"
                  id="name"
                  placeholder="Enter full name"
                />
                <ErrorMessage name="name" component="div" className="error" />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <Field
                  type="email"
                  name="email"
                  id="email"
                  placeholder="Enter email address"
                />
                <ErrorMessage name="email" component="div" className="error" />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">
                  {isNewUser ? 'Password' : 'Password (Leave blank to keep current)'}
                </label>
                <Field
                  type="password"
                  name="password"
                  id="password"
                  placeholder={isNewUser ? 'Enter password' : 'Enter new password or leave blank'}
                />
                <ErrorMessage name="password" component="div" className="error" />
              </div>
              
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <Field
                  as="select"
                  name="role"
                  id="role"
                  disabled={!canChangeRole}
                >
                  <option value="Staff">Staff</option>
                  <option value="Admin">Admin</option>
                </Field>
                {!canChangeRole && (
                  <div className="field-info">
                    {isOwnProfile
                      ? "You cannot change your own role"
                      : "Only admins can change user roles"}
                  </div>
                )}
                <ErrorMessage name="role" component="div" className="error" />
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => navigate('/users')}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="submit-btn"
                >
                  {isSubmitting ? 'Saving...' : isNewUser ? 'Create User' : 'Update User'}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default UserFormPage;