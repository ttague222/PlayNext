/**
 * PlayNext Protected Route Component
 *
 * Redirects to login if user is not authenticated, and blocks signed-in
 * accounts that lack the `admin` custom claim.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading, isAdmin, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="loading-screen">
        <p>{user.email || 'This account'} is not a PlayNxt admin.</p>
        <button onClick={signOut}>Sign out</button>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
