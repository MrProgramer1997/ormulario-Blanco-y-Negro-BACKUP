import { createAutomaticHandler } from '../_shared/automatic-confirmation.mjs';
import { withBrowserCors } from '../_shared/browser-cors.mjs';
Deno.serve(withBrowserCors(createAutomaticHandler()));
