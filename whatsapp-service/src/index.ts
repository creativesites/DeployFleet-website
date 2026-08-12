import { createServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 8787);

const app = createServer();
app.listen(PORT, () => {
  console.log(`[whatsapp-service] listening on :${PORT}`);
});
