import { createServer } from "./server.js";
import { sessionManager } from "./sessionManager.js";

const PORT = Number(process.env.PORT ?? 8787);

const app = createServer();
app.listen(PORT, () => {
  console.log(`[whatsapp-service] listening on :${PORT}`);
});

// Resume a previously-linked session automatically after a restart —
// see sessionManager.restoreIfSaved()'s own doc comment.
sessionManager.restoreIfSaved();
