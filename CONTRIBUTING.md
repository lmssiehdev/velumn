# Contributing to Velumn

Thank you for your interest in contributing! Any contributions you make are greatly appreciated.
If you need help, please reach out on Discord.

## Introduction
```
apps
├── bot
├── web
├── dashboard
packages
├── utils
├── db
├── ...
```

The `apps` directory contains the code for:

* `web` – The marketing pages hosted at https://velumn.com, plus the forum communities
* `dashboard` – The dashboard to manage your forum community
* `bot` – The indexing bot

The `packages` directory contains the code for:

* `db` – The Drizzle ORM code (used directly by all apps)
* `utils` – A collection of shared helper functions
* Others are self-explanatory

### Step 1: Setting Up the Bot

Head to the Discord Developer Portal and create a new application (e.g., "Velumn Local"), along with an optional testing server in Discord.

Create a bot with the following Gateway intents: `Server Members` and `Message Content`. Then copy the bot token.

Next, navigate to OAuth2 → General. Grab your Client ID and Client Secret, then add the redirect URL `http://localhost:3001/api/auth/callback/discord` for dashboard authentication.

Change the authorization method to "In-app Authorization", selecting both the `bot` and `applications.commands` scopes.

### Step 2: Local Setup

(I'm currently refactoring and simplifying things considerably. I'll update this section once that's complete.)