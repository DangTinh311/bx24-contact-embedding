// worker_src/bitrix24_api.js

// Placeholder for KV interaction during local development.
// In a real Worker, env.BITRIX24_SETTINGS would be your KV Namespace binding.
let appSettingsInMemory = {};

const BITRIX24_AUTH_URL = "https://oauth.bitrix.info/oauth/token/";
const BITRIX24_REST_ENDPOINT_SUFFIX = ".json"; // Assuming JSON for now

/**
 * Stores application settings (tokens, domain) in a persistent storage (KV Namespace).
 * @param {object} env - The environment object containing KV Namespace binding.
 * @param {object} settings - The settings object to store.
 */
async function setAppSettings(env, settings) {
  if (env.BITRIX24_SETTINGS) {
    await env.BITRIX24_SETTINGS.put('bitrix24_app_settings', JSON.stringify(settings));
    console.log("App settings stored in KV.");
  } else {
    // Fallback for local development without KV binding
    appSettingsInMemory = { ...appSettingsInMemory, ...settings };
    console.log("App settings stored in memory (local dev):");
  }
  return true;
}

/**
 * Retrieves application settings from persistent storage (KV Namespace).
 * @param {object} env - The environment object containing KV Namespace binding.
 * @returns {Promise<object|null>} The settings object or null if not found.
 */
async function getAppSettings(env) {
  if (env.BITRIX24_SETTINGS) {
    const data = await env.BITRIX24_SETTINGS.get('bitrix24_app_settings');
    console.log("App settings retrieved from KV.");
    return data ? JSON.parse(data) : null;
  } else {
    // Fallback for local development without KV binding
    console.log("App settings retrieved from memory (local dev):");
    return Object.keys(appSettingsInMemory).length > 0 ? appSettingsInMemory : null;
  }
}

/**
 * Refreshes the Bitrix24 access token using the refresh token.
 * @param {object} env - The environment object containing KV Namespace binding and client secrets.
 * @param {object} currentSettings - Current application settings containing refresh_token.
 * @returns {Promise<object>} New settings with updated access_token and expires_in.
 */
async function refreshAccessToken(env, currentSettings) {
  const client_id = env.BITRIX24_CLIENT_ID || currentSettings.C_REST_CLIENT_ID; // Fallback for local dev
  const client_secret = env.BITRIX24_CLIENT_SECRET || currentSettings.C_REST_CLIENT_SECRET; // Fallback for local dev

  if (!client_id || !client_secret) {
    throw new Error("Client ID or Client Secret not found in environment variables or settings.");
  }

  const params = new URLSearchParams({
    client_id: client_id,
    grant_type: "refresh_token",
    client_secret: client_secret,
    refresh_token: currentSettings.refresh_token,
  });

  const response = await fetch(BITRIX24_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (data.error) {
    console.error("Error refreshing token:", data.error, data.error_description);
    throw new Error(`Failed to refresh token: ${data.error_description || data.error}`);
  }

  const newSettings = {
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token || currentSettings.refresh_token, // Refresh token might not change
  };

  await setAppSettings(env, newSettings);
  return newSettings;
}

/**
 * Makes a call to the Bitrix24 REST API, handling token refresh if necessary.
 * @param {object} env - The environment object containing KV Namespace binding and client secrets.
 * @param {string} method - The Bitrix24 API method (e.g., 'crm.contact.get').
 * @param {object} params - Parameters for the API method.
 * @param {boolean} isAuthCall - True if this is an authentication call (e.g., to get initial tokens).
 * @param {string} overrideDomain - Optional domain override for local apps.
 * @returns {Promise<object>} The API response data.
 */
async function callBitrix24Api(env, method, params = {}, isAuthCall = false, overrideDomain = null) {
  let settings = await getAppSettings(env);

  if (!settings && !isAuthCall) {
    throw new Error("Application not installed or settings not found.");
  }

  let accessToken = settings?.access_token;
  let domain = overrideDomain || settings?.domain;
  let clientEndpoint = settings?.client_endpoint || `https://${domain}/rest/`;

  // Handle different authentication methods
  if (settings?.is_web_hook === 'Y' && settings?.client_endpoint) {
    clientEndpoint = settings.client_endpoint;
    // For webhooks, auth param is not needed in the URL
  } else if (!isAuthCall) {
    // Check if auth is already provided in params (for APP_SID)
    if (!params.auth) {
      // For OAuth calls, ensure access token is present
      if (!accessToken && !settings?.is_local_app) {
        throw new Error("Access token not found. Please install the application.");
      }
      if (accessToken) {
        params.auth = accessToken;
      }
    }
  }

  let url;
  if (isAuthCall) {
    url = BITRIX24_AUTH_URL;
  } else {
    url = `${clientEndpoint}${method}${BITRIX24_REST_ENDPOINT_SUFFIX}`;
  }

  const body = new URLSearchParams(params).toString();

  // Debug logging
  console.log('API Call Debug:', {
    url: url,
    method: method,
    params: params,
    body: body
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body,
  });

  const data = await response.json();
  console.log('API Response:', data);

  // Handle token expiration for non-auth calls
  if (!isAuthCall && data.error === "expired_token") {
    console.log("Access token expired. Attempting to refresh...");
    try {
      const newSettings = await refreshAccessToken(env, settings);
      // Retry the original API call with the new token
      params.auth = newSettings.access_token; // Update auth param with new token
      const retryResponse = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
      });
      return await retryResponse.json();
    } catch (refreshError) {
      console.error("Failed to refresh token and retry API call:", refreshError);
      throw refreshError; // Re-throw if refresh fails
    }
  }

  if (data.error) {
    console.error("Bitrix24 API error:", data.error, data.error_description);
    throw new Error(`Bitrix24 API Error: ${data.error_description || data.error}`);
  }

  return data;
}

export { setAppSettings, getAppSettings, callBitrix24Api, refreshAccessToken };