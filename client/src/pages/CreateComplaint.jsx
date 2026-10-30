import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { complaintsApi, techniciansApi } from '../services/api';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Textarea } from '../components/common/Textarea';
import { StatusBadge } from '../components/common/StatusBadge';
import { ErrorState } from '../components/common/ErrorState';
import { LocationPickerMap } from '../components/common/LocationPickerMap';
import './CreateComplaint.css';

export function CreateComplaint() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    category: 'electrical',
    priority: 'medium',
    building: '',
    floor: '',
    roomOrUnit: '',
    additionalNotes: '',
    latitude: null,
    longitude: null,
    address: '',
    description: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Smart dispatch / matching technician state
  const [matchingTechs, setMatchingTechs] = useState([]);
  const [loadingMatching, setLoadingMatching] = useState(false);
  const [matchingInfo, setMatchingInfo] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    async function fetchMatching() {
      if (!formData.category) return;
      setLoadingMatching(true);
      try {
        const res = await techniciansApi.getMatching({
          category: formData.category,
          latitude: formData.latitude,
          longitude: formData.longitude,
          limit: 3,
        });
        if (!isCancelled) {
          setMatchingTechs(res.technicians || []);
          setMatchingInfo({
            requiredSpecialization: res.requiredSpecialization,
          });
        }
      } catch {
        if (!isCancelled) {
          setMatchingTechs([]);
        }
      } finally {
        if (!isCancelled) {
          setLoadingMatching(false);
        }
      }
    }
    fetchMatching();
    return () => {
      isCancelled = true;
    };
  }, [formData.category, formData.latitude, formData.longitude]);

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate() {
    const errors = {};

    if (!formData.title.trim()) {
      errors.title = 'Complaint title is required.';
    } else if (formData.title.trim().length < 5 || formData.title.trim().length > 120) {
      errors.title = 'Title must be between 5 and 120 characters.';
    }

    if (!formData.category) {
      errors.category = 'Please select a complaint category.';
    }

    if (!formData.building.trim()) {
      errors.building = 'Building or facility name is required.';
    }

    if (!formData.floor.trim()) {
      errors.floor = 'Floor number or level is required.';
    }

    if (!formData.roomOrUnit.trim()) {
      errors.roomOrUnit = 'Room or unit designation is required.';
    }

    if (!formData.description.trim()) {
      errors.description = 'Detailed description is required.';
    } else if (formData.description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters long.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        category: formData.category,
        priority: formData.priority,
        location: {
          building: formData.building.trim(),
          floor: formData.floor.trim(),
          roomOrUnit: formData.roomOrUnit.trim(),
          additionalNotes: formData.additionalNotes.trim() || undefined,
          ...(formData.latitude !== null && formData.latitude !== undefined && {
            latitude: formData.latitude,
            longitude: formData.longitude,
          }),
          ...(formData.address ? { address: formData.address } : {}),
        },
        description: formData.description.trim(),
      };

      const result = await complaintsApi.create(payload);
      const newId = result?.complaint?._id;
      if (newId) {
        navigate(`/complaints/${newId}`);
      } else {
        navigate('/complaints');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to submit complaint. Please check your inputs and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="create-complaint-page">
      <PageHeader
        breadcrumbs={<Link to="/complaints">← Back to Complaints</Link>}
        title="Report Maintenance Issue"
        description="Provide accurate location and details to assist our facilities dispatch and technician teams."
      />

      <Card className="form-card">
        {formError && (
          <div className="form-card__alert">
            <ErrorState title="Submission Failed" message={formError} />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <h3 className="form-section__title">1. General Information</h3>
            <Input
              id="complaint-title"
              name="title"
              label="Incident Title"
              placeholder="e.g. Water leak under main kitchenette sink"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              error={fieldErrors.title}
              helperText="Brief summary of the issue (5–120 characters)."
              required
            />

            <div className="form-row">
              <Select
                id="complaint-category"
                name="category"
                label="Category"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                error={fieldErrors.category}
                options={[
                  { value: 'electrical', label: 'Electrical & Lighting' },
                  { value: 'plumbing', label: 'Plumbing & Drainage' },
                  { value: 'hvac', label: 'HVAC & Climate Control' },
                  { value: 'carpentry', label: 'Carpentry & Doors/Windows' },
                  { value: 'appliance', label: 'Appliances & Equipment' },
                  { value: 'safety_security', label: 'Safety & Security' },
                  { value: 'cleaning', label: 'Janitorial & Cleaning' },
                  { value: 'other', label: 'Other General Maintenance' },
                ]}
                required
              />

              <Select
                id="complaint-priority"
                name="priority"
                label="Requested Priority"
                value={formData.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                options={[
                  { value: 'low', label: 'Low (Routine observation)' },
                  { value: 'medium', label: 'Medium (Standard repair)' },
                  { value: 'high', label: 'High (Needs prompt attention)' },
                  { value: 'urgent', label: 'Urgent (Safety hazard or flooding)' },
                ]}
                helperText="Administrators verify and may calibrate priority upon dispatch."
                required
              />
            </div>

            {/* Smart Dispatch Preview Box */}
            <div className="matching-preview-box">
              <div className="matching-preview-header">
                <span className="matching-preview-title">
                  ⚡ Smart Dispatch Matching:
                </span>
                <span className="matching-preview-spec">
                  {matchingInfo?.requiredSpecialization
                    ? `Mapped to ${matchingInfo.requiredSpecialization.toUpperCase()}`
                    : 'Mapping to category specialty...'}
                </span>
              </div>
              {loadingMatching ? (
                <p className="matching-preview-empty">Searching verified specialists online...</p>
              ) : matchingTechs.length > 0 ? (
                <div className="matching-tech-list">
                  {matchingTechs.map((tech) => (
                    <div key={tech.id} className="matching-tech-card">
                      <div className="matching-tech-avatar">
                        {tech.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="matching-tech-info">
                        <div className="matching-tech-name-row">
                          <strong>{tech.name}</strong>
                          <StatusBadge status={tech.isAvailable ? 'available' : 'unavailable'} size="sm" />
                          <StatusBadge status={tech.approvalStatus} size="sm" />
                        </div>
                        <div className="matching-tech-meta">
                          <span>🎯 {tech.primarySpecialization}</span>
                          {tech.experienceYears !== null && tech.experienceYears !== undefined && (
                            <span>⭐ {tech.experienceYears}y exp</span>
                          )}
                          <span>📋 {tech.activeWorkload} active jobs</span>
                          {tech.distanceKm !== undefined && (
                            <span>📍 {tech.distanceKm} km away</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="matching-preview-empty warning">
                  ⚠️ No approved {matchingInfo?.requiredSpecialization || 'specialist'} is currently online. Your ticket will be dispatched immediately to our on-call facilities queue.
                </p>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section__title">2. Physical Location</h3>
            <div className="form-row three-col">
              <Input
                id="location-building"
                name="building"
                label="Building / Block"
                placeholder="e.g. Tower B"
                value={formData.building}
                onChange={(e) => handleChange('building', e.target.value)}
                error={fieldErrors.building}
                required
              />

              <Input
                id="location-floor"
                name="floor"
                label="Floor / Level"
                placeholder="e.g. 4th Floor"
                value={formData.floor}
                onChange={(e) => handleChange('floor', e.target.value)}
                error={fieldErrors.floor}
                required
              />

              <Input
                id="location-room"
                name="roomOrUnit"
                label="Room / Unit"
                placeholder="e.g. Suite 402"
                value={formData.roomOrUnit}
                onChange={(e) => handleChange('roomOrUnit', e.target.value)}
                error={fieldErrors.roomOrUnit}
                required
              />
            </div>

            <Input
              id="location-notes"
              name="additionalNotes"
              label="Location or Access Instructions (Optional)"
              placeholder="e.g. Keycard required, ask at reception for corridor key"
              value={formData.additionalNotes}
              onChange={(e) => handleChange('additionalNotes', e.target.value)}
            />

            <LocationPickerMap
              latitude={formData.latitude}
              longitude={formData.longitude}
              onChange={(geo) => {
                setFormData((prev) => ({
                  ...prev,
                  latitude: geo.latitude,
                  longitude: geo.longitude,
                  address: geo.address || prev.address,
                }));
              }}
            />
          </div>

          <div className="form-section">
            <h3 className="form-section__title">3. Detailed Description</h3>
            <Textarea
              id="complaint-description"
              name="description"
              label="Problem Details"
              placeholder="Describe symptoms, when it started, and any observed hazards..."
              rows={5}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              error={fieldErrors.description}
              helperText={`${formData.description.length}/2000 characters (minimum 10 required)`}
              required
            />
          </div>

          <div className="form-actions">
            <Link to="/complaints">
              <Button variant="secondary" size="md">
                Cancel
              </Button>
            </Link>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              loadingText="Submitting Complaint..."
            >
              Submit Maintenance Report
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
