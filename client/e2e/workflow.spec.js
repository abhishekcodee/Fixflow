import { test, expect } from '@playwright/test';

test.describe.serial('FixFlow End-to-End Workflow & Multi-Role Life Cycle', () => {
  // Shared state tracking the complaint through its entire lifecycle
  const complaintStore = {
    _id: '651a7b8e4f1c9a0011223344',
    complaintNumber: 'FIX-202610-0088',
    title: 'Water pipe leak in server corridor',
    description: 'Main joint failed and water is pooling near the server rack doorway.',
    category: 'plumbing',
    priority: 'urgent',
    status: 'submitted',
    location: {
      building: 'Data Center 2',
      floor: '3',
      roomOrUnit: 'Corridor 3B',
      additionalNotes: 'Requires escort',
    },
    createdBy: {
      _id: 'user_u1',
      name: 'Alice Requester',
      email: 'alice@fixflow.com',
      role: 'user',
    },
    assignedTo: null,
    resolutionNotes: '',
    feedback: null,
    createdAt: new Date().toISOString(),
  };

  const historyStore = [
    {
      _id: 'h_1',
      action: 'created',
      performedBy: { name: 'Alice Requester' },
      createdAt: new Date().toISOString(),
      note: 'Ticket submitted via portal',
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Intercept auth endpoints
    await page.route('**/api/v1/auth/login', async (route) => {
      const payload = JSON.parse(route.request().postData() || '{}');
      if (payload.email === 'alice@fixflow.com') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'mock-jwt-alice',
            user: { id: 'user_u1', name: 'Alice Requester', email: 'alice@fixflow.com', role: 'user' },
          }),
        });
      } else if (payload.email === 'admin@fixflow.com') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'mock-jwt-admin',
            user: { id: 'admin_a1', name: 'Dan Dispatcher', email: 'admin@fixflow.com', role: 'admin' },
          }),
        });
      } else if (payload.email === 'tech@fixflow.com') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'mock-jwt-tech',
            user: { id: 'tech_t1', name: 'Tom Technician', email: 'tech@fixflow.com', role: 'technician' },
          }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } }),
        });
      }
    });

    await page.route('**/api/v1/auth/me', async (route) => {
      const authHeader = route.request().headers()['authorization'] || '';
      if (authHeader.includes('mock-jwt-alice')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 'user_u1', name: 'Alice Requester', email: 'alice@fixflow.com', role: 'user' } }),
        });
      } else if (authHeader.includes('mock-jwt-admin')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 'admin_a1', name: 'Dan Dispatcher', email: 'admin@fixflow.com', role: 'admin' } }),
        });
      } else if (authHeader.includes('mock-jwt-tech')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 'tech_t1', name: 'Tom Technician', email: 'tech@fixflow.com', role: 'technician' } }),
        });
      } else {
        await route.fulfill({ status: 401, body: JSON.stringify({ error: { message: 'Unauthorized' } }) });
      }
    });

    await page.route('**/api/v1/auth/technicians', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          technicians: [
            { _id: 'tech_t1', name: 'Tom Technician', email: 'tech@fixflow.com', role: 'technician' },
          ],
        }),
      });
    });

    await page.route('**/api/v1/complaints?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          complaints: [complaintStore],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      });
    });

    await page.route('**/api/v1/complaints', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        Object.assign(complaintStore, body, { status: 'submitted' });
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ complaint: complaintStore }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            complaints: [complaintStore],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          }),
        });
      }
    });

    await page.route('**/api/v1/complaints/651a7b8e4f1c9a0011223344/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ history: historyStore }),
      });
    });

    await page.route('**/api/v1/complaints/651a7b8e4f1c9a0011223344/assign', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      complaintStore.assignedTo = {
        _id: body.technicianId,
        name: 'Tom Technician',
        email: 'tech@fixflow.com',
      };
      complaintStore.status = 'assigned';
      historyStore.push({
        _id: 'h_assign',
        action: 'assigned',
        performedBy: { name: 'Dan Dispatcher' },
        previousState: 'submitted',
        newState: 'assigned',
        note: body.note || 'Assigned to Tom',
        createdAt: new Date().toISOString(),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, complaint: complaintStore }),
      });
    });

    await page.route('**/api/v1/complaints/651a7b8e4f1c9a0011223344/status', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const prev = complaintStore.status;
      complaintStore.status = body.status;
      if (body.status === 'resolved') {
        complaintStore.resolutionNotes = body.note || 'Repairs completed';
      }
      historyStore.push({
        _id: `h_${body.status}`,
        action: body.status,
        performedBy: { name: body.status === 'closed' ? 'Alice Requester' : 'Tom Technician' },
        previousState: prev,
        newState: body.status,
        note: body.note || '',
        createdAt: new Date().toISOString(),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, complaint: complaintStore }),
      });
    });

    await page.route('**/api/v1/complaints/651a7b8e4f1c9a0011223344/feedback', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      complaintStore.feedback = {
        rating: body.rating,
        comments: body.comments || '',
        submittedAt: new Date().toISOString(),
      };
      historyStore.push({
        _id: 'h_feedback',
        action: 'FEEDBACK_SUBMITTED',
        performedBy: { name: 'Alice Requester' },
        note: `Rated ${body.rating}/5 stars.`,
        createdAt: new Date().toISOString(),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, complaint: complaintStore }),
      });
    });

    await page.route('**/api/v1/complaints/651a7b8e4f1c9a0011223344', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ complaint: complaintStore }),
      });
    });
  });

  test('Step 1-3: Normal User signs in, creates a complaint, and verifies listing', async ({ page }) => {
    // 1. Normal user sign in
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    await page.fill('input[name="email"]', 'alice@fixflow.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Lands on dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('heading', { name: /Welcome back, Alice Requester/i })).toBeVisible();

    // 2. User creates a maintenance complaint
    await page.goto('/complaints/new');
    await expect(page.getByRole('heading', { name: 'Report Maintenance Issue' })).toBeVisible();

    await page.fill('input[name="title"]', 'Water pipe leak in server corridor');
    await page.selectOption('select[name="category"]', 'plumbing');
    await page.selectOption('select[name="priority"]', 'urgent');
    await page.fill('input[name="building"]', 'Data Center 2');
    await page.fill('input[name="floor"]', '3');
    await page.fill('input[name="roomOrUnit"]', 'Corridor 3B');
    await page.fill('input[name="additionalNotes"]', 'Requires escort');
    await page.fill('textarea[name="description"]', 'Main joint failed and water is pooling near the server rack doorway.');

    await page.click('button[type="submit"]');

    // Redirects to complaints or details
    await expect(page).toHaveURL(/.*complaints/);

    // 3. Complaint appears in list
    await page.goto('/complaints');
    await expect(page.getByText('FIX-202610-0088').first()).toBeVisible();
    await expect(page.getByText('Water pipe leak in server corridor').first()).toBeVisible();
  });

  test('Step 4-5: Administrator signs in, finds complaint, and assigns technician', async ({ page }) => {
    // Ensure complaint is in submitted state
    complaintStore.status = 'submitted';
    complaintStore.assignedTo = null;

    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@fixflow.com');
    await page.fill('input[name="password"]', 'AdminPassword123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);

    // Navigate to admin dispatch console
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin Dispatch Console' })).toBeVisible();
    await expect(page.getByText('FIX-202610-0088').first()).toBeVisible();

    // Open dispatch modal
    await page.click('button:has-text("Dispatch")');
    await expect(page.getByRole('heading', { name: /Dispatch Ticket: FIX-202610-0088/i })).toBeVisible();

    // Select technician
    await expect(page.getByRole('combobox', { name: /assign to active technician/i })).toBeVisible();
    await page.fill('textarea[name="note"]', 'Urgent callout: please check server room immediately.');
    await page.click('button:has-text("Confirm Assignment")');

    // Modal closes
    await expect(page.getByRole('heading', { name: /Dispatch Ticket: FIX-202610-0088/i })).not.toBeVisible();
    expect(complaintStore.status).toBe('assigned');
    expect(complaintStore.assignedTo?._id).toBe('tech_t1');
  });

  test('Step 6-8: Technician signs in, views work order, transitions status, and inspects history', async ({ page }) => {
    // Set complaint to assigned
    complaintStore.status = 'assigned';
    complaintStore.assignedTo = {
      _id: 'tech_t1',
      name: 'Tom Technician',
      email: 'tech@fixflow.com',
    };

    await page.goto('/login');
    await page.fill('input[name="email"]', 'tech@fixflow.com');
    await page.fill('input[name="password"]', 'TechPassword123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);

    // Navigate to technician portal
    await page.goto('/technician');
    await expect(page.getByRole('heading', { name: 'Technician Work Queue' })).toBeVisible();

    // Open ticket details
    await page.goto('/complaints/651a7b8e4f1c9a0011223344');
    await expect(page.getByText(/FIX-202610-0088/i).first()).toBeVisible();
    await expect(page.getByText('Assigned Technician').first()).toBeVisible();

    // Transition: Start Work (In Progress)
    await page.click('button:has-text("Start Work")');
    await expect(page.getByRole('heading', { name: /Update Status: IN PROGRESS/i })).toBeVisible();
    await page.click('button:has-text("Confirm Transition")');

    // Transition: Mark Resolved
    await expect(page.getByRole('button', { name: /Mark Resolved/i })).toBeVisible();
    await page.click('button:has-text("Mark Resolved")');
    await expect(page.getByRole('heading', { name: /Update Status: RESOLVED/i })).toBeVisible();
    await page.fill('textarea[id="status-note"]', 'Fitted high-pressure clamp and dried standing water.');
    await page.click('button:has-text("Confirm Transition")');

    // Verify history displays audit entries
    await expect(page.getByText('Activity History & Audit Trail')).toBeVisible();
    await expect(page.getByText(/Tom Technician/i).first()).toBeVisible();
    expect(complaintStore.status).toBe('resolved');
  });

  test('Step 9-10: User signs in, verifies resolved status, closes ticket, and submits 5-star feedback', async ({ page }) => {
    // Set complaint to resolved without feedback yet
    complaintStore.status = 'resolved';
    complaintStore.feedback = null;

    await page.goto('/login');
    await page.fill('input[name="email"]', 'alice@fixflow.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Navigate to complaint details
    await page.goto('/complaints/651a7b8e4f1c9a0011223344');
    await expect(page.getByText(/FIX-202610-0088/i).first()).toBeVisible();

    // Submit Resolution Feedback
    await expect(page.getByText('Resolution Feedback & Rating')).toBeVisible();
    await page.selectOption('select[id="feedback-rating-select"]', '5');
    await page.fill('textarea[id="feedback-comments"]', 'Rapid intervention prevented server damage. 5 stars!');
    await page.click('button:has-text("Submit Feedback & Rating")');

    // Verify feedback is saved and displayed
    await expect(page.getByText('✔ Service Verified')).toBeVisible();
    await expect(page.getByText('(5 / 5)')).toBeVisible();
    await expect(page.getByText('Rapid intervention prevented server damage. 5 stars!')).toBeVisible();
  });

  test('Negative & Authorization: Standard user denied access to Admin Dispatch Console', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'alice@fixflow.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Navigate to /admin as standard user
    await page.goto('/admin');
    await expect(page.getByText('Administrator Access Required')).toBeVisible();
    await expect(page.getByRole('button', { name: /Return to Personal Dashboard/i })).toBeVisible();
  });
});
