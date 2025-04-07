import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/pages/auth/LoginPage.scss';

interface LocationState {
  from?: {
    pathname: string;
  };
}

const LoginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .required('Password is required'),
});

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  // Get the location the user was trying to access before redirecting to login
  const locationState = location.state as LocationState;
  const from = locationState?.from?.pathname || '/dashboard';

  const handleSubmit = async (values: { email: string; password: string }) => {
    try {
      setError(null);
      await login(values.email, values.password);
      // Redirect to the page they were trying to access or dashboard
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setError('Invalid email or password. Please try again.');
    }
  };

  return (
    <div className="login-page">
      <h1>Staff Login</h1>
      <p className="login-description">
        Sign in to access the IT Helpdesk management dashboard.
      </p>
      
      {error && <div className="error-message">{error}</div>}
      
      <Formik
        initialValues={{ email: '', password: '' }}
        validationSchema={LoginSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting }) => (
          <Form className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <Field
                type="email"
                name="email"
                id="email"
                placeholder="Enter your email"
                autoComplete="email"
              />
              <ErrorMessage name="email" component="div" className="error" />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <Field
                type="password"
                name="password"
                id="password"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <ErrorMessage name="password" component="div" className="error" />
            </div>
            
            <button
              type="submit"
              className={`submit-button ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default LoginPage;