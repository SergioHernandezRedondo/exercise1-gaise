const cron = require("node-cron");
const { execSync } = require("child_process");

/**
 * Scheduler for automated periodic scraping
 * Handles full pipeline: scrape → persist → detect changes → notify
 */
class Scheduler {
  constructor(cronExpression = "*/30 * * * *", enableNotifications = true) {
    this.cronExpression = cronExpression;
    this.enableNotifications = enableNotifications;
    this.task = null;
    this.isRunning = false;
    this.lastRunTime = null;
    this.lastRunStatus = null;
    this.runCount = 0;
  }

  /**
   * Start the scheduler - runs on cron interval
   */
  start() {
    console.log(
      `⏰ Starting scheduler with cron: "${this.cronExpression}"\n🌍 Sites configured: iparralde\n`
    );

    this.task = cron.schedule(this.cronExpression, async () => {
      // Guard: skip if previous run still in progress
      if (this.isRunning) {
        console.log(
          `⚠️  [${this.timestamp()}] Skipping tick - previous run still in progress\n`
        );
        return;
      }

      await this.runScrapeForAllSites();
    });

    console.log(`✅ Scheduler started. Press Ctrl+C to stop.\n`);

    // Handle graceful shutdown
    process.on("SIGINT", () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());
  }

  /**
   * Run scrape for all configured sites
   */
  async runScrapeForAllSites() {
    this.isRunning = true;
    this.runCount++;
    const startTime = Date.now();
    const runNumber = this.runCount;

    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 Run #${runNumber} started at ${this.timestamp()}`);
    console.log(`${"=".repeat(70)}\n`);

    const sites = ["iparralde"];
    const results = { success: 0, failed: 0, errors: [] };

    for (const site of sites) {
      try {
        console.log(`🌍 Scraping ${site}...`);
        
        // Build command
        const notifyFlag = this.enableNotifications ? "" : "--no-notifications";
        const cmd = `node scrape.js --site ${site} --persist ${notifyFlag}`.trim();

        // Execute scrape
        const output = execSync(cmd, {
          cwd: process.cwd(),
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });

        // Parse output for changes
        const changesMatch = output.match(
          /Changes detected:\s+new: (\d+)[\s\S]*?attributes_changed: (\d+)[\s\S]*?removed: (\d+)/
        );
        if (changesMatch) {
          const [, newCount, changedCount, removedCount] = changesMatch;
          console.log(
            `  ✅ ${site}: new=${newCount}, changed=${changedCount}, removed=${removedCount}`
          );
        } else {
          console.log(`  ✅ ${site}: completed successfully`);
        }

        results.success++;
      } catch (error) {
        console.log(`  ❌ ${site}: ERROR - ${error.message.split("\n")[0]}`);
        results.failed++;
        results.errors.push({ site, error: error.message });
      }
    }

    // Summary
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📋 Run #${runNumber} completed in ${duration}s`);
    console.log(`   ✅ Succeeded: ${results.success}/${sites.length}`);
    if (results.failed > 0) {
      console.log(`   ❌ Failed: ${results.failed}/${sites.length}`);
      results.errors.forEach((err) => {
        console.log(`      - ${err.site}: ${err.error.substring(0, 50)}...`);
      });
    }
    console.log(`${"=".repeat(70)}\n`);

    this.lastRunTime = new Date();
    this.lastRunStatus =
      results.failed === 0 ? "success" : "partial_failure";
    this.isRunning = false;
  }

  /**
   * Run all sites once and exit (useful for OS-level cron)
   */
  async runOnce() {
    console.log(`\n🚀 Running all sites once...\n`);
    await this.runScrapeForAllSites();
    console.log(`✅ Run complete. Exiting.\n`);
    process.exit(0);
  }

  /**
   * Get health status (last run info)
   */
  getHealth() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      lastRunStatus: this.lastRunStatus,
      totalRuns: this.runCount,
      cronExpression: this.cronExpression,
    };
  }

  /**
   * Start a simple health-check HTTP server
   */
  startHealthServer(port = 3000) {
    const http = require("http");

    const server = http.createServer((req, res) => {
      if (req.url === "/health") {
        const health = this.getHealth();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(health, null, 2));
      } else if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Scheduler health check endpoint: GET /health\n");
      } else {
        res.writeHead(404);
        res.end("Not found\n");
      }
    });

    server.listen(port, () => {
      console.log(`🏥 Health check server listening on http://localhost:${port}/health\n`);
    });

    return server;
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    console.log(`\n\n🛑 Shutting down scheduler...`);
    if (this.task) {
      this.task.stop();
      console.log(`✅ Scheduler stopped`);
    }
    console.log(`📊 Total runs: ${this.runCount}`);
    console.log(`✨ Goodbye!\n`);
    process.exit(0);
  }

  /**
   * Helper: format current timestamp
   */
  timestamp() {
    return new Date().toLocaleString();
  }
}

module.exports = Scheduler;
