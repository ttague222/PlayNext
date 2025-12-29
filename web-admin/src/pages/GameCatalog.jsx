/**
 * PlayNext Game Catalog Page
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

const GameCatalog = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');

  useEffect(() => {
    fetchGames();
  }, [platformFilter]);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (platformFilter) params.platform = platformFilter;
      const response = await api.getGames(params);
      setGames(response.data);
    } catch (err) {
      console.error('Failed to fetch games:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (gameId) => {
    if (!window.confirm('Are you sure you want to delete this game?')) return;

    try {
      await api.deleteGame(gameId);
      setGames(games.filter((g) => g.game_id !== gameId));
    } catch (err) {
      console.error('Failed to delete game:', err);
      alert('Failed to delete game');
    }
  };

  const filteredGames = games.filter((game) =>
    game.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout title="Game Catalog">
      <div className="catalog-page">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search games..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-box">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              <option value="">All Platforms</option>
              <option value="pc">PC</option>
              <option value="console">Console</option>
              <option value="handheld">Handheld</option>
            </select>
          </div>

          <Link to="/games/new" className="btn btn-primary">
            Add Game
          </Link>
        </div>

        {/* Games table */}
        {loading ? (
          <div className="loading">Loading games...</div>
        ) : (
          <table className="games-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Platforms</th>
                <th>Energy</th>
                <th>Time-to-Fun</th>
                <th>Stop-Friendly</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGames.map((game) => (
                <tr key={game.game_id}>
                  <td>
                    <Link to={`/games/${game.game_id}`} className="game-title">
                      {game.title}
                    </Link>
                  </td>
                  <td>{game.platforms?.join(', ')}</td>
                  <td>
                    <span className={`badge badge-${game.energy_level}`}>
                      {game.energy_level}
                    </span>
                  </td>
                  <td>{game.time_to_fun}</td>
                  <td>{game.stop_friendliness}</td>
                  <td>
                    <div className="action-buttons">
                      <Link
                        to={`/games/${game.game_id}`}
                        className="btn btn-small"
                      >
                        Edit
                      </Link>
                      <button
                        className="btn btn-small btn-danger"
                        onClick={() => handleDelete(game.game_id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Empty state */}
        {!loading && filteredGames.length === 0 && (
          <div className="empty-state">
            <p>No games found.</p>
            <Link to="/games/new" className="btn btn-primary">
              Add your first game
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default GameCatalog;
