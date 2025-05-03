// src/components/notifications/NotificationBell.tsx
// ==========================================================================
// Notification Bell component that shows a count of new notifications
// and displays them in a dropdown when clicked.
// ==========================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTickets } from '../../context/TicketContext';
import { formatRelativeTime } from '../../utils/helpers';
import { Bell } from 'lucide-react';


const NotificationBell: React.FC = () => {
  const { notifications, hasNewNotifications, markNotificationsAsRead } = useTickets();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside of the notification dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle opening and closing the dropdown
  const toggleDropdown = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    // Mark notifications as read when opening the dropdown
    if (newIsOpen && hasNewNotifications) {
      markNotificationsAsRead();
    }
  };

  // Navigate to the related ticket when a notification is clicked
  const handleNotificationClick = (ticketId?: string) => {
    if (ticketId) {
      navigate(`/tickets/${ticketId}`);
      setIsOpen(false);
    }
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        className={`notification-bell ${hasNewNotifications ? 'has-notifications' : ''}`}
        onClick={toggleDropdown}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {hasNewNotifications && notifications.filter(n => !n.isRead).length > 0 && (
          <span className="notification-badge">
            {notifications.filter(n => !n.isRead).length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
          </div>
          <div className="notification-content">
            {notifications.length === 0 ? (
              <p className="no-notifications">No new notifications</p>
            ) : (
              <ul className="notification-list">
                {notifications.map(notification => (
                  <li 
                    key={notification.id} 
                    className={`notification-item ${notification.isRead ? '' : 'unread'}`}
                    onClick={() => handleNotificationClick(notification.ticketId)}
                  >
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">
                      {formatRelativeTime(notification.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="notification-footer">
              <button
                className="mark-all-read"
                onClick={markNotificationsAsRead}
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;