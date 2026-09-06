// src/app/api/inngest/route.ts
//
// Next.js Route Handler that exposes the Inngest webhook receiver.
// Inngest calls this endpoint to:
//   - Verify the signing key on incoming requests (production)
//   - Deliver step results back to running functions
//   - Register function manifests during the dev handshake

import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processRegistration } from "@/inngest/functions/process-registration";
import { alertOnFunctionFailure } from "@/inngest/functions/alerting";

// serve() returns { GET, POST, PUT } handlers that Next.js App Router
// maps directly to the corresponding HTTP methods.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processRegistration,
    alertOnFunctionFailure,  // Catches inngest/function.failed system events.
    // Register additional Inngest functions here as the platform grows.
  ],
});

