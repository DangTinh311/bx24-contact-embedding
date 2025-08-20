import { setAppSettings, getAppSettings, callBitrix24Api } from './bitrix24_api';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};

async function handleRequest(request, env) {
  try {
    const url = new URL(request.url);

    // Debug env object
    console.log('ENV object keys:', Object.keys(env || {}));

    switch (url.pathname) {
      case '/install':
        return handleInstall(request, env);
      case '/placement':
        return handlePlacement(request, env);
      case '/css/app.css':
        return handleCss(request);
      case '/debug':
        return handleDebug(request, env);
      case '/test-settings':
        return handleTestSettings(request, env);
      default:
        return new Response('Welcome to Bitrix24 Worker! Try /install or /placement', {
          headers: { 'content-type': 'text/plain' },
        });
    }
  } catch (error) {
    console.error('Handler error:', error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: { 'content-type': 'text/plain' }
    });
  }
}

async function handleInstall(request, env) {
  const url = new URL(request.url);
  let code, domain, member_id;
  
  // Try to get parameters from both GET and POST
  if (request.method === 'POST') {
    try {
      const formData = await request.formData();
      code = formData.get('code') || formData.get('CODE');
      domain = formData.get('domain') || formData.get('DOMAIN');
      member_id = formData.get('member_id') || formData.get('MEMBER_ID');
    } catch (e) {
      // Fallback to URL params
    }
  }
  
  // Fallback to URL parameters if POST didn't work
  if (!code) code = url.searchParams.get('code') || url.searchParams.get('CODE');
  if (!domain) domain = url.searchParams.get('domain') || url.searchParams.get('DOMAIN');
  if (!member_id) member_id = url.searchParams.get('member_id') || url.searchParams.get('MEMBER_ID');

  // Get client_id and client_secret from environment variables
  const client_id = env.BITRIX24_CLIENT_ID;
  const client_secret = env.BITRIX24_CLIENT_SECRET;

  // Debug information
  const debugInfo = {
    method: request.method,
    urlParams: Object.fromEntries(url.searchParams),
    receivedParams: { code: !!code, domain: !!domain, member_id: !!member_id },
    envVars: { 
      hasClientId: !!client_id, 
      hasClientSecret: !!client_secret,
      clientIdValue: client_id?.substring(0, 10) + '...' // Show partial for debug
    }
  };

  // For local apps, we might not need the OAuth flow with 'code'
  // Just need domain and credentials
  const isLocalApp = client_id?.startsWith('local.');
  const requiredForOAuth = code && domain && client_id && client_secret;
  const requiredForLocal = domain && client_id && client_secret;

  if (!requiredForOAuth && !(isLocalApp && requiredForLocal)) {
    return new Response(`
<!DOCTYPE html>
<html>
<head><title>Installation Debug</title></head>
<body>
  <h1>Missing Installation Parameters</h1>
  <p>Required for OAuth: code, domain, client_id, client_secret</p>
  <p>Required for Local App: domain, client_id, client_secret</p>
  <h2>Debug Information:</h2>
  <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
  
  <h2>App Type:</h2>
  <p>Local App: ${isLocalApp}</p>
  <p>Has required OAuth params: ${requiredForOAuth}</p>
  <p>Has required Local params: ${requiredForLocal}</p>
</body>
</html>`, { 
      status: 400,
      headers: { 'content-type': 'text/html' }
    });
  }

  try {
    let settings;
    
    if (isLocalApp && !code) {
      // For local apps, we don't need OAuth flow
      // Just store the basic settings
      settings = {
        domain: domain,
        member_id: member_id,
        client_endpoint: `https://${domain}/rest/`,
        C_REST_CLIENT_ID: client_id,
        C_REST_CLIENT_SECRET: client_secret,
        is_local_app: true,
      };
    } else {
      // Regular OAuth flow
      const authParams = {
        grant_type: 'authorization_code',
        client_id: client_id,
        client_secret: client_secret,
        code: code,
        scope: 'crm,user,placement', // Example scopes, adjust as needed
      };

      // Pass env to callBitrix24Api for accessing KV and other env vars
      const authData = await callBitrix24Api(env, '', authParams, true); // isAuthCall = true
      
      settings = {
        access_token: authData.access_token,
        expires_in: authData.expires_in,
        refresh_token: authData.refresh_token,
        domain: domain,
        member_id: member_id,
        client_endpoint: `https://${domain}/rest/`,
        // Store client_id and client_secret in settings for refresh token logic
        C_REST_CLIENT_ID: client_id,
        C_REST_CLIENT_SECRET: client_secret,
      };
    }

    await setAppSettings(env, settings);

    // Serve the success HTML page
    const installSuccessHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Installation Success</title>
    <script src="//api.bitrix24.com/api/v1/"></script>
    <script>
        BX24.init(function(){
            BX24.installFinish();
        });
    </script>
</head>
<body>
    <p>Installation has been finished. You can close this page.</p>
</body>
</html>`;

    return new Response(installSuccessHtml, {
      headers: { 'content-type': 'text/html' },
    });

  } catch (error) {
    console.error('Installation error:', error);
    return new Response(`Installation failed: ${error.message}`, { status: 500 });
  }
}

function displayValue(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  } else if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value); // Or format as needed for objects
  } else {
    return value;
  }
}

async function handlePlacement(request, env) {
  const url = new URL(request.url);
  let placementOptions = {};
  let contactHtml = '';

  // Check if env is available
  if (!env) {
    return new Response('Environment not available', { 
      status: 500,
      headers: { 'content-type': 'text/plain' }
    });
  }

  try {
    // Try to get PLACEMENT_OPTIONS and other data from different sources
    let appSid, domain, protocol, lang;
    let allPostData = {};
    
    if (request.method === 'POST') {
      try {
        // Try FormData first
        const formData = await request.formData();
        for (const [key, value] of formData.entries()) {
          allPostData[key] = value;
        }
      } catch (formError) {
        try {
          // Fallback to text body parsing
          const textBody = await request.text();
          const params = new URLSearchParams(textBody);
          for (const [key, value] of params.entries()) {
            allPostData[key] = value;
          }
        } catch (textError) {
          console.error('Failed to parse POST data:', formError, textError);
        }
      }
      
      // Extract data from parsed POST data
      const placementOptionsParam = allPostData['PLACEMENT_OPTIONS'];
      if (placementOptionsParam) {
        placementOptions = JSON.parse(placementOptionsParam);
      }
      
      // Get Bitrix24 OAuth session data
      appSid = allPostData['AUTH_ID'] || allPostData['APP_SID'];
      domain = allPostData['DOMAIN'] || url.searchParams.get('DOMAIN');
      protocol = allPostData['PROTOCOL'] || url.searchParams.get('PROTOCOL');
      lang = allPostData['LANG'] || url.searchParams.get('LANG');
    } else {
      // Fallback to URL parameter
      const placementOptionsParam = url.searchParams.get('PLACEMENT_OPTIONS');
      if (placementOptionsParam) {
        placementOptions = JSON.parse(placementOptionsParam);
      }
      
      appSid = url.searchParams.get('APP_SID');
      domain = url.searchParams.get('DOMAIN');
    }

    // Try different possible field names for contact ID
    const contactId = placementOptions.ID || placementOptions.ENTITY_ID || placementOptions.entityId || placementOptions.id;
    
    // If domain not found in request, try to get from settings
    if (!domain) {
      try {
        const settings = await getAppSettings(env);
        domain = settings?.domain;
      } catch (e) {
        // Ignore errors, we'll handle missing domain below
      }
    }

    if (!contactId) {
      // Show debug information
      const debugInfo = JSON.stringify(placementOptions, null, 2);
      contactHtml = `<div class="alert alert-warning" role="alert">
        Contact ID not found in PLACEMENT_OPTIONS.<br>
        <strong>Debug - Received placement options:</strong><br>
        <pre>${debugInfo}</pre>
        <strong>Available URL parameters:</strong><br>
        <pre>${JSON.stringify(Object.fromEntries(url.searchParams), null, 2)}</pre>
      </div>`;
    } else {
      // For local apps, use APP_SID for authentication
      const apiParams = { ID: contactId };
      if (appSid) {
        apiParams.auth = appSid;
      }
      
      // Debug info
      const debugInfo = {
        contactId: contactId,
        appSid: appSid ? appSid.substring(0, 8) + '...' : null,
        domain: domain,
        apiParams: apiParams,
        allPostData: Object.keys(allPostData),
        postDataValues: allPostData
      };
      
      try {
        const contactResult = await callBitrix24Api(env, 'crm.contact.get', apiParams, false, domain);
        
        if (contactResult.error) {
          contactHtml = `<div class="alert alert-danger" role="alert">
            Error fetching contact: ${contactResult.error_description || contactResult.error}
            <br><strong>Debug Info:</strong>
            <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
          </div>`;
        } else if (contactResult.result) {
        let tableRows = '';
        for (const field in contactResult.result) {
          if (Object.hasOwnProperty.call(contactResult.result, field)) {
            const value = contactResult.result[field];
            tableRows += `
              <tr>
                <td>${field}</td>
                <td>${displayValue(value)}</td>
              </tr>
            `;
          }
        }
        contactHtml = `
          <table class="table table-striped">
            ${tableRows}
          </table>
        `;
        } else {
          contactHtml = '<div class="alert alert-info" role="alert">No contact data found.</div>';
        }
      } catch (apiError) {
        console.error('API call error:', apiError);
        contactHtml = `<div class="alert alert-danger" role="alert">
          API Error: ${apiError.message}
          <br><strong>Debug Info:</strong>
          <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
        </div>`;
      }
    }
  } catch (error) {
    console.error('Placement handler error:', error);
    contactHtml = `<div class="alert alert-danger" role="alert">An error occurred: ${error.message}</div>`;
  }

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/css/app.css">
    <script src="https://code.jquery.com/jquery-3.6.0.js" integrity="sha256-H+K7U5CnXl1h5ywQfKtSj8PCmoN9aaq30gDh27Xc0jk=" crossorigin="anonymous"></script>
    <script src="//api.bitrix24.com/api/v1/"></script>
    <title>Contact Details</title>
</head>
<body class="container">
    ${contactHtml}
</body>
</html>`;

  return new Response(htmlContent, {
    headers: { 'content-type': 'text/html' },
  });
}

async function handleCss(request) {
  // In a real Worker, you'd serve this from a KV asset or a build step.
  // For now, we'll hardcode the content or read it if it's a small file.
  const cssContent = `/* worker_src/css/app.css */
body {
    font-family: Arial, sans-serif;
    margin: 20px;
    background-color: #f4f4f4;
}
.container {
    max-width: 960px;
    margin: 0 auto;
    padding: 20px;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.alert {
    padding: 15px;
    margin-bottom: 20px;
    border: 1px solid transparent;
    border-radius: 4px;
}
.alert-success {
    color: #3c763d;
    background-color: #dff0d8;
    border-color: #d6e9c6;
}
.alert-warning {
    color: #8a6d3b;
    background-color: #fcf8e3;
    border-color: #faebcc;
}
.alert-danger {
    color: #a94442;
    background-color: #f2dede;
    border-color: #ebccd1;
}
.alert-info {
    color: #31708f;
    background-color: #d9edf7;
    border-color: #bce8f1;
}
.table {
    width: 100%;
    max-width: 100%;
    margin-bottom: 20px;
    border-collapse: collapse;
    background-color: transparent;
}
.table > thead > tr > th,
.table > tbody > tr > th,
.table > tfoot > tr > th,
.table > thead > tr > td,
.table > tbody > tr > td,
.table > tfoot > tr > td {
    padding: 8px;
    line-height: 1.42857143;
    vertical-align: top;
    border-top: 1px solid #ddd;
}
.table > thead > tr > th {
    vertical-align: bottom;
    border-bottom: 2px solid #ddd;
}
.table-striped > tbody > tr:nth-of-type(odd) {
    background-color: #f9f9f9;
}
pre {
    display: block;
    padding: 9.5px;
    margin: 0 0 10px;
    font-size: 13px;
    line-height: 1.42857143;
    color: #333;
    word-break: break-all;
    word-wrap: break-word;
    background-color: #f5f5f5;
    border: 1px solid #ccc;
    border-radius: 4px;
}
`;
  return new Response(cssContent, {
    headers: { 'content-type': 'text/css' },
  });
}

async function handleDebug(request, env) {
  const url = new URL(request.url);
  const allParams = Object.fromEntries(url.searchParams);
  
  let debugInfo = {
    method: request.method,
    url: request.url,
    params: allParams,
    envKeys: Object.keys(env || {}),
    hasKV: !!env?.BITRIX24_SETTINGS,
    hasClientId: !!env?.BITRIX24_CLIENT_ID,
    hasClientSecret: !!env?.BITRIX24_CLIENT_SECRET,
  };

  // Try to get POST data if available
  if (request.method === 'POST') {
    try {
      const formData = await request.formData();
      debugInfo.postData = Object.fromEntries(formData);
    } catch (e) {
      debugInfo.postError = e.message;
    }
  }

  return new Response(`
<!DOCTYPE html>
<html>
<head><title>Debug Info</title></head>
<body>
  <h1>Worker Debug Info</h1>
  <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
</body>
</html>`, {
    headers: { 'content-type': 'text/html' },
  });
}

async function handleTestSettings(request, env) {
  try {
    const settings = await getAppSettings(env);
    
    const testInfo = {
      hasSettings: !!settings,
      settingsKeys: settings ? Object.keys(settings) : [],
      hasAccessToken: !!(settings?.access_token),
      hasDomain: !!(settings?.domain),
    };

    return new Response(`
<!DOCTYPE html>
<html>
<head><title>Settings Test</title></head>
<body>
  <h1>Settings Test</h1>
  <pre>${JSON.stringify(testInfo, null, 2)}</pre>
</body>
</html>`, {
      headers: { 'content-type': 'text/html' },
    });
  } catch (error) {
    return new Response(`Settings Test Error: ${error.message}`, {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    });
  }
}