# Project Overview

This project is a Cloudflare Worker designed to integrate with Bitrix24 CRM. It acts as an intermediary to handle OAuth authentication, manage API communication, and provide custom placement applications within the Bitrix24 interface.

## Main Technologies

-   **JavaScript**: The primary programming language.
-   **Cloudflare Workers**: The serverless platform hosting the application.
-   **Bitrix24 REST API**: For interacting with Bitrix24 CRM data.
-   **Cloudflare Workers KV**: Used for persistent storage of application settings and tokens.

## Architecture

-   **`index.js`**: The main entry point for the Cloudflare Worker, handling incoming HTTP requests and routing them to appropriate handlers (e.g., `/install`, `/placement`).
-   **`bitrix24_api.js`**: Contains functions for interacting with the Bitrix24 REST API, including OAuth token management (refreshing, storing), and making authenticated API calls.
-   **`wrangler.toml`**: Configuration file for the Cloudflare Worker, defining the worker's name, main script, and KV namespace bindings.
-   **`package.json`**: Project metadata, scripts, and dependencies.

# Building and Running

This project is a JavaScript-based Cloudflare Worker. There isn't a traditional "build" step in the sense of compiling source code, but rather deployment to the Cloudflare Workers platform.

## Development Commands

-   **Local Development**:
    ```bash
    wrangler dev
    ```
    This command starts a local development server, allowing you to test the worker locally.

-   **Deployment to Cloudflare**:
    ```bash
    wrangler deploy
    ```
    This command deploys your worker to the Cloudflare Workers platform. Ensure you have the `wrangler` CLI installed and configured.

-   **Testing**:
    ```bash
    npm test
    ```
    *(Note: As of the current state, this command is a placeholder and will output "Error: no test specified". You would typically add actual test scripts here.)*

# Development Conventions

## Authentication and Token Management

-   The worker implements a full OAuth 2.0 flow for Bitrix24 integration.
-   It automatically handles access token refreshing using the refresh token.
-   Authentication tokens and application settings are persistently stored in Cloudflare Workers KV in production environments. During local development, an in-memory fallback is used.

## Bitrix24 Placement Applications

-   The worker supports custom placement applications within the Bitrix24 interface, primarily handled by the `/placement` route.
-   It expects `PLACEMENT_OPTIONS` to be passed via URL parameters or POST data, from which it extracts relevant entity IDs (e.g., Contact ID).

## Environment Configuration

The following environment variables are required for the worker to function correctly, especially for OAuth and KV storage:

-   `BITRIX24_CLIENT_ID`: Your Bitrix24 OAuth application's client ID.
-   `BITRIX24_CLIENT_SECRET`: Your Bitrix24 OAuth application's client secret.
-   `BITRIX24_SETTINGS`: A binding to a Cloudflare Workers KV Namespace used for storing application settings and tokens.

## Request Handling

The worker handles various routes:

-   `/install`: Manages the Bitrix24 application installation process, including OAuth authorization.
-   `/placement`: Displays information within Bitrix24 placements, typically fetching and presenting CRM entity details (e.g., contact information).
-   `/css/app.css`: Serves the CSS styles for the placement UI.
-   `/debug`: Provides debugging information about the worker's environment and request parameters.
-   `/test-settings`: A utility route to test if application settings are correctly retrieved.

## Error Handling

-   The worker includes robust error handling, particularly for Bitrix24 API calls.
-   It automatically attempts to refresh expired access tokens and retries API calls.
-   Detailed error messages are logged to the console and returned in API responses when failures occur.
