import { loadEnvironment, readPort, serviceUrl } from "@ok-family/service-kit";
import { createApp } from "./app.js";

loadEnvironment();
const app = await createApp({
  catalogUrl: serviceUrl("CATALOG_SERVICE_URL", "http://127.0.0.1:4002"),
  authUrl: serviceUrl("AUTH_SERVICE_URL", "http://127.0.0.1:4001"),
  commerceUrl: serviceUrl("COMMERCE_SERVICE_URL", "http://127.0.0.1:4003"),
});
await app.listen(readPort("GATEWAY_PORT", 4000), process.env.SERVICE_HOST ?? "127.0.0.1");
