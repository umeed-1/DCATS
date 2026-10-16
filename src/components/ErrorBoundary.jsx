import React from 'react';
import Icon from './Icon';

/**
 * Top-level view error boundary. Catches render-time errors in any page so a
 * single bad view never white-screens the trainer — navigation stays usable
 * and archived sessions remain safe on the device.
 *
 * App.jsx keys this boundary by route pathname, so navigating to another
 * page also clears the error state.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('DCATS view error:', error, info?.componentStack);
  }

  handleRetry = () => this.setState({ error: null });

  handleHome = () => {
    window.location.hash = '#/';
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary card">
          <span className="error-boundary-icon"><Icon name="alert" size={22} /></span>
          <h2>Something went wrong in this view</h2>
          <p className="text-secondary">
            The trainer is still running, and archived sessions are safe on this device.
          </p>
          <pre className="error-boundary-detail">{String(this.state.error.message || this.state.error)}</pre>
          <div className="error-boundary-actions">
            <button className="btn btn-primary" onClick={this.handleRetry}>Try Again</button>
            <button className="btn btn-outline" onClick={this.handleHome}>Back to Mission Brief</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
