import { useState, useEffect } from 'react';
import { identityApi } from '../../services/api';
import { Button } from './Button';
import { Input } from './Input';
import { StatusBadge } from './StatusBadge';
import { ErrorState } from './ErrorState';
import './AadhaarVerificationCard.css';

export function AadhaarVerificationCard({ onStatusChange, initialStatus }) {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Step 1: Form state
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [consent, setConsent] = useState(false);
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [submittingInitiate, setSubmittingInitiate] = useState(false);

  // Step 2: OTP state
  const [otp, setOtp] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Image upload state
  const [uploadingDocs, setUploadingDocs] = useState(false);

  // Document modal preview
  const [viewingDocSide, setViewingDocSide] = useState(null);
  const [docBlobUrl, setDocBlobUrl] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  async function loadStatus() {
    setLoading(true);
    setError('');
    try {
      const res = await identityApi.getStatus();
      setStatusData(res?.data || null);
      if (onStatusChange && res?.data?.status) {
        onStatusChange(res.data.status);
      }
    } catch (err) {
      setError(err.message || 'Unable to retrieve identity verification status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Handle image selections with previews
  function handleFrontFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Front image exceeds 5MB limit.');
        return;
      }
      setFrontFile(file);
      setFrontPreview(URL.createObjectURL(file));
      setError('');
    }
  }

  function handleBackFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Back image exceeds 5MB limit.');
        return;
      }
      setBackFile(file);
      setBackPreview(URL.createObjectURL(file));
      setError('');
    }
  }

  // Format Aadhaar display
  function getMaskedDisplay(val) {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 4) return digits;
    if (digits.length <= 8) return `XXXX-${digits.slice(4)}`;
    return `XXXX-XXXX-${digits.slice(-4)}`;
  }

  // Step 1: Submit Details & Images
  async function handleInitiate(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const clean = aadhaarInput.replace(/[\s-]/g, '');
    if (!/^[2-9]\d{11}$/.test(clean)) {
      setError('Please enter a valid 12-digit Indian Aadhaar number (cannot start with 0 or 1).');
      return;
    }

    if (!consent) {
      setError('Consent is required to proceed with identity verification.');
      return;
    }

    setSubmittingInitiate(true);
    try {
      const res = await identityApi.initiate({
        aadhaarNumber: clean,
        consent: true
      });

      setSuccessMsg(res?.data?.message || 'Aadhaar information submitted successfully.');
      setCooldown(60);

      // If user provided front and back files, upload them immediately
      if (frontFile && backFile) {
        setUploadingDocs(true);
        const formData = new FormData();
        formData.append('frontImage', frontFile);
        formData.append('backImage', backFile);
        await identityApi.uploadDocuments(formData);
      }

      await loadStatus();
    } catch (err) {
      setError(err.message || 'Failed to initiate identity verification.');
    } finally {
      setSubmittingInitiate(false);
      setUploadingDocs(false);
    }
  }

  // Step 2: Verify OTP
  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!otp.trim()) {
      setError('Please enter the verification code.');
      return;
    }

    setSubmittingOtp(true);
    try {
      const res = await identityApi.verifyOtp({ otp: otp.trim() });
      setSuccessMsg(res?.data?.message || 'OTP verified successfully.');
      setOtp('');
      await loadStatus();
    } catch (err) {
      setError(err.message || 'Failed to verify OTP.');
    } finally {
      setSubmittingOtp(false);
    }
  }

  // Upload documents separately if needed
  async function handleUploadDocsOnly(e) {
    e.preventDefault();
    if (!frontFile || !backFile) {
      setError('Please select both front and back card images.');
      return;
    }

    setUploadingDocs(true);
    setError('');
    setSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('frontImage', frontFile);
      formData.append('backImage', backFile);
      await identityApi.uploadDocuments(formData);
      setSuccessMsg('Aadhaar documents uploaded and encrypted in vault.');
      await loadStatus();
    } catch (err) {
      setError(err.message || 'Document upload failed.');
    } finally {
      setUploadingDocs(false);
    }
  }

  // View own uploaded document
  async function handleViewDocument(side) {
    setViewingDocSide(side);
    setLoadingDoc(true);
    setDocBlobUrl(null);
    try {
      const blob = await identityApi.getDocumentBlob(side);
      const url = URL.createObjectURL(blob);
      setDocBlobUrl(url);
    } catch (err) {
      setError('Unable to load document image preview.');
    } finally {
      setLoadingDoc(false);
    }
  }

  const currentStatus = statusData?.status || 'NOT_STARTED';

  return (
    <div className="aadhaar-verification-card">
      <div className="aadhaar-header">
        <div className="aadhaar-header-left">
          <div className="aadhaar-shield-badge">🛡️</div>
          <div>
            <h3 className="aadhaar-title">Aadhaar Identity Verification</h3>
            <p className="aadhaar-subtitle">
              Government UIDAI-compliant verification for enhanced campus trust and priority work orders.
            </p>
          </div>
        </div>
        <div className="aadhaar-header-right">
          <StatusBadge status={currentStatus.toLowerCase()} />
        </div>
      </div>

      {error && (
        <div className="aadhaar-alert">
          <ErrorState title="Verification Notice" message={error} />
        </div>
      )}

      {successMsg && (
        <div className="aadhaar-success-banner">
          ✓ {successMsg}
        </div>
      )}

      {/* Case 1: VERIFIED */}
      {currentStatus === 'VERIFIED' && (
        <div className="aadhaar-verified-box">
          <div className="verified-icon">✅</div>
          <div className="verified-text">
            <strong>Identity Fully Verified</strong>
            <p>Your Aadhaar identity ({statusData?.maskedNumber}) has been verified. You possess authenticated credential clearance across the campus facility.</p>
            {statusData?.verifiedAt && (
              <span className="text-xs text-muted">
                Verified on {new Date(statusData.verifiedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Case 2: PENDING REVIEW or DOCUMENTS UPLOADED */}
      {['PENDING', 'PENDING_REVIEW', 'DOCUMENTS_UPLOADED'].includes(currentStatus) && (
        <div className="aadhaar-pending-box">
          <div className="pending-icon">⏳</div>
          <div className="pending-text">
            <strong>Verification Under Review</strong>
            <p>
              Your Aadhaar ({statusData?.maskedNumber}) and encrypted documents have been registered. Facilities management is reviewing your credential documents.
            </p>
            {statusData?.hasFrontDocument && statusData?.hasBackDocument && (
              <div className="aadhaar-docs-preview-row">
                <Button variant="secondary" size="sm" onClick={() => handleViewDocument('front')}>
                  View Uploaded Front Card
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleViewDocument('back')}>
                  View Uploaded Back Card
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Case 3: OTP_SENT - User enters OTP */}
      {currentStatus === 'OTP_SENT' && (
        <form onSubmit={handleVerifyOtp} className="aadhaar-otp-form">
          <div className="aadhaar-otp-notice">
            📱 <strong>Enter Mobile OTP:</strong> A verification code has been dispatched to the mobile number registered with your Aadhaar ({statusData?.maskedNumber}).
          </div>

          <div className="form-row">
            <Input
              id="aadhaar-otp"
              label="6-Digit Aadhaar OTP"
              placeholder="e.g. 123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              helperText="Valid for 5 minutes. Never share this code."
              required
            />
          </div>

          <div className="aadhaar-form-actions">
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={cooldown > 0}
              onClick={handleInitiate}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={submittingOtp}
              loadingText="Verifying with UIDAI..."
            >
              Verify OTP
            </Button>
          </div>
        </form>
      )}

      {/* Case 4: NOT_STARTED, REJECTED, or Needs Document Upload */}
      {['NOT_STARTED', 'REJECTED', 'OTP_VERIFIED'].includes(currentStatus) && (
        <form onSubmit={currentStatus === 'OTP_VERIFIED' ? handleUploadDocsOnly : handleInitiate} className="aadhaar-main-form">
          {currentStatus === 'REJECTED' && statusData?.rejectionReason && (
            <div className="rejection-notice">
              ⚠️ <strong>Previous verification was rejected:</strong> {statusData.rejectionReason}. Please re-submit valid credentials.
            </div>
          )}

          {currentStatus !== 'OTP_VERIFIED' && (
            <div className="form-section">
              <Input
                id="aadhaar-number"
                label="12-Digit Aadhaar Number"
                placeholder="XXXX-XXXX-XXXX"
                value={aadhaarInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setAadhaarInput(raw);
                }}
                helperText={`Preview masked: ${getMaskedDisplay(aadhaarInput)} (Format: 12 numerical digits, no letters)`}
                required
              />
            </div>
          )}

          <div className="aadhaar-uploads-section">
            <label className="upload-section-title">Upload Aadhaar Card Images (Front & Back)</label>
            <p className="upload-section-hint">
              JPEG, PNG, or WebP up to 5MB each. Stored in encrypted private storage; never made public.
            </p>

            <div className="aadhaar-uploads-grid">
              {/* Front Image Box */}
              <div className="upload-box">
                <span className="upload-label">Front Side (with photo & number)</span>
                {frontPreview ? (
                  <div className="upload-preview-container">
                    <img src={frontPreview} alt="Aadhaar Front Preview" className="upload-preview-img" />
                    <button
                      type="button"
                      className="btn-replace"
                      onClick={() => {
                        setFrontFile(null);
                        setFrontPreview(null);
                      }}
                    >
                      ✕ Replace Front Image
                    </button>
                  </div>
                ) : (
                  <label className="upload-dropzone">
                    <span className="upload-icon">📷</span>
                    <span className="upload-dropzone-text">Choose Front Image</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFrontFileChange}
                      className="hidden-file-input"
                    />
                  </label>
                )}
              </div>

              {/* Back Image Box */}
              <div className="upload-box">
                <span className="upload-label">Back Side (with address & QR code)</span>
                {backPreview ? (
                  <div className="upload-preview-container">
                    <img src={backPreview} alt="Aadhaar Back Preview" className="upload-preview-img" />
                    <button
                      type="button"
                      className="btn-replace"
                      onClick={() => {
                        setBackFile(null);
                        setBackPreview(null);
                      }}
                    >
                      ✕ Replace Back Image
                    </button>
                  </div>
                ) : (
                  <label className="upload-dropzone">
                    <span className="upload-icon">📷</span>
                    <span className="upload-dropzone-text">Choose Back Image</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleBackFileChange}
                      className="hidden-file-input"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="aadhaar-consent-row">
            <label className="consent-checkbox-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="consent-checkbox"
                required
              />
              <span className="consent-text">
                I hereby voluntarily consent to submit my Aadhaar information and document copies to FixFlow for facilities identity verification and maintenance authorized access. I understand documents are encrypted at rest and never shared with third parties.
              </span>
            </label>
          </div>

          <div className="aadhaar-form-actions">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={submittingInitiate || uploadingDocs}
              loadingText="Encrypting & Submitting..."
            >
              {currentStatus === 'OTP_VERIFIED' ? 'Submit Documents for Final Review' : 'Proceed with Verification'}
            </Button>
          </div>
        </form>
      )}

      {/* Document View Modal */}
      {viewingDocSide && (
        <div className="doc-modal-overlay" onClick={() => setViewingDocSide(null)}>
          <div className="doc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="doc-modal-header">
              <h4>Aadhaar {viewingDocSide.toUpperCase()} Card View</h4>
              <button type="button" className="doc-modal-close" onClick={() => setViewingDocSide(null)}>✕</button>
            </div>
            <div className="doc-modal-body">
              {loadingDoc ? (
                <p className="text-center py-6 text-muted">Decrypting document from secure vault...</p>
              ) : docBlobUrl ? (
                <img src={docBlobUrl} alt="Aadhaar Document" className="doc-modal-img" />
              ) : (
                <p className="text-danger py-4">Failed to load document.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AadhaarVerificationCard;
