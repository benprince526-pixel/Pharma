import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import companyLogo from '../services/logo.png';
import '../styles/LoginPage.css';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Try to login with backend API
      const response = await authService.login(username, password);
      
      if (response.data && response.data.jwtToken) {
        onLogin(response.data.jwtToken);
        navigate('/dashboard');
      } else {
        setError('Réponse invalide du serveur');
      }
    } catch (err) {
      setError('username ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>
      
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-wrapper">
            <img src={companyLogo} alt="Sonatrach Logo" className="login-company-logo" />
          </div>
          <h1>🏥 Pharma Inventory</h1>
          <p>Sonatrach Gassi Touil</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Entrez votre username"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Entrez votre mot de passe"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
