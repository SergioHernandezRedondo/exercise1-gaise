/**
 * Telegram notification module (Milestone 4)
 * Sends change notifications to a Telegram chat
 */

const https = require('https');

class TelegramNotifier {
  constructor() {
    this.enabled = process.env.ENABLE_NOTIFICATIONS === 'true';
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;

    if (this.enabled && (!this.botToken || !this.chatId)) {
      console.warn('⚠️  Notifications enabled but missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
      this.enabled = false;
    }
  }

  /**
   * Send a message to Telegram
   * @param {string} message - HTML-formatted message
   * @returns {Promise<boolean>} Success status
   */
  async sendMessage(message) {
    if (!this.enabled) {
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

      const payload = JSON.stringify({
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML'
      });

      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.telegram.org',
          port: 443,
          path: `/bot${this.botToken}/sendMessage`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              if (response.ok) {
                resolve(true);
              } else {
                console.error('Telegram error:', response.description);
                resolve(false);
              }
            } catch (err) {
              console.error('Failed to parse Telegram response:', err.message);
              resolve(false);
            }
          });
        });

        req.on('error', (err) => {
          console.error('Telegram request failed:', err.message);
          resolve(false);
        });

        req.write(payload);
        req.end();
      });
    } catch (err) {
      console.error('Error sending Telegram notification:', err.message);
      return false;
    }
  }

  /**
   * Notify about new listings
   */
  async notifyNewListings(siteId, listings, count) {
    if (!this.enabled || count === 0) {
      return;
    }

    const message = `
🆕 <b>New Listings on ${siteId}</b>

Found <b>${count}</b> new listing${count === 1 ? '' : 's'}

<i>Timestamp: ${new Date().toLocaleString()}</i>
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Notify about changed listings
   */
  async notifyChangedListings(siteId, changes) {
    if (!this.enabled || changes.length === 0) {
      return;
    }

    // Group by change type
    const grouped = {};
    for (const change of changes) {
      if (!grouped[change.change_type]) {
        grouped[change.change_type] = [];
      }
      grouped[change.change_type].push(change);
    }

    // Build message
    let message = `📊 <b>Changes on ${siteId}</b>\n\n`;

    if (grouped.new) {
      message += `🆕 <b>New:</b> ${grouped.new.length}\n`;
    }
    if (grouped.attributes_changed) {
      message += `✏️ <b>Modified:</b> ${grouped.attributes_changed.length}\n`;
    }
    if (grouped.removed) {
      message += `❌ <b>Removed:</b> ${grouped.removed.length}\n`;
    }

    message += `\n<i>Timestamp: ${new Date().toLocaleString()}</i>`;

    await this.sendMessage(message);
  }

  /**
   * Notify about price drop (useful for future analytics)
   */
  async notifyPriceDrop(siteId, listing, oldPrice, newPrice) {
    if (!this.enabled) {
      return;
    }

    const drop = oldPrice - newPrice;
    const percent = ((drop / oldPrice) * 100).toFixed(1);

    const message = `
💰 <b>Price Drop on ${siteId}</b>

<b>${listing.title}</b>

<s>€${oldPrice}</s> → <b>€${newPrice}</b>
Drop: <b>€${drop}</b> (<b>${percent}%</b>)

Location: ${listing.location}

<i>Timestamp: ${new Date().toLocaleString()}</i>
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Notify about scrape run completion
   */
  async notifyScrapeComplete(siteId, stats) {
    if (!this.enabled) {
      return;
    }

    const message = `
✅ <b>Scrape Run Complete</b>

Site: <b>${siteId}</b>
Listings Found: <b>${stats.found}</b>
New: <b>${stats.new || 0}</b>
Changed: <b>${stats.changed || 0}</b>
Removed: <b>${stats.removed || 0}</b>

Duration: ${stats.duration || 'N/A'}
Status: <b>${stats.status === 'ok' ? '✅ OK' : '⚠️ ' + stats.status}</b>

<i>Run Time: ${new Date().toLocaleString()}</i>
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Notify about scrape error
   */
  async notifyError(siteId, error) {
    if (!this.enabled) {
      return;
    }

    const message = `
❌ <b>Scrape Error on ${siteId}</b>

<b>Error:</b> ${error}

<i>Time: ${new Date().toLocaleString()}</i>
    `.trim();

    await this.sendMessage(message);
  }

  /**
   * Test if notifications are working
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, message: 'Notifications disabled' };
    }

    try {
      const testMessage = `
✅ <b>Telegram Bot Test</b>

If you see this message, notifications are working!

<i>Test sent: ${new Date().toLocaleString()}</i>
      `.trim();

      const result = await this.sendMessage(testMessage);
      return {
        success: result,
        message: result ? 'Connection successful!' : 'Failed to send test message'
      };
    } catch (err) {
      return {
        success: false,
        message: `Error: ${err.message}`
      };
    }
  }
}

module.exports = TelegramNotifier;
