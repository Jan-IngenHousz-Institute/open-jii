/**
 * MSW request handlers for the web application.
 *
 * These handlers intercept HTTP requests during tests and return
 * controlled responses, removing the need to mock the API client
 * at the module level.
 *
 * Add new handlers here as needed. Group them by API domain.
 */
import { http, HttpResponse } from "msw";

const API_URL = "http://localhost:3020";

// ── Experiment handlers ─────────────────────────────────────────

export const experimentHandlers = [
  // List experiments
  http.get(`${API_URL}/api/v1/experiments`, () => {
    return HttpResponse.json([]);
  }),

  // Get single experiment
  http.get(`${API_URL}/api/v1/experiments/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: "Test Experiment",
      description: "A test experiment",
      status: "active",
      visibility: "private",
      createdBy: "user-1",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-15T00:00:00.000Z",
      embargoUntil: "2025-12-31T23:59:59.999Z",
      ownerFirstName: "John",
      ownerLastName: "Doe",
    });
  }),

  // Get experiment access
  http.get(`${API_URL}/api/v1/experiments/:id/access`, ({ params }) => {
    return HttpResponse.json({
      experiment: {
        id: params.id,
        name: "Test Experiment",
        description: "A test experiment",
        status: "active",
        visibility: "private",
        createdBy: "user-1",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-15T00:00:00.000Z",
        embargoUntil: "2025-12-31T23:59:59.999Z",
      },
      hasAccess: true,
      isAdmin: false,
    });
  }),

  // List transfer requests
  http.get(`${API_URL}/api/v1/transfer-requests`, () => {
    return HttpResponse.json([]);
  }),
];

// ── Macro handlers ──────────────────────────────────────────────

export const macroHandlers = [
  http.get(`${API_URL}/api/v1/macros`, () => {
    return HttpResponse.json([]);
  }),
];

// ── Protocol handlers ───────────────────────────────────────────

export const protocolHandlers = [
  http.get(`${API_URL}/api/v1/protocols`, () => {
    return HttpResponse.json([]);
  }),
];

// ── Default handlers (all combined) ─────────────────────────────

export const handlers = [...experimentHandlers, ...macroHandlers, ...protocolHandlers];
