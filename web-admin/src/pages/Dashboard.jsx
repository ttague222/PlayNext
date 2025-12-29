/**
 * PlayNext Admin Dashboard
 */

import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/client';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, healthRes] = await Promise.all([
          api.getCatalogStats(),
          api.detailedHealthCheck(),
        ]);
        setStats(statsRes.data);
        setHealth(healthRes.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="loading">Loading dashboard...</div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard">
      <div className="dashboard">
        {/* Stats cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Games</h3>
            <p className="stat-value">{stats?.total_games || 0}</p>
          </div>

          <div className="stat-card">
            <h3>API Status</h3>
            <p className={`stat-value status-${health?.status}`}>
              {health?.status || 'Unknown'}
            </p>
          </div>
        </div>

        {/* Breakdown by platform */}
        {stats?.by_platform && (
          <div className="breakdown-section">
            <h3>Games by Platform</h3>
            <div className="breakdown-grid">
              {Object.entries(stats.by_platform).map(([platform, count]) => (
                <div key={platform} className="breakdown-item">
                  <span className="breakdown-label">{platform}</span>
                  <span className="breakdown-value">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Breakdown by energy level */}
        {stats?.by_energy_level && (
          <div className="breakdown-section">
            <h3>Games by Energy Level</h3>
            <div className="breakdown-grid">
              {Object.entries(stats.by_energy_level).map(([level, count]) => (
                <div key={level} className="breakdown-item">
                  <span className="breakdown-label">{level}</span>
                  <span className="breakdown-value">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Breakdown by play style */}
        {stats?.by_play_style && (
          <div className="breakdown-section">
            <h3>Games by Play Style</h3>
            <div className="breakdown-grid">
              {Object.entries(stats.by_play_style).map(([style, count]) => (
                <div key={style} className="breakdown-item">
                  <span className="breakdown-label">{style}</span>
                  <span className="breakdown-value">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <a href="/games/new" className="btn btn-primary">
              Add New Game
            </a>
            <a href="/games" className="btn btn-secondary">
              View Catalog
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
