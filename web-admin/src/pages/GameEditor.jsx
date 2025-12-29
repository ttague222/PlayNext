/**
 * PlayNext Game Editor Page
 *
 * Create or edit a game in the catalog.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

const PLATFORMS = ['pc', 'console', 'handheld'];
const PLAY_STYLES = ['narrative', 'action', 'puzzle_strategy', 'sandbox_creative'];
const MULTIPLAYER_MODES = ['solo', 'local_coop', 'online_coop', 'competitive'];
const ENERGY_LEVELS = ['low', 'medium', 'high'];
const TIME_TO_FUN = ['short', 'medium', 'long'];
const STOP_FRIENDLINESS = ['anytime', 'checkpoints', 'commitment'];
const TIME_TAGS = [15, 30, 60, 90, 120];
const SUBSCRIPTION_SERVICES = ['xbox_game_pass', 'ea_play', 'ps_plus_extra', 'netflix_games', 'apple_arcade'];
const CONTENT_WARNINGS = ['mild_violence', 'cartoon_violence', 'mature_themes', 'substance_use', 'horror', 'gambling'];
const COMMON_GENRES = ['action', 'adventure', 'rpg', 'jrpg', 'platformer', 'puzzle', 'strategy', 'simulation', 'racing', 'sports', 'shooter', 'horror', 'roguelike', 'metroidvania', 'souls-like', 'indie', 'co-op', 'pixel-art', 'retro', 'open-world', 'survival', 'crafting', 'card-game', 'deckbuilder', 'visual-novel', 'fighting', 'rhythm'];
const COMMON_MOODS = ['relaxing', 'exciting', 'challenging', 'cozy', 'atmospheric', 'fun', 'nostalgic', 'intense', 'thoughtful', 'creative', 'social', 'competitive', 'meditative', 'epic', 'mysterious', 'charming', 'dark', 'funny', 'emotional', 'mind-bending'];

const GameEditor = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!gameId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    game_id: '',
    title: '',
    description_short: '',
    platforms: [],
    release_year: new Date().getFullYear(),
    genre_tags: [],
    time_tags: [],
    energy_level: 'medium',
    mood_tags: [],
    play_style: [],
    time_to_fun: 'medium',
    stop_friendliness: 'checkpoints',
    multiplayer_modes: ['solo'],
    avg_session_length: null,
    subscription_services: [],
    content_warnings: [],
    store_links: {},
    explanation_templates: {
      time_fit: '',
      mood_fit: '',
      stop_fit: '',
      style_fit: '',
      session_fit: '',
    },
  });

  const [customGenre, setCustomGenre] = useState('');
  const [customMood, setCustomMood] = useState('');

  useEffect(() => {
    if (isEditing) {
      fetchGame();
    }
  }, [gameId]);

  const fetchGame = async () => {
    setLoading(true);
    try {
      const response = await api.getGame(gameId);
      setForm(response.data);
    } catch (err) {
      setError('Failed to load game');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleArrayToggle = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleTemplateChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      explanation_templates: {
        ...prev.explanation_templates,
        [field]: value,
      },
    }));
  };

  const handleStoreLinkChange = (store, url) => {
    setForm((prev) => ({
      ...prev,
      store_links: {
        ...prev.store_links,
        [store]: url,
      },
    }));
  };

  const handleAddCustomTag = (field, value, setValue) => {
    if (value.trim() && !form[field].includes(value.trim())) {
      setForm((prev) => ({
        ...prev,
        [field]: [...prev[field], value.trim()],
      }));
      setValue('');
    }
  };

  const handleRemoveTag = (field, tag) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((t) => t !== tag),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEditing) {
        await api.updateGame(gameId, form);
      } else {
        await api.createGame(form);
      }
      navigate('/games');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save game');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title={isEditing ? 'Edit Game' : 'Add Game'}>
        <div className="loading">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout title={isEditing ? `Edit: ${form.title}` : 'Add New Game'}>
      <form onSubmit={handleSubmit} className="game-form">
        {error && <div className="error-message">{error}</div>}

        {/* Basic Info */}
        <section className="form-section">
          <h3>Basic Information</h3>

          {!isEditing && (
            <div className="form-group">
              <label>Game ID (slug)</label>
              <input
                type="text"
                value={form.game_id}
                onChange={(e) => handleChange('game_id', e.target.value)}
                placeholder="vampire-survivors"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Short Description</label>
            <textarea
              value={form.description_short}
              onChange={(e) => handleChange('description_short', e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label>Release Year</label>
            <input
              type="number"
              value={form.release_year}
              onChange={(e) => handleChange('release_year', parseInt(e.target.value))}
              min={1980}
              max={2030}
            />
          </div>
        </section>

        {/* Platforms */}
        <section className="form-section">
          <h3>Platforms</h3>
          <div className="checkbox-group">
            {PLATFORMS.map((platform) => (
              <label key={platform} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.platforms.includes(platform)}
                  onChange={() => handleArrayToggle('platforms', platform)}
                />
                {platform.charAt(0).toUpperCase() + platform.slice(1)}
              </label>
            ))}
          </div>
        </section>

        {/* Play Style */}
        <section className="form-section">
          <h3>Play Style</h3>
          <div className="checkbox-group">
            {PLAY_STYLES.map((style) => (
              <label key={style} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.play_style.includes(style)}
                  onChange={() => handleArrayToggle('play_style', style)}
                />
                {style.replace('_', ' ')}
              </label>
            ))}
          </div>
        </section>

        {/* Multiplayer */}
        <section className="form-section">
          <h3>Multiplayer Modes</h3>
          <div className="checkbox-group">
            {MULTIPLAYER_MODES.map((mode) => (
              <label key={mode} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.multiplayer_modes.includes(mode)}
                  onChange={() => handleArrayToggle('multiplayer_modes', mode)}
                />
                {mode.replace('_', ' ')}
              </label>
            ))}
          </div>
        </section>

        {/* Genre Tags */}
        <section className="form-section">
          <h3>Genre Tags</h3>
          <div className="checkbox-group">
            {COMMON_GENRES.map((genre) => (
              <label key={genre} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.genre_tags.includes(genre)}
                  onChange={() => handleArrayToggle('genre_tags', genre)}
                />
                {genre}
              </label>
            ))}
          </div>
          <div className="custom-tag-input">
            <input
              type="text"
              value={customGenre}
              onChange={(e) => setCustomGenre(e.target.value)}
              placeholder="Add custom genre..."
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTag('genre_tags', customGenre, setCustomGenre))}
            />
            <button type="button" onClick={() => handleAddCustomTag('genre_tags', customGenre, setCustomGenre)}>Add</button>
          </div>
          {form.genre_tags.filter(t => !COMMON_GENRES.includes(t)).length > 0 && (
            <div className="custom-tags">
              {form.genre_tags.filter(t => !COMMON_GENRES.includes(t)).map(tag => (
                <span key={tag} className="tag custom-tag">
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag('genre_tags', tag)}>×</button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Mood Tags */}
        <section className="form-section">
          <h3>Mood Tags</h3>
          <div className="checkbox-group">
            {COMMON_MOODS.map((mood) => (
              <label key={mood} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.mood_tags.includes(mood)}
                  onChange={() => handleArrayToggle('mood_tags', mood)}
                />
                {mood}
              </label>
            ))}
          </div>
          <div className="custom-tag-input">
            <input
              type="text"
              value={customMood}
              onChange={(e) => setCustomMood(e.target.value)}
              placeholder="Add custom mood..."
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTag('mood_tags', customMood, setCustomMood))}
            />
            <button type="button" onClick={() => handleAddCustomTag('mood_tags', customMood, setCustomMood)}>Add</button>
          </div>
          {form.mood_tags.filter(t => !COMMON_MOODS.includes(t)).length > 0 && (
            <div className="custom-tags">
              {form.mood_tags.filter(t => !COMMON_MOODS.includes(t)).map(tag => (
                <span key={tag} className="tag custom-tag">
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag('mood_tags', tag)}>×</button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Time Compatibility */}
        <section className="form-section">
          <h3>Time Compatibility (minutes)</h3>
          <div className="checkbox-group">
            {TIME_TAGS.map((time) => (
              <label key={time} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.time_tags.includes(time)}
                  onChange={() => handleArrayToggle('time_tags', time)}
                />
                {time === 120 ? '120+' : time} min
              </label>
            ))}
          </div>
        </section>

        {/* Recommendation Attributes */}
        <section className="form-section">
          <h3>Recommendation Attributes</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Energy Level</label>
              <select
                value={form.energy_level}
                onChange={(e) => handleChange('energy_level', e.target.value)}
              >
                {ENERGY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Time-to-Fun</label>
              <select
                value={form.time_to_fun}
                onChange={(e) => handleChange('time_to_fun', e.target.value)}
              >
                {TIME_TO_FUN.map((ttf) => (
                  <option key={ttf} value={ttf}>
                    {ttf}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Stop-Friendliness</label>
              <select
                value={form.stop_friendliness}
                onChange={(e) => handleChange('stop_friendliness', e.target.value)}
              >
                {STOP_FRIENDLINESS.map((sf) => (
                  <option key={sf} value={sf}>
                    {sf}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Subscription Services */}
        <section className="form-section">
          <h3>Subscription Services</h3>
          <div className="checkbox-group">
            {SUBSCRIPTION_SERVICES.map((service) => (
              <label key={service} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.subscription_services?.includes(service)}
                  onChange={() => handleArrayToggle('subscription_services', service)}
                />
                {service.replace(/_/g, ' ')}
              </label>
            ))}
          </div>
        </section>

        {/* Content Warnings */}
        <section className="form-section">
          <h3>Content Warnings</h3>
          <div className="checkbox-group">
            {CONTENT_WARNINGS.map((warning) => (
              <label key={warning} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.content_warnings?.includes(warning)}
                  onChange={() => handleArrayToggle('content_warnings', warning)}
                />
                {warning.replace(/_/g, ' ')}
              </label>
            ))}
          </div>
        </section>

        {/* Store Links */}
        <section className="form-section">
          <h3>Store Links</h3>
          <div className="store-links-grid">
            <div className="form-group">
              <label>Steam</label>
              <input
                type="url"
                value={form.store_links?.steam || ''}
                onChange={(e) => handleStoreLinkChange('steam', e.target.value)}
                placeholder="https://store.steampowered.com/app/..."
              />
            </div>
            <div className="form-group">
              <label>Xbox</label>
              <input
                type="url"
                value={form.store_links?.xbox || ''}
                onChange={(e) => handleStoreLinkChange('xbox', e.target.value)}
                placeholder="https://www.xbox.com/..."
              />
            </div>
            <div className="form-group">
              <label>PlayStation</label>
              <input
                type="url"
                value={form.store_links?.playstation || ''}
                onChange={(e) => handleStoreLinkChange('playstation', e.target.value)}
                placeholder="https://store.playstation.com/..."
              />
            </div>
            <div className="form-group">
              <label>Nintendo</label>
              <input
                type="url"
                value={form.store_links?.nintendo || ''}
                onChange={(e) => handleStoreLinkChange('nintendo', e.target.value)}
                placeholder="https://www.nintendo.com/store/..."
              />
            </div>
            <div className="form-group">
              <label>Epic Games</label>
              <input
                type="url"
                value={form.store_links?.epic || ''}
                onChange={(e) => handleStoreLinkChange('epic', e.target.value)}
                placeholder="https://store.epicgames.com/..."
              />
            </div>
            <div className="form-group">
              <label>GOG</label>
              <input
                type="url"
                value={form.store_links?.gog || ''}
                onChange={(e) => handleStoreLinkChange('gog', e.target.value)}
                placeholder="https://www.gog.com/game/..."
              />
            </div>
          </div>
        </section>

        {/* Explanation Templates */}
        <section className="form-section">
          <h3>Explanation Templates</h3>
          <p className="help-text">
            These templates are used to generate the "Why this fits" explanation.
            Use {'{time}'} as a placeholder for the user's time selection.
          </p>

          <div className="form-group">
            <label>Time Fit</label>
            <input
              type="text"
              value={form.explanation_templates.time_fit}
              onChange={(e) => handleTemplateChange('time_fit', e.target.value)}
              placeholder="Quick runs fit perfectly in {time}-minute windows"
            />
          </div>

          <div className="form-group">
            <label>Mood Fit</label>
            <input
              type="text"
              value={form.explanation_templates.mood_fit}
              onChange={(e) => handleTemplateChange('mood_fit', e.target.value)}
              placeholder="Low-stakes gameplay for winding down"
            />
          </div>

          <div className="form-group">
            <label>Stop Fit</label>
            <input
              type="text"
              value={form.explanation_templates.stop_fit}
              onChange={(e) => handleTemplateChange('stop_fit', e.target.value)}
              placeholder="Quit anytime—progress auto-saves"
            />
          </div>
        </section>

        {/* Actions */}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/games')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Update Game' : 'Create Game'}
          </button>
        </div>
      </form>
    </Layout>
  );
};

export default GameEditor;
