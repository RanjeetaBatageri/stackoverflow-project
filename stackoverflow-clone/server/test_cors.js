import express from "express";
import cors from "cors";
import assert from "assert";

// Test suite for CORS configuration and preflight validation
const runCorsTests = async () => {
  console.log("=================================================");
  console.log("  RUNNING CORS PREFLIGHT & ORIGIN TEST SUITE     ");
  console.log("=================================================\n");

  const DEFAULT_ALLOWED_ORIGINS = [
    "https://stackoverflow-project-eosin.vercel.app",
    "http://localhost:3000",
  ];

  const envFrontend = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/+$/, "") : null;
  const allowedOrigins = envFrontend
    ? Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, envFrontend]))
    : DEFAULT_ALLOWED_ORIGINS;

  const corsOptions = {
    origin: (origin, callback) => {
      const normalizedOrigin = origin ? origin.replace(/\/+$/, "") : origin;
      if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin) || process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin ${origin} not allowed`));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "device-fingerprint"],
  };

  const app = express();
  app.use(cors(corsOptions));
  app.options(/(.*)/, cors(corsOptions));
  app.use(express.json());

  // Dummy routes representing the failing endpoints
  app.post("/user/login", (req, res) => res.json({ success: true, route: "login" }));
  app.post("/user/signup", (req, res) => res.json({ success: true, route: "signup" }));
  app.post("/user/forgot-password", (req, res) => res.json({ success: true, route: "forgot-password" }));
  app.get("/question/getallquestion", (req, res) => res.json({ success: true, route: "getallquestion" }));

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const routesToTest = [
    { method: "POST", path: "/user/login" },
    { method: "POST", path: "/user/signup" },
    { method: "POST", path: "/user/forgot-password" },
    { method: "GET", path: "/question/getallquestion" },
  ];

  const prodOrigin = "https://stackoverflow-project-eosin.vercel.app";
  const localOrigin = "http://localhost:3000";
  const disallowedOrigin = "https://malicious-site.com";

  try {
    // 1. Test OPTIONS preflight for each endpoint with Production Origin
    console.log("--- 1. Testing OPTIONS Preflight for Production Frontend ---");
    for (const route of routesToTest) {
      const res = await fetch(`${baseUrl}${route.path}`, {
        method: "OPTIONS",
        headers: {
          Origin: prodOrigin,
          "Access-Control-Request-Method": route.method,
          "Access-Control-Request-Headers": "Content-Type, Authorization, device-fingerprint",
        },
      });

      console.log(`[OPTIONS] ${route.path} -> Status: ${res.status}`);
      assert.strictEqual(res.status, 200, `Preflight status should be 200 for ${route.path}`);
      assert.strictEqual(
        res.headers.get("access-control-allow-origin"),
        prodOrigin,
        `Allow-Origin should match production origin exactly`
      );
      assert.strictEqual(
        res.headers.get("access-control-allow-credentials"),
        "true",
        "Credentials should be allowed"
      );
      const allowMethods = res.headers.get("access-control-allow-methods");
      assert.ok(allowMethods.includes(route.method), `Allow-Methods should include ${route.method}`);
      console.log(`  ✓ Passed: Origin allowed, credentials true, methods: ${allowMethods}`);
    }

    // 2. Test actual requests with Production Origin
    console.log("\n--- 2. Testing Actual Requests with Production Frontend Origin ---");
    const getRes = await fetch(`${baseUrl}/question/getallquestion`, {
      method: "GET",
      headers: {
        Origin: prodOrigin,
      },
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.headers.get("access-control-allow-origin"), prodOrigin);
    assert.strictEqual(getRes.headers.get("access-control-allow-credentials"), "true");
    console.log("✓ GET /question/getallquestion returned 200 with proper CORS headers");

    const postRes = await fetch(`${baseUrl}/user/login`, {
      method: "POST",
      headers: {
        Origin: prodOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    assert.strictEqual(postRes.status, 200);
    assert.strictEqual(postRes.headers.get("access-control-allow-origin"), prodOrigin);
    assert.strictEqual(postRes.headers.get("access-control-allow-credentials"), "true");
    console.log("✓ POST /user/login returned 200 with proper CORS headers");

    // 3. Test Local Development Origin (http://localhost:3000)
    console.log("\n--- 3. Testing Local Development Origin (http://localhost:3000) ---");
    const localPreflight = await fetch(`${baseUrl}/user/login`, {
      method: "OPTIONS",
      headers: {
        Origin: localOrigin,
        "Access-Control-Request-Method": "POST",
      },
    });
    assert.strictEqual(localPreflight.status, 200);
    assert.strictEqual(localPreflight.headers.get("access-control-allow-origin"), localOrigin);
    console.log("✓ Local development origin http://localhost:3000 is preserved and allowed");

    // 4. Test Disallowed Origin under production simulation (NODE_ENV=production)
    console.log("\n--- 4. Testing Disallowed Origin under NODE_ENV=production ---");
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const disallowedPreflight = await fetch(`${baseUrl}/user/login`, {
      method: "OPTIONS",
      headers: {
        Origin: disallowedOrigin,
        "Access-Control-Request-Method": "POST",
      },
    });
    // In Express cors, if origin is rejected via callback(new Error(...)), CORS headers are not set or 500 error returned
    assert.notStrictEqual(
      disallowedPreflight.headers.get("access-control-allow-origin"),
      disallowedOrigin,
      "Disallowed origin must NOT receive access-control-allow-origin header"
    );
    console.log("✓ Unauthorized origin https://malicious-site.com correctly rejected without CORS grant");

    process.env.NODE_ENV = originalEnv;

    console.log("\n=================================================");
    console.log("  ALL CORS TESTS PASSED SUCCESSFULLY!            ");
    console.log("=================================================");
  } finally {
    server.close();
  }
};

runCorsTests().catch((err) => {
  console.error("❌ CORS Test failure:", err);
  process.exit(1);
});
