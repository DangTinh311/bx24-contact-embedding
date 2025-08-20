# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Cloudflare Worker application for Bitrix24 CRM integration written in JavaScript. The worker handles OAuth authentication, API communication, and provides placement applications for the Bitrix24 platform.

## Core Architecture

- **index.js**: Main worker entry point handling HTTP requests and routing
- **bitrix24_api.js**: API communication layer with token management and authentication
- **wrangler.toml**: Cloudflare Worker configuration
- **package.json**: Project metadata and dependencies

## Development Commands

- **Deploy to Cloudflare**: `wrangler deploy` (requires Wrangler CLI)
- **Local development**: `wrangler dev` (starts local development server)
- **Publish**: `wrangler publish` (legacy command, use deploy instead)

## Key Features

- **OAuth Flow**: Complete Bitrix24 OAuth implementation with token refresh
- **Placement Support**: Custom placement applications within Bitrix24 interface  
- **Token Management**: Automatic access token refresh using Cloudflare KV storage
- **Error Handling**: Comprehensive error handling for API failures and token expiration
- **Local Development**: In-memory fallback for development without KV binding

## Environment Configuration

Required environment variables:
- `BITRIX24_CLIENT_ID`: OAuth application client ID
- `BITRIX24_CLIENT_SECRET`: OAuth application client secret
- `BITRIX24_SETTINGS`: KV Namespace binding for storing app settings

## API Integration Points

- **Authentication**: OAuth 2.0 flow via `oauth.bitrix.info`
- **REST API**: Bitrix24 REST API calls with automatic token refresh
- **Webhook Support**: Fallback support for webhook-based authentication
- **KV Storage**: Persistent storage of authentication tokens and settings

## Request Handling

- `/install`: OAuth installation endpoint for Bitrix24 app installation
- `/placement`: Placement application handler displaying contact information
- `/css/app.css`: Embedded CSS styles for placement UI
- Default route: Welcome message with available endpoints

## Storage Architecture

- **Production**: Uses Cloudflare KV Namespace (`BITRIX24_SETTINGS`) for persistent storage
- **Development**: Falls back to in-memory storage when KV binding unavailable
- **Settings Schema**: Stores access_token, refresh_token, domain, member_id, and client credentials

## Error Handling Patterns

- Token expiration automatically triggers refresh attempt
- Failed API calls include detailed error messages
- Installation failures return appropriate HTTP status codes
- Console logging for debugging API communication