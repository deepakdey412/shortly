import { useState } from 'react';
import './App.css';

function App() {
  const [formData, setFormData] = useState({
    originalUrl: '',
    customAlias: '',
    expiresAt: '',
  });

  const [statsShortCode, setStatsShortCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleShortenUrl = async (e) => {
    e.preventDefault();

    if (!formData.originalUrl || !formData.originalUrl.match(/^https?:\/\/.+/i)) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const payload = {
        originalUrl: formData.originalUrl,
        customAlias: formData.customAlias || null,
        expiresAt: formData.expiresAt
          ? formData.expiresAt.length === 16
            ? `${formData.expiresAt}:00`
            : formData.expiresAt
          : null,
      };

      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create short URL');
      }

      const data = await response.json();
      setResult(data);
      setStatsShortCode(data.shortCode);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadStats = async (e) => {
    e.preventDefault();

    if (!statsShortCode) {
      setStatsError('Please enter a short code');
      return;
    }

    setStatsLoading(true);
    setStatsError('');
    setStats(null);

    try {
      const response = await fetch(`/api/stats/${statsShortCode}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setStatsError(err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="card hero">
        <p className="eyebrow">shortly</p>
        <h1>URL shortening with expiry, analytics and Redis backed caching</h1>
        <p className="lead">
          Create short URLs, open redirects, and inspect click analytics from one screen
        </p>
        <div className="explain">
          <p>
            <strong>Rate-limit requests:</strong> counts how many API requests one client/IP makes
            within a short time window
          </p>
          <p>
            <strong>URL clicks:</strong> counts how many times a short link is opened and redirected.
          </p>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Create short URL</h2>
          <form onSubmit={handleShortenUrl}>
            <label>
              Original URL
              <input
                type="text"
                name="originalUrl"
                value={formData.originalUrl}
                onChange={handleInputChange}
                placeholder="https://example.com/very/long/url"
                required
              />
            </label>

            <label>
              Custom alias
              <input
                type="text"
                name="customAlias"
                value={formData.customAlias}
                onChange={handleInputChange}
                placeholder="optional-code"
              />
            </label>

            <label>
              Expires at
              <input
                type="datetime-local"
                name="expiresAt"
                value={formData.expiresAt}
                onChange={handleInputChange}
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Shorten URL'}
            </button>
          </form>

          {error && <p className="error">{error}</p>}

          {result && (
            <div className="result">
              <p>
                <strong>Short URL:</strong>{' '}
                <a href={result.shortUrl} target="_blank" rel="noreferrer">
                  {result.shortUrl}
                </a>
              </p>
              <p>
                <strong>Short code:</strong> {result.shortCode}
              </p>
              <p>
                <strong>Created:</strong> {new Date(result.createdAt).toLocaleString()}
              </p>
            </div>
          )}
        </article>

        <article className="card">
          <h2>Get URL stats</h2>
          <form onSubmit={handleLoadStats}>
            <label>
              Short code
              <input
                type="text"
                value={statsShortCode}
                onChange={(e) => setStatsShortCode(e.target.value)}
                placeholder="abc123"
                required
              />
            </label>

            <button type="submit" disabled={statsLoading}>
              {statsLoading ? 'Loading...' : 'Fetch stats'}
            </button>
          </form>

          {statsError && <p className="error">{statsError}</p>}

          {stats && (
            <div className="result">
              <p>
                <strong>Original URL:</strong> {stats.originalUrl}
              </p>
              <p>
                <strong>Clicks:</strong> {stats.clickCount}
              </p>
              <p>
                <strong>Active:</strong> {stats.active ? 'Yes' : 'No'}
              </p>
              <p>
                <strong>Created by:</strong> {stats.createdBy}
              </p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

export default App;
