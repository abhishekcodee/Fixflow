USE fixflow;

INSERT INTO User (id, name, email, passwordHash, role, isActive, isVerified, createdAt, updatedAt)
VALUES 
('usr_admin_001', 'System Administrator', 'admin@fixflow.com', '$2b$10$CwR/p78p2rD2Vo7HFB1O2Ox.5jJZ8PjRGk/1xo4tlwWbWbjpGji3G', 'admin', 1, 1, NOW(3), NOW(3)),
('usr_tech_001', 'Alex Rivera (Technician)', 'technician@fixflow.com', '$2b$10$1J9s2A1s2gxN7j2mIi3DAOLXiPSDtG5.3mr8bY4StgH6Qd.Upx6aC', 'technician', 1, 1, NOW(3), NOW(3)),
('usr_resident_001', 'Jordan Smith (Resident)', 'user@fixflow.com', '$2b$10$vBvLJp7j/jiajPlfOMrrB.9sXy1FuwV.9X2/qsSNRM0k8oLaDKu8q', 'user', 1, 1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO Complaint (id, complaintNumber, title, description, category, priority, status, building, floor, room, locationDescription, latitude, longitude, address, createdById, assignedToId, assignedAt, createdAt, updatedAt)
VALUES
('cmp_sample_001', 'FIX-202610-0001', 'Water pressure drop in master bathroom', 'The hot water pressure dropped significantly since yesterday evening. No leaking noticed under sink.', 'plumbing', 'high', 'assigned', 'Building B - North Wing', '3rd Floor', 'Unit 304', 'Master bathroom shower line', 28.6139, 77.2090, 'Campus Facilities Sector 4', 'usr_resident_001', 'usr_tech_001', NOW(3), NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE title=VALUES(title);

INSERT INTO ComplaintHistory (id, complaintId, actorId, action, previousState, newState, note, timestamp)
VALUES
('his_sample_001', 'cmp_sample_001', 'usr_resident_001', 'CREATED', NULL, '{"status": "submitted", "priority": "high", "complaintNumber": "FIX-202610-0001"}', 'Complaint submitted by requester.', NOW(3)),
('his_sample_002', 'cmp_sample_001', 'usr_admin_001', 'STATUS_CHANGED', '{"status": "submitted"}', '{"status": "assigned"}', 'Assigned to Alex Rivera (Technician).', NOW(3))
ON DUPLICATE KEY UPDATE action=VALUES(action);

INSERT INTO Counter (id, seq)
VALUES ('complaint_202610', 1)
ON DUPLICATE KEY UPDATE seq=seq;
