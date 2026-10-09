import { loadEnvironment, readPort } from "@ok-family/service-kit";
import { createApp } from "./app.js";

loadEnvironment();
const app = await createApp();
await app.listen(readPort("COMMERCE_PORT", 4003), process.env.SERVICE_HOST ?? "127.0.0.1");
