import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import './NotFound.css';

export function NotFound() {
  return (
    <div className="not-found-container">
      <Card className="not-found-card">
        <div className="not-found-code">404</div>
        <h1 className="not-found-title">Page Not Found</h1>
        <p className="not-found-desc">
          The maintenance record, dashboard, or endpoint you requested does not exist or has been relocated.
        </p>

        <div className="not-found-actions">
          <Link to="/dashboard">
            <Button variant="primary" size="md">
              Return to Dashboard
            </Button>
          </Link>
          <Link to="/complaints">
            <Button variant="secondary" size="md">
              View Complaints
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
