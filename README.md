# JhonBot

JhonBot is a feature-rich Discord bot for SA-MP (San Andreas Multiplayer) and roleplay communities. It connects Discord with a game server and provides tools for player services, staff operations, activity monitoring, and community management.

## Features

- User Control Panel (UCP) registration and account verification
- Password reset through Discord direct messages
- MySQL database integration
- SA-MP server query and monitoring
- Modular slash commands, prefix commands, buttons, modals, and select menus
- Staff and administrator activity monitoring
- Economy, money, bank, and game activity logs
- Player reports, recruitment, donations, refunds, and duty reports
- Dashboard and community analytics
- Automatic restart support on Windows

## Technology

- Node.js
- discord.js v14
- MySQL
- JavaScript

## Requirements

- Node.js 18 or newer
- MySQL-compatible database
- A Discord application and bot token
- Access to the SA-MP server configuration

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/denisjhh1/jhonbot.git
   cd jhonbot
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure the bot using `defines.js` and the dashboard settings. Replace every `YOUR_DISCORD_ID` with the correct server, channel, role, or user ID, and set `YOUR_SAMP_SERVER_IP` to your own server address. Add your Discord token and database credentials locally.

4. Start the bot:

   ```bash
   npm start
   ```

   On Windows, `start.bat` can also be used.

## Project Structure

- `JhonBot.js` — application entry point
- `defines.js` — default bot, Discord, database, and SA-MP configuration
- `functions.js` — shared helper functions
- `core/` — feature logic and services
- `catalog/` — editable benefit and donation catalogs
- `commands/` — slash and prefix commands
- `components/` — Discord buttons, modals, and select menus
- `events/` — Discord event handlers
- `handlers/` — command and component loaders
- `class/` — Discord client implementation
- `dashboard/` — web dashboard
- `sql/` — database migration scripts
- `assets/` — static assets

Runtime files and generated community data are intentionally excluded from this public source archive. Back up your own runtime data before updating an existing installation.

## Project Maintainer

**Jhon** — [@denisjhh1](https://github.com/denisjhh1)

The project is maintained and further developed by Jhon following the ownership handover described by the current maintainer.

## License

ISC. See `LICENSE`.
