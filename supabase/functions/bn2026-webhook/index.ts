import { createHandler } from '../_shared/confirmation-handler.mjs';
import { withBrowserCors } from '../_shared/browser-cors.mjs';
Deno.serve(withBrowserCors(createHandler()));
