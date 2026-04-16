## Project Summary

### Who I am and what I did
I am Sergio Hernández. I built a complete real estate scraping and dashboard pipeline for Exercise 6, including:
- adapter-based scraping architecture
- cloud persistence using Turso
- change tracking and audit logs
- optional Telegram notification support
- a web dashboard for listings, changes, and market statistics

### Milestones completed
- **Milestone 0**: Core scraper CLI and adapter interface
- **Milestone 2**: Turso-backed persistence, upsert logic, and `--status` reporting
- **Milestone 3**: Change detection, current-state tracking, and audit records
- **Milestone 4**: Telegram notification support (optional milestone implemented in code)
- **Milestone 5**: Scheduler support for repeated scraping
- **Milestone 6**: Express dashboard with listings, change log, and stats views

### Adapters implemented
- `adapters/iparralde.js` — scraper for the Iparralde real estate website

The framework is designed to add new adapters by creating a new file in `adapters/` with the same interface.

### Deployment and access
- **Current deployment**: Ubuntu VM on Azure
- **Dashboard access**: `http://localhost:3000` on the VM
- **Domain/IP**: No public domain configured yet; use the VM localhost or public IP if exposed

### Milestones 7–10 Deployment Summary
- **Milestone 7**: Provisioned an Azure VM running Ubuntu 24.04 and verified SSH access. Qwen Code is available as the cloud AI assistant for server-side configuration.
- **Milestone 8**: Project code can be cloned onto the server, dependencies installed, and a dedicated deploy workflow prepared. The system is ready for a non-root `deploy` user with passwordless sudo and GitHub SSH key access.
- **Milestone 9**: A `.eus` domain is planned for production deployment. At the moment, the public domain is not yet configured, so access is via the VM address or `localhost`.
- **Milestone 10**: Deployment architecture is designed for production with Nginx reverse proxy, systemd service for the dashboard, and Let's Encrypt HTTPS via Certbot. The dashboard is currently configured to run on port `3000` behind this architecture when fully deployed.

### Deployment architecture
- Azure VM (Ubuntu 24.04, Standard_B1s)
- Turso cloud SQLite for persistent storage
- Node.js dashboard served on port `3000`
- Nginx reverse proxy (planned) for HTTP/HTTPS traffic
- Certbot / Let's Encrypt (planned) for TLS
- Scraper scheduler via cron or systemd-managed Node scheduler
- Telegram notifications supported via `lib/notifications.js`

### Problems encountered
- The dashboard exited immediately on the VM because Node.js had an empty event loop in the server environment. I fixed this by adding a small keep-alive timer.
- The dashboard was also failing when the home route rendered `index`, because `views/index.ejs` was missing; I added that template.
- API queries originally assumed `siteId` existed on the wrong change table, which caused SQL errors. I fixed the query joins.
- Deployment required making sure the branch was pushed and the VM pulled the latest changes.

### Comments
- The dashboard is read-only and does not trigger scrapes or modify DB data.
- Populate the database first with:
  ```bash
  node scrape.js --site iparralde --persist
  ```
- Then run the dashboard:
  ```bash
  node dashboard.js
  ```
- If you want Telegram alerts, set `ENABLE_NOTIFICATIONS=true`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID` in `.env`.

### Screenshots
#### Dashboard screenshot
![Dashboard screenshot](../results-page.png)

#### Telegram bot alerts
No Telegram screenshot is available yet. The notification module is implemented, but the bot has not been captured in a screenshot.


