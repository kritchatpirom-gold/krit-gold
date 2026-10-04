import { onRequestOptions as __api_jk_bill_js_onRequestOptions } from "/Users/krit/.gemini/antigravity/scratch/kritgold/functions/api/jk_bill.js"
import { onRequestPost as __api_jk_bill_js_onRequestPost } from "/Users/krit/.gemini/antigravity/scratch/kritgold/functions/api/jk_bill.js"
import { onRequestPost as __api_telegram_get_updates_js_onRequestPost } from "/Users/krit/.gemini/antigravity/scratch/kritgold/functions/api/telegram_get_updates.js"
import { onRequestPost as __api_telegram_notify_js_onRequestPost } from "/Users/krit/.gemini/antigravity/scratch/kritgold/functions/api/telegram_notify.js"
import { onRequest as __api_gold_js_onRequest } from "/Users/krit/.gemini/antigravity/scratch/kritgold/functions/api/gold.js"
import { onRequest as __api_xag_js_onRequest } from "/Users/krit/.gemini/antigravity/scratch/kritgold/functions/api/xag.js"

export const routes = [
    {
      routePath: "/api/jk_bill",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_jk_bill_js_onRequestOptions],
    },
  {
      routePath: "/api/jk_bill",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_jk_bill_js_onRequestPost],
    },
  {
      routePath: "/api/telegram_get_updates",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_telegram_get_updates_js_onRequestPost],
    },
  {
      routePath: "/api/telegram_notify",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_telegram_notify_js_onRequestPost],
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