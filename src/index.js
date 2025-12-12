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
















import QRCode from "qrcode-svg";
import { createRemoteJWKSet, jwtVerify } from "jose";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- 1. PUBLIC ROUTE: Redirect Service (/r/123) ---
    // This must be fast and requires no auth.
    if (request.method === "GET" && path.startsWith("/r/")) {
      const shortId = path.split("/")[2];
      const dataString = await env.QUBE_DB.get(shortId);

      if (!dataString) return new Response("Link not found", { status: 404 });

      // Parse the JSON because we now store more than just the URL
      const data = JSON.parse(dataString); 
      return Response.redirect(data.url, 302);
    }

    // --- 2. API ROUTER (Protected Routes) ---
    // All routes below /api/ require Authentication
    if (path.startsWith("/api/")) {
      
      // A. Verify User Identity
      const auth = await authenticateUser(request, env);
      if (!auth.isValid) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      const userId = auth.userId;

      // B. Route: Create New QR (POST /api/qrcodes)
      if (request.method === "POST" && path === "/api/qrcodes") {
        return createQRCode(request, env, url.origin, userId);
      }

      // C. Route: Update Destination (PUT /api/qrcodes/:id)
      if (request.method === "PUT" && path.startsWith("/api/qrcodes/")) {
        const shortId = path.split("/")[3]; // Extract ID from URL
        return updateQRCode(request, env, shortId, userId);
      }
    }

    // Default 404
    return new Response("Not Found", { status: 404 });
  },
};

// --- HELPER: Authentication Logic ---
async function authenticateUser(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { isValid: false };
    }
    const token = authHeader.split(" ")[1];

    // Verify token against Clerk's Public Keys (JWKS)
    // Replace logic below with your specific Clerk Issuer URL
    const JWKS = createRemoteJWKSet(new URL(env.CLERK_JWKS_URL));
    const { payload } = await jwtVerify(token, JWKS);

    return { isValid: true, userId: payload.sub }; // 'sub' is the Clerk User ID
  } catch (err) {
    return { isValid: false }; // Token invalid or expired
  }
}

// --- LOGIC: Create QR ---
async function createQRCode(request, env, workerOrigin, userId) {
  const { text } = await request.json();
  const shortId = crypto.randomUUID().substring(0, 8);
  const dynamicLink = `${workerOrigin}/r/${shortId}`;

  // STORE DATA: We now save the URL *and* the Owner ID
  const record = {
    url: text,
    owner: userId, // <--- This allows us to protect it later
    createdAt: Date.now()
  };

  await env.QUBE_DB.put(shortId, JSON.stringify(record));

  const qr = new QRCode({ content: dynamicLink, padding: 0, width: 256, height: 256 });

  return new Response(JSON.stringify({
    success: true,
    short_id: shortId,
    dynamic_url: dynamicLink,
    qr_svg: qr.svg()
  }), { headers: { "Content-Type": "application/json" } });
}

// --- LOGIC: Update QR ---
async function updateQRCode(request, env, shortId, userId) {
  const { newUrl } = await request.json();

  // 1. Fetch existing record
  const dataString = await env.QUBE_DB.get(shortId);
  if (!dataString) return new Response("QR Code not found", { status: 404 });
  
  const record = JSON.parse(dataString);

  // 2. AUTHORIZATION CHECK: Does the requester own this QR?
  if (record.owner !== userId) {
    return new Response(JSON.stringify({ error: "Forbidden: You do not own this QR code" }), { status: 403 });
  }

  // 3. Update the record (preserve owner, update URL)
  record.url = newUrl;
  record.updatedAt = Date.now();

  await env.QUBE_DB.put(shortId, JSON.stringify(record));

  return new Response(JSON.stringify({ success: true, new_url: newUrl }), { 
    headers: { "Content-Type": "application/json" } 
  });
}
