// src/pages/public/FAQPage.tsx
// ==========================================================================
// Component representing the public Frequently Asked Questions page.
// Displays questions and answers, potentially filterable by category.
// ==========================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../../components/common/Loader'; // Reusable Loader
import Alert from '../../components/common/Alert'; // Reusable Alert
import Input from '../../components/common/Input'; // Reusable Input (for search)
import Button from '../../components/common/Button'; // Reusable Button
import { ChevronDown, Search } from 'lucide-react'; // Icons
// import { fetchFAQs } from '../../services/faqService'; // Example API service

// --- Mock Data (Replace with API call) ---
interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const MOCK_FAQS: FAQItem[] = [
  { id: 'faq1', question: 'How do I submit a new ticket?', answer: 'You can submit a new ticket by navigating to the "Create Ticket" page from the main menu and filling out the required information.', category: 'General' },
  { id: 'faq2', question: 'How can I track the status of my ticket?', answer: 'Once submitted, you should receive an email confirmation with a ticket ID. You may be able to track status via a link provided, or by contacting support with your ID.', category: 'Tickets' },
  { id: 'faq3', question: 'What information should I include in my ticket?', answer: 'Please provide as much detail as possible, including steps to reproduce the issue, any error messages received, and relevant system information (like browser or OS).', category: 'Tickets' },
  { id: 'faq4', question: 'What are the support hours?', answer: 'Our standard support hours are Monday to Friday, 9 AM to 5 PM Mountain Time. Critical issues may be addressed outside these hours based on severity.', category: 'General' },
  { id: 'faq5', question: 'How do I reset my password?', answer: 'If you are a registered staff member or admin, use the "Forgot Password" link on the login page. Public users submitting tickets do not typically have passwords.', category: 'Account' },
];

// --- Component ---

/**
 * Renders the public FAQ page, allowing users to browse and search questions.
 */
const FAQPage: React.FC = () => {
  // --- State ---
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedItem, setExpandedItem] = useState<string | null>(null); // ID of the expanded FAQ

  // --- Data Fetching ---
  useEffect(() => {
    const loadFAQs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Replace with actual API call: const data = await fetchFAQs();
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
        setFaqs(MOCK_FAQS);
      } catch (err: any) {
        console.error("Failed to load FAQs:", err);
        setError(err.message || 'Could not load frequently asked questions.');
      } finally {
        setIsLoading(false);
      }
    };
    loadFAQs();
  }, []); // Fetch on initial mount

  // --- Memoized Calculations ---
  // Get unique categories from the loaded FAQs
  const categories = useMemo(() => {
    const uniqueCategories = new Set(faqs.map(faq => faq.category));
    return ['All', ...Array.from(uniqueCategories)];
  }, [faqs]);

  // Filter FAQs based on selected category and search term
  const filteredFaqs = useMemo(() => {
    return faqs.filter(faq => {
      const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
      const matchesSearch = searchTerm === '' ||
                            faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [faqs, selectedCategory, searchTerm]);

  // --- Handlers ---
  /**
   * Toggles the expanded state of an FAQ item.
   * @param id - The ID of the FAQ item to toggle.
   */
  const handleToggleExpand = (id: string) => {
    setExpandedItem(prevId => (prevId === id ? null : id));
  };

  /**
   * Handles changes in the search input field.
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  /**
   * Handles form submission for search (optional, could search on change).
   */
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // Search filtering is already happening via useMemo as searchTerm changes
      console.log("Searching for:", searchTerm);
  };

  // --- Render ---
  return (
    <div className="faq-page">
      {/* --- Page Header --- */}
      <section className="faq-header">
        <h1>Frequently Asked Questions</h1>
        <p>Find answers to common questions about our helpdesk system and support process.</p>
        <form onSubmit={handleSearchSubmit} className="search-form">
            {/* Using standard input for simplicity, could use Input component */}
            <input
              type="search"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input" // Assumes styling in SCSS
              aria-label="Search FAQs"
            />
            <Button type="submit" variant="primary" aria-label="Search">
              <Search size={20}/>
            </Button>
        </form>
      </section>

      {/* --- Loading State --- */}
      {isLoading && <Loader text="Loading FAQs..." />}

      {/* --- Error State --- */}
      {error && !isLoading && (
          <div className="error-message"> {/* Uses global style */}
            <p>Error: {error}</p>
            {/* Optional: Add a retry button */}
          </div>
      )}

      {/* --- FAQ Content --- */}
      {!isLoading && !error && (
        <section className="faq-content">
          {/* Category Filters (Sidebar on larger screens) */}
          <aside className="category-filters">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? 'active' : ''}
              >
                {category}
              </button>
            ))}
          </aside>

          {/* FAQ List */}
          <main className="faq-list">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map(faq => (
                <div key={faq.id} className="faq-item">
                  <button // Use button for accessibility
                    className={`faq-question ${expandedItem === faq.id ? 'expanded' : ''}`}
                    onClick={() => handleToggleExpand(faq.id)}
                    aria-expanded={expandedItem === faq.id}
                    aria-controls={`faq-answer-${faq.id}`}
                  >
                    <h3>{faq.question}</h3>
                    <span className="expand-icon">
                        <ChevronDown size={20} style={{ transform: expandedItem === faq.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease-in-out' }} />
                    </span>
                  </button>
                  {/* Conditionally render answer */}
                  {expandedItem === faq.id && (
                    <div id={`faq-answer-${faq.id}`} className="faq-answer" role="region">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              // No results message
              <div className="no-results">
                  <p>No questions found matching your criteria.</p>
                  {searchTerm && (
                      <Button variant="outline" onClick={() => setSearchTerm('')} className="clear-search">
                        Clear Search
                      </Button>
                  )}
              </div>
            )}
          </main>
        </section>
      )}

      {/* --- Footer CTA --- */}
      <section className="faq-footer">
        <h2>Can't find your answer?</h2>
        <p>If you couldn't find the answer to your question, please feel free to submit a support ticket.</p>
        <Link to="/create-ticket">
          <Button variant="primary" className="cta-button">
            Submit a Ticket
          </Button>
        </Link>
      </section>
    </div>
  );
};

export default FAQPage;
