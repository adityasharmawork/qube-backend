// /**
//  * Welcome to Cloudflare Workers! This is your first worker.
//  *
//  * - Run `npm run dev` in your terminal to start a development server
//  * - Open a browser tab at http://localhost:8787/ to see your worker in action
//  * - Run `npm run deploy` to publish your worker
//  *
//  * Learn more at https://developers.cloudflare.com/workers/
//  */


// import QRCode from "qrcode-svg";

// export default {
// 	async fetch(request, env, ctx) {
// 		if(request.method === "POST") {
// 			return generateQRCode(request);
// 		}

// 		return new Response(landing, {
// 			headers: {
// 				"Content-Type": "text/html"
// 			},
// 		});
// 	},
// };

// async function generateQRCode(request) {
// 	const { text } = await request.json();
	
// 	const qr = new QRCode({content: text || "https://workers.dev"});

// 	return new Response(qr.svg(), {
// 		headers: {
// 			"Content-Type": "image/svg+xml"
// 		},
// 	});
// }


// const landing = `
// <h1>QR Generator</h1>
// <p>Click the below button to generate a new QR code. This will make a request to your Worker.</p>
// <input type="text" id="text" value="https://workers.dev"></input>
// <button onclick="generate()">Generate QR Code</button>
// <p>Generated QR Code Image</p>
// <img id="qr" src="#" />
// <script>
//   function generate() {
//     fetch(window.location.pathname, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ text: document.querySelector("#text").value })
//     })
//     .then(response => response.blob())
//     .then(blob => {
//       const reader = new FileReader();
//       reader.onloadend = function () {
//         document.querySelector("#qr").src = reader.result; // Update the image source with the newly generated QR code
//       }
//       reader.readAsDataURL(blob);
//     })
//   }
// </script>
// `;
















// import QRCode from "qrcode-svg";
// import { createRemoteJWKSet, jwtVerify } from "jose";

// export default {
//   async fetch(request, env, ctx) {
//     const url = new URL(request.url);
//     const path = url.pathname;

//     // --- 1. PUBLIC ROUTE: Redirect Service (/r/123) ---
//     // This must be fast and requires no auth.
//     if (request.method === "GET" && path.startsWith("/r/")) {
//       const shortId = path.split("/")[2];
//       const dataString = await env.QUBE_DB.get(shortId);

//       if (!dataString) return new Response("Link not found", { status: 404 });

//       // Parse the JSON because we now store more than just the URL
//       const data = JSON.parse(dataString); 
//       return Response.redirect(data.url, 302);
//     }

//     // --- 2. API ROUTER (Protected Routes) ---
//     // All routes below /api/ require Authentication
//     if (path.startsWith("/api/")) {
      
//       // A. Verify User Identity
//       const auth = await authenticateUser(request, env);
//       if (!auth.isValid) {
//         return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
//       }
//       const userId = auth.userId;

//       // B. Route: Create New QR (POST /api/qrcodes)
//       if (request.method === "POST" && path === "/api/qrcodes") {
//         return createQRCode(request, env, url.origin, userId);
//       }

//       // C. Route: Update Destination (PUT /api/qrcodes/:id)
//       if (request.method === "PUT" && path.startsWith("/api/qrcodes/")) {
//         const shortId = path.split("/")[3]; // Extract ID from URL
//         return updateQRCode(request, env, shortId, userId);
//       }
//     }

//     // Default 404
//     return new Response("Not Found", { status: 404 });
//   },
// };

// // --- HELPER: Authentication Logic ---
// async function authenticateUser(request, env) {
//   try {
//     const authHeader = request.headers.get("Authorization");
//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return { isValid: false };
//     }
//     const token = authHeader.split(" ")[1];

//     // Verify token against Clerk's Public Keys (JWKS)
//     // Replace logic below with your specific Clerk Issuer URL
//     const JWKS = createRemoteJWKSet(new URL(env.CLERK_JWKS_URL));
//     const { payload } = await jwtVerify(token, JWKS);

//     return { isValid: true, userId: payload.sub }; // 'sub' is the Clerk User ID
//   } catch (err) {
//     return { isValid: false }; // Token invalid or expired
//   }
// }

// // --- LOGIC: Create QR ---
// async function createQRCode(request, env, workerOrigin, userId) {
//   const { text } = await request.json();
//   const shortId = crypto.randomUUID().substring(0, 8);
//   const dynamicLink = `${workerOrigin}/r/${shortId}`;

//   // STORE DATA: We now save the URL *and* the Owner ID
//   const record = {
//     url: text,
//     owner: userId, // <--- This allows us to protect it later
//     createdAt: Date.now()
//   };

//   await env.QUBE_DB.put(shortId, JSON.stringify(record));

//   const qr = new QRCode({ content: dynamicLink, padding: 0, width: 256, height: 256 });

//   return new Response(JSON.stringify({
//     success: true,
//     short_id: shortId,
//     dynamic_url: dynamicLink,
//     qr_svg: qr.svg()
//   }), { headers: { "Content-Type": "application/json" } });
// }

// // --- LOGIC: Update QR ---
// async function updateQRCode(request, env, shortId, userId) {
//   const { newUrl } = await request.json();

//   // 1. Fetch existing record
//   const dataString = await env.QUBE_DB.get(shortId);
//   if (!dataString) return new Response("QR Code not found", { status: 404 });
  
//   const record = JSON.parse(dataString);

//   // 2. AUTHORIZATION CHECK: Does the requester own this QR?
//   if (record.owner !== userId) {
//     return new Response(JSON.stringify({ error: "Forbidden: You do not own this QR code" }), { status: 403 });
//   }

//   // 3. Update the record (preserve owner, update URL)
//   record.url = newUrl;
//   record.updatedAt = Date.now();

//   await env.QUBE_DB.put(shortId, JSON.stringify(record));

//   return new Response(JSON.stringify({ success: true, new_url: newUrl }), { 
//     headers: { "Content-Type": "application/json" } 
//   });
// }












import QRCode from "qrcode-svg";
import { createRemoteJWKSet, jwtVerify } from "jose";

// --- CONFIGURATION ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- 0. PREFLIGHT CHECKS ---
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // --- 1. PUBLIC REDIRECTS (The QR Code Logic) ---
    // This handles the raw "backend" link (fastest redirect)
    if (request.method === "GET" && path.startsWith("/r/")) {
      const shortId = path.split("/")[2];
      const record = await getQRRecord(env, shortId);
      if (!record) return new Response("Link not found", { status: 404 });
      return Response.redirect(record.url, 302);
    }

    // --- 2. PUBLIC RESOLVER (For Frontend Redirection) ---
    // Requirement #5: Allows frontend to ask "Where does 'abc' go?"
    if (request.method === "GET" && path.startsWith("/api/resolve/")) {
      const shortId = path.split("/")[3];
      const record = await getQRRecord(env, shortId);
      if (!record) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS_HEADERS });
      
      return new Response(JSON.stringify({ destination: record.url }), { 
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // --- 3. PROTECTED API ROUTES ---
    if (path.startsWith("/api/")) {
      const auth = await authenticateUser(request, env);
      if (!auth.isValid) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
      }
      const userId = auth.userId;

      // POST: Create QR
      if (request.method === "POST" && path === "/api/qrcodes") {
        return createQRCode(request, env, url.origin, userId);
      }

      // GET: List All QRs for User (Requirement #3)
      if (request.method === "GET" && path === "/api/qrcodes") {
        return listUserQRCodes(env, userId);
      }

      // PUT: Update QR
      if (request.method === "PUT" && path.startsWith("/api/qrcodes/")) {
        const shortId = path.split("/")[3];
        return updateQRCode(request, env, shortId, userId);
      }
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
};

// --- DATABASE HELPERS ---

async function getQRRecord(env, shortId) {
  const data = await env.QUBE_DB.get(`q:${shortId}`);
  return data ? JSON.parse(data) : null;
}

// --- CORE LOGIC ---

async function createQRCode(request, env, workerOrigin, userId) {
  const { text } = await request.json(); // 'text' is the destination URL
  const shortId = crypto.randomUUID().substring(0, 8);
  
  // NOTE: We use the backend URL for the QR image itself because it is reliable.
  // The frontend can display a "Friendly URL" to the user, but the QR points here.
  const backendLink = `${workerOrigin}/r/${shortId}`;

  const newRecord = {
    id: shortId,
    url: text,
    owner: userId,
    createdAt: Date.now(),
    visits: 0
  };

  // 1. Save the QR Record (Key = "q:abc")
  await env.QUBE_DB.put(`q:${shortId}`, JSON.stringify(newRecord));

  // 2. Add to User's Index (Key = "u:user_123")
  // We fetch the existing list, append the new one, and save it back.
  const userKey = `u:${userId}`;
  const existingListRaw = await env.QUBE_DB.get(userKey);
  const userList = existingListRaw ? JSON.parse(existingListRaw) : [];
  userList.unshift(newRecord); // Add to top
  await env.QUBE_DB.put(userKey, JSON.stringify(userList));

  // 3. Generate SVG
  const qr = new QRCode({ content: backendLink, padding: 0, width: 256, height: 256, color: "#000000", background: "#ffffff", ecl: "M" });

  return new Response(JSON.stringify({
    success: true,
    short_id: shortId,
    original_url: text, // Requirement #2
    dynamic_url: backendLink,
    qr_svg: qr.svg()
  }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

async function listUserQRCodes(env, userId) {
  const userKey = `u:${userId}`;
  const listRaw = await env.QUBE_DB.get(userKey);
  const list = listRaw ? JSON.parse(listRaw) : [];

  return new Response(JSON.stringify(list), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

async function updateQRCode(request, env, shortId, userId) {
  const { newUrl } = await request.json();
  
  // 1. Update the Main Record
  const record = await getQRRecord(env, shortId);
  if (!record) return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  if (record.owner !== userId) return new Response("Forbidden", { status: 403, headers: CORS_HEADERS });

  record.url = newUrl;
  record.updatedAt = Date.now();
  await env.QUBE_DB.put(`q:${shortId}`, JSON.stringify(record));

  // 2. Update the User Index (So the dashboard shows the new link)
  const userKey = `u:${userId}`;
  const listRaw = await env.QUBE_DB.get(userKey);
  let userList = listRaw ? JSON.parse(listRaw) : [];
  
  // Find and update the specific item in the array
  userList = userList.map(item => item.id === shortId ? { ...item, url: newUrl } : item);
  await env.QUBE_DB.put(userKey, JSON.stringify(userList));

  return new Response(JSON.stringify({ success: true, new_url: newUrl }), { 
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
  });
}

// --- AUTH HELPER ---
async function authenticateUser(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return { isValid: false };
    const token = authHeader.split(" ")[1];
    const JWKS = createRemoteJWKSet(new URL(env.CLERK_JWKS_URL));
    const { payload } = await jwtVerify(token, JWKS);
    return { isValid: true, userId: payload.sub };
  } catch (err) { return { isValid: false }; }
}
