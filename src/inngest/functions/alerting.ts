// src/inngest/functions/alerting.ts
//
// Ops Alert Worker.
//
// Listens to the built-in "inngest/function.failed" system event, which
// Inngest fires automatically once a function has exhausted ALL its retries.
// This is the last-resort signal that something has gone seriously wrong and
// human intervention may be required.
//
// Supported webhook targets (auto-detected from OPS_WEBHOOK_URL):
//   - Discord Incoming Webhooks  (discord.com/api/webhooks/...)
//   - Slack Incoming Webhooks    (hooks.slack.com/services/...)
//   - Generic HTTP POST          (anything else -- plain JSON body)

import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPS_WEBHOOK_URL = process.env.OPS_WEBHOOK_URL ?? "";

type AlertSeverity = "WARNING" | "CRITICAL";

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

function buildDiscordPayload(
  functionId: string,
  runId: string,
  errorName: string,
  errorMessage: string,
  severity: AlertSeverity
) {
  const emoji = severity === "CRITICAL" ? "🔴" : "🟡";
  return {
    embeds: [
      {
        title: `${emoji} [${severity}] Inngest Function Failed`,
        description:
          `**Function:** \`${functionId}\`\n` +
          `**Run ID:** \`${runId}\`\n` +
          `**Error:** ${errorName}: ${errorMessage}\n\n` +
          `> ⚠ **System Health Risk** -- All retries exhausted.\n` +
          `> Manual investigation required.`,
        color: severity === "CRITICAL" ? 0xff3333 : 0xffa500,
        timestamp: new Date().toISOString(),
        footer: { text: "Event Registration Platform · Ops Alerting" },
        fields: [
          { name: "Environment", value: process.env.NODE_ENV ?? "unknown", inline: true },
          { name: "Severity", value: severity, inline: true },
        ],
      },
    ],
  };
}

function buildSlackPayload(
  functionId: string,
  runId: string,
  errorName: string,
  errorMessage: string,
  severity: AlertSeverity
) {
  const emoji = severity === "CRITICAL" ? ":red_circle:" : ":warning:";
  return {
    text: `${emoji} *[${severity}] Inngest Function Failed*`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${emoji} [${severity}] Inngest Function Failed` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Function:*\n\`${functionId}\`` },
          { type: "mrkdwn", text: `*Run ID:*\n\`${runId}\`` },
          { type: "mrkdwn", text: `*Error:*\n${errorName}: ${errorMessage}` },
          { type: "mrkdwn", text: `*Environment:*\n${process.env.NODE_ENV ?? "unknown"}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":rotating_light: *System Health Risk* -- All retries exhausted. Manual investigation required.",
        },
      },
    ],
  };
}

function buildGenericPayload(
  functionId: string,
  runId: string,
  errorName: string,
  errorMessage: string,
  severity: AlertSeverity
) {
  return {
    severity,
    alert: "INNGEST_FUNCTION_FAILED",
    function_id: functionId,
    run_id: runId,
    error: { name: errorName, message: errorMessage },
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    system_health_risk: true,
  };
}

function buildWebhookPayload(
  functionId: string,
  runId: string,
  errorName: string,
  errorMessage: string,
  severity: AlertSeverity
) {
  if (OPS_WEBHOOK_URL.includes("discord.com")) {
    return buildDiscordPayload(functionId, runId, errorName, errorMessage, severity);
  }
  if (OPS_WEBHOOK_URL.includes("hooks.slack.com")) {
    return buildSlackPayload(functionId, runId, errorName, errorMessage, severity);
  }
  return buildGenericPayload(functionId, runId, errorName, errorMessage, severity);
}

// ---------------------------------------------------------------------------
// Inngest function
// ---------------------------------------------------------------------------

export const alertOnFunctionFailure = inngest.createFunction(
  {
    id: "alert-on-function-failure",
    name: "Alert Ops on Function Failure",
    // Retry the ALERT itself twice -- e.g. Discord rate-limit or Slack 503.
    // The original failed function is already dead; this is best-effort.
    retries: 2,
  },
  // "inngest/function.failed" is a built-in system event emitted by Inngest
  // automatically whenever any function in this app exhausts all retries.
  { event: "inngest/function.failed" },

  async ({ event, step, logger }) => {
    const { function_id, run_id, error } = event.data;

    // Registration failures are CRITICAL; everything else is WARNING.
    const severity: AlertSeverity = function_id.includes("registration")
      ? "CRITICAL"
      : "WARNING";

    logger.warn("Function failure detected -- preparing ops alert.", {
      function_id,
      run_id,
      error_message: error.message,
      severity,
    });

    // Isolated step: if the webhook call fails, only THIS step is retried.
    // The classification logic above is never re-executed.
    await step.run("send-ops-webhook", async () => {
      if (!OPS_WEBHOOK_URL) {
        logger.warn(
          "OPS_WEBHOOK_URL is not set. Skipping webhook dispatch. " +
          "Add OPS_WEBHOOK_URL to .env to enable Discord/Slack alerting."
        );
        return { dispatched: false, reason: "OPS_WEBHOOK_URL not configured" };
      }

      const payload = buildWebhookPayload(
        function_id,
        run_id,
        error.name,
        error.message,
        severity
      );

      const response = await fetch(OPS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // Abort if the webhook hangs -- don't block the Inngest worker pool.
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        // Non-2xx: throw so Inngest retries this step with back-off.
        throw new Error(
          `Webhook delivery failed: ${response.status} ${response.statusText}`
        );
      }

      logger.info("Ops alert dispatched successfully.", { function_id, severity });
      return { dispatched: true, severity };
    });

    return { alerted: true, function_id, severity };
  }
);
