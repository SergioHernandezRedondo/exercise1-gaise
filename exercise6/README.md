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
- **Milestone 7**: Azure VM provisioned, Ubuntu 24.04, Qwen Code installed (but it is not working because of the lack of a free access), SSH access verified
- **Milestone 8**: Project cloned, dependencies installed, `deploy` user configured with passwordless sudo and GitHub SSH keys
- **Milestone 9**: `.eus` domain registered (sergiohernandez.eus) and DNS configured
- **Milestone 10**: Nginx reverse proxy configured, systemd service active, Let's Encrypt HTTPS enabled, auto-renewal set up

### Adapters implemented
- `adapters/iparralde.js` — scraper for the Iparralde real estate website

The framework is designed to add new adapters by creating a new file in `adapters/` with the same interface.

### Deployment and access
- **Current deployment**: Azure VM (Ubuntu 24.04, Standard_B1s) in West Europe
- **Live Dashboard**: **https://sergiohernandez.eus** (production, HTTPS with Let's Encrypt)
- **Local dashboard**: `http://localhost:3000` (for development)

### Milestones 7–10 Deployment Summary (✅ Complete)
- **Milestone 7**: Provisioned Azure VM running Ubuntu 24.04 with SSH access verified. Qwen Code installed for cloud-based AI assistance.
- **Milestone 8**: Project cloned onto server, all dependencies installed, `deploy` user created with passwordless sudo and GitHub SSH key configured for secure access.
- **Milestone 9**: `.eus` domain **sergiohernandez.eus** successfully registered via university promotion and DNS records configured pointing to Azure VM public IP.
- **Milestone 10**: Full production deployment complete:
  - Nginx reverse proxy running and forwarding traffic from ports 80/443 to dashboard on port 3000
  - systemd service active and auto-restarting on failure
  - Let's Encrypt HTTPS certificate installed with automatic renewal
  - Crontab scheduler configured for periodic scrapes every 30 minutes
  - Dashboard live at **https://sergiohernandez.eus**

### Deployment architecture
- Azure VM (Ubuntu 24.04, Standard_B1s)
- Turso cloud SQLite for persistent storage
- Node.js dashboard served on port `3000`
- Nginx reverse proxy for HTTP/HTTPS traffic
- Certbot / Let's Encrypt TLS enabled
- Scraper scheduler via cron (every 30 minutes)
- Telegram notifications supported via `lib/notifications.js`

### Problems encountered
- The dashboard exited immediately on the VM because Node.js had an empty event loop in the server environment. I fixed this by adding a small keep-alive timer.
- The dashboard was also failing when the home route rendered `index`, because `views/index.ejs` was missing;
- API queries originally assumed `siteId` existed on the wrong change table, which caused SQL errors. I fixed the query joins.
- Deployment required making sure the branch was pushed and the VM pulled the latest changes.

### Comments
- The dashboard is read-only and does not trigger scrapes or modify DB data.
- Populate the database first with:
  node scrape.js --site iparralde --persist
- Then run the dashboard:
  node dashboard.js
- If you want Telegram alerts, set `ENABLE_NOTIFICATIONS=true`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID` in `.env`.


#### Telegram bot alerts

The Telegram video is in the root directory of the project, named "TelegramNotification.mp4"

## Troubleshooting

### Dashboard shows empty metrics (all dashes)
This means the database is empty because no data has been scraped yet.

**On your deployed server:**
```bash
# SSH into the Azure VM
ssh -i your-key.pem azureuser@<vm-ip>
sudo su - deploy

# Run a manual scrape to populate the database
cd ~/real-estate-monitor  # or your project directory
node scrape.js --site iparralde --persist

# Verify data was inserted
node scrape.js --status

# Then refresh the dashboard at https://sergiohernandez.eus
```

**Check if the cron job is running:**
```bash
# View the cron log
tail -f ~/scrape.log

# List active cron jobs
crontab -l

# If cron isn't set up, add it:
crontab -e
# Add: */30 * * * * cd /home/deploy/real-estate-monitor && /usr/bin/node scrape.js --once >> /home/deploy/scrape.log 2>&1
```

### Metrics appear but are incorrect
Verify the Turso database has the correct credentials in `/home/deploy/real-estate-monitor/.env`:
```bash
cat ~/.env
# Should show: TURSO_DB_URL=libsql://... and TURSO_DB_TOKEN=...
```

Check the database connection:
```bash
node scrape.js --status
```

### Security Note
⚠️ **Never commit `.env` or real credentials to Git.** The `.env.example` file should only contain placeholder values. Update your `.env` on the deployed server with actual credentials from Turso and Telegram.
