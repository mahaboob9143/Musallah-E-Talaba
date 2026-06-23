/**
 * Cloud Functions for Firebase — Musallah-E-Talaba
 * No active functions yet. setGlobalOptions configures defaults for future use.
 */

const { setGlobalOptions } = require("firebase-functions");

// Set max instances for cost control
setGlobalOptions({ maxInstances: 10 });
