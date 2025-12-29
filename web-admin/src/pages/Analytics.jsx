/**
 * PlayNext Analytics Page
 *
 * View recommendation and signal analytics.
 */

import React from 'react';
import Layout from '../components/Layout';

const Analytics = () => {
  return (
    <Layout title="Analytics">
      <div className="analytics-page">
        <div className="coming-soon">
          <h3>Analytics Dashboard</h3>
          <p>Analytics features will be available in a future update.</p>
          <p>Planned metrics:</p>
          <ul>
            <li>Recommendation acceptance rate</li>
            <li>Weekly repeat usage</li>
            <li>Reroll frequency</li>
            <li>"This worked for me" rate</li>
            <li>Popular time/mood combinations</li>
            <li>Top recommended games</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default Analytics;
