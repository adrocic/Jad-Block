import { z } from "zod";

// Extensions (MV3 CSP) and Workers forbid eval. Without this, zod probes `new Function` and
// strict CSPs report a securitypolicyviolation even though the error is caught.
z.config({ jitless: true });

export * from "./classify";
export * from "./features";
