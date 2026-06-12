import { onRequest as __api_gold_js_onRequest } from "c:\\Users\\Fischer\\krit-gold\\functions\\api\\gold.js"
import { onRequest as __api_xag_js_onRequest } from "c:\\Users\\Fischer\\krit-gold\\functions\\api\\xag.js"

export const routes = [
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