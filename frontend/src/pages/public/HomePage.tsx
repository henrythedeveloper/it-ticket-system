// src/pages/public/HomePage.tsx
// ==========================================================================
// Component representing the public landing page of the application.
// Displays informational sections like Hero, Features, How It Works, CTA.
// ==========================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/common/Button'; // Reusable Button
import { Zap, ShieldCheck, Clock, Users, MessageSquare, Send } from 'lucide-react'; // Icons

// --- Component ---

/**
 * Renders the public homepage with various informational sections.
 */
const HomePage: React.FC = () => {
  // --- Render ---
  return (
    <div className="home-page">
      {/* --- Hero Section --- */}
      <section className="hero">
        <div className="hero-content">
          <h1>Streamline Your IT Support</h1>
          <p>
            A simple, efficient helpdesk ticketing system designed to manage
            support requests and resolve issues faster.
          </p>
          <div className="hero-buttons">
            <Link to="/create-ticket">
              <Button variant="primary" size="lg" className="btn-primary"> {/* Use specific class for hero styling */}
                Submit a Ticket
              </Button>
            </Link>
            {/* Optional: Link to login or features */}
            {/* <Link to="/login">
              <Button variant="outline" size="lg" className="btn-outline">
                Agent Login
              </Button>
            </Link> */}
          </div>
        </div>
      </section>

      {/* --- Features Section --- */}
      <section className="features">
        <h2>Key Features</h2>
        <div className="feature-grid">
          {/* Feature 1 */}
          <div className="feature-card">
              <div className="feature-icon"><Zap /></div>
              <h3>Fast Ticket Submission</h3>
              <p>Quickly submit support requests through a simple, intuitive form.</p>
          </div>
          {/* Feature 2 */}
          <div className="feature-card">
              <div className="feature-icon"><Users /></div>
              <h3>User & Staff Management</h3>
              <p>Administer users and support staff with role-based access control.</p>
          </div>
          {/* Feature 3 */}
          <div className="feature-card">
              <div className="feature-icon"><Clock /></div>
              <h3>Status Tracking</h3>
              <p>Easily track the status and progress of your submitted tickets.</p>
          </div>
            {/* Feature 4 */}
            <div className="feature-card">
              <div className="feature-icon"><MessageSquare /></div>
              <h3>Communication Log</h3>
              <p>Keep a clear history of all updates and comments on each ticket.</p>
          </div>
            {/* Feature 5 */}
            <div className="feature-card">
              <div className="feature-icon"><ShieldCheck /></div>
              <h3>Secure & Reliable</h3>
              <p>Built with security in mind to protect your support data.</p>
          </div>
            {/* Feature 6 */}
            <div className="feature-card">
              <div className="feature-icon"><Send /></div>
              <h3>Notifications</h3>
              <p>Stay informed with email notifications for important ticket events.</p>
          </div>
        </div>
      </section>

      {/* --- How It Works Section --- */}
      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          {/* Step 1 */}
          <div className="step">
            <div className="step-number">1</div>
            <h3>Submit Ticket</h3>
            <p>Users submit their issues via the public portal or email.</p>
          </div>
          {/* Step 2 */}
          <div className="step">
            <div className="step-number">2</div>
            <h3>Assign & Track</h3>
            <p>Tickets are automatically categorized or manually assigned to staff.</p>
          </div>
          {/* Step 3 */}
          <div className="step">
            <div className="step-number">3</div>
            <h3>Resolve & Close</h3>
            <p>Staff work on the issue, communicate updates, and resolve the ticket.</p>
          </div>
        </div>
      </section>

      {/* --- Call to Action Section --- */}
      <section className="cta">
        <h2>Ready to Simplify Your Support?</h2>
        <p>
          Get started today by submitting your first ticket or exploring the
          agent dashboard.
        </p>
        <Link to="/create-ticket">
          <Button variant="primary" size="lg" className="btn-primary"> {/* Use specific class for CTA styling */}
            Create Your First Ticket
          </Button>
        </Link>
      </section>
    </div>
  );
};

export default HomePage;
