import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/pages/public/HomePage.scss';

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <h1>Welcome to our IT Helpdesk</h1>
          <p>Fast, reliable support for all your IT needs</p>
          <div className="hero-buttons">
            <Link to="/create-ticket" className="btn btn-primary">Submit a Ticket</Link>
            <Link to="/faq" className="btn btn-outline">View FAQs</Link>
          </div>
        </div>
      </section>

      <section className="features">
        <h2>How We Can Help</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">💻</div>
            <h3>Hardware Support</h3>
            <p>Issues with computers, printers, or other devices? We'll help you get back up and running.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Account Access</h3>
            <p>Password resets, account lockouts, and access management resolved quickly.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌐</div>
            <h3>Network Issues</h3>
            <p>Connection problems, VPN setup, or Wi-Fi troubleshooting made simple.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Software Help</h3>
            <p>Application errors, installations, updates, and configuration assistance.</p>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Submit a Ticket</h3>
            <p>Describe your issue through our easy-to-use ticket form</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Get a Confirmation</h3>
            <p>Receive an email confirmation with your ticket details</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>We Resolve It</h3>
            <p>Our IT team works on your issue and keeps you updated</p>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Problem Solved</h3>
            <p>Get notified when your issue is resolved</p>
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>Need Help Now?</h2>
        <p>Our IT support team is ready to assist you with any technical issues.</p>
        <Link to="/create-ticket" className="btn btn-primary">Get Support</Link>
      </section>
    </div>
  );
};

export default HomePage;