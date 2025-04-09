import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { User, APIResponse } from '../../types/models';

const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Check if user is admin, otherwise redirect
  useEffect(() => {
    if (user && user.role !== 'Admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await api.get<APIResponse<User[]>>('/users');
        if (response.data.success && response.data.data) {
          setUsers(response.data.data);
        } else {
          setError('Failed to fetch users');
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        setError('Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleDeleteUser = async (userId: string) => {
    // Prevent admin from deleting themselves
    if (userId === user?.id) {
      setError("You cannot delete your own account");
      return;
    }

    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const response = await api.delete(`/users/${userId}`);
        if (response.data.success) {
          // Remove deleted user from state
          setUsers(users.filter(u => u.id !== userId));
        } else {
          setError(response.data.error || 'Failed to delete user');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        setError('Failed to delete user');
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Filter users by search query
  const filteredUsers = searchQuery
    ? users.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  if (loading) {
    return (
      <div className="users-page loading">
        <div className="loader"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Manage Users</h1>
        <div className="header-actions">
          <Link to="/users/new" className="add-user-btn">
            Add New User
          </Link>
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="search-filter">
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>
      
      {filteredUsers.length === 0 ? (
        <div className="no-users">
          {searchQuery ? (
            <p>No users found matching "{searchQuery}"</p>
          ) : (
            <p>No users have been created yet</p>
          )}
        </div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(userData => (
                <tr key={userData.id}>
                  <td>{userData.name}</td>
                  <td>{userData.email}</td>
                  <td>
                    <span className={`role-badge ${userData.role.toLowerCase()}`}>
                      {userData.role}
                    </span>
                  </td>
                  <td>{formatDate(userData.created_at)}</td>
                  <td className="actions-cell">
                    <Link to={`/users/${userData.id}`} className="edit-btn">
                      Edit
                    </Link>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteUser(userData.id)}
                      disabled={userData.id === user?.id}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UsersPage;