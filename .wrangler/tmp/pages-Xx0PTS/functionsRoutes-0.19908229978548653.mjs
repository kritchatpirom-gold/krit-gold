import { onRequestPost as __api_line_notify_js_onRequestPost } from "/Users/krit/.gemini/antigravity/scratch/kritgold/functions/api/line_notify.js"
import { onRequest as __api_gold_js_onRequest } from "/Users/krit/.gemini/antigravity/scratch/kritgold/functions/api/gold.js"
import { onRequest as __api_xag_js_onRequest } from "/Users/krit/.gemini/antigravity/scratch/kritgold/functions/api/xag.js"

export const routes = [
    {
      routePath: "/api/line_notify",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_line_notify_js_onRequestPost],
    },
  {
      routePath: "/api/gold",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_gold_js_onRequest],
    },
  {
      routePath: "/api/xag",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_xag_js_onRequest],
    },
  ]