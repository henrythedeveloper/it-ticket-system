
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { FAQEntry, APIResponse } from '../../types/models';

const FAQPage: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQEntry[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedFaqs, setExpandedFaqs] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredFaqs, setFilteredFaqs] = useState<FAQEntry[]>([]);

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        setLoading(true);
        const response = await api.get<APIResponse<FAQEntry[]>>('/faq');
        
        if (response.data.success && response.data.data) {
          setFaqs(response.data.data);
          
          // Extract unique categories
          const uniqueCategories = Array.from(
            new Set(response.data.data.map(faq => faq.category))
          );
          setCategories(uniqueCategories);
        } else {
          setError('Failed to load FAQs');
        }
      } catch (err) {
        console.error('Error fetching FAQs:', err);
        setError('Failed to load FAQs. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchFaqs();
  }, []);

  useEffect(() => {
    // Filter FAQs based on category and search query
    let filtered = faqs;
    
    if (activeCategory !== 'all') {
      filtered = filtered.filter(faq => faq.category === activeCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        faq => 
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query)
      );
    }
    
    setFilteredFaqs(filtered);
  }, [faqs, activeCategory, searchQuery]);

  const toggleFaqExpand = (faqId: string) => {
    setExpandedFaqs(prev => 
      prev.includes(faqId)
        ? prev.filter(id => id !== faqId)
        : [...prev, faqId]
    );
  };

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  return (
    <div className="faq-page">
      <div className="faq-header">
        <h1>Frequently Asked Questions</h1>
        <p>Find answers to the most common questions about our IT services</p>
        
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search FAQs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">Search</button>
        </form>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading FAQs...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <Link to="/" className="btn">Return to Home</Link>
        </div>
      ) : (
        <div className="faq-content">
          <div className="category-filters">
            <button
              className={activeCategory === 'all' ? 'active' : ''}
              onClick={() => handleCategoryChange('all')}
            >
              All Categories
            </button>
            {categories.map(category => (
              <button
                key={category}
                className={activeCategory === category ? 'active' : ''}
                onClick={() => handleCategoryChange(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="faq-list">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map(faq => (
                <div key={faq.id} className="faq-item">
                  <div 
                    className={`faq-question ${expandedFaqs.includes(faq.id) ? 'expanded' : ''}`}
                    onClick={() => toggleFaqExpand(faq.id)}
                  >
                    <h3>{faq.question}</h3>
                    <span className="expand-icon">
                      {expandedFaqs.includes(faq.id) ? '−' : '+'}
                    </span>
                  </div>
                  {expandedFaqs.includes(faq.id) && (
                    <div className="faq-answer">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="no-results">
                <p>No FAQs found matching your criteria.</p>
                {searchQuery && (
                  <button 
                    className="clear-search"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear Search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="faq-footer">
        <h2>Still have questions?</h2>
        <p>If you couldn't find the answer you were looking for, submit a support ticket and our team will help you out.</p>
        <Link to="/create-ticket" className="cta-button">Submit a Ticket</Link>
      </div>
    </div>
  );
};

export default FAQPage;