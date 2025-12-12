/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */


import QRCode from "qrcode-svg";

export default {
	async fetch(request, env, ctx) {
		if(request.method === "POST") {
			return generateQRCode(request);
		}

		return new Response(landing, {
			headers: {
				"Content-Type": "text/html"
			},
		});
	},
};

async function generateQRCode(request) {
	const { text } = await request.json();
	
	const qr = new QRCode({content: text || "https://workers.dev"});

	return new Response(qr.svg(), {
		headers: {
			"Content-Type": "image/svg+xml"
		},
	});
}


const landing = `
<h1>QR Generator</h1>
<p>Click the below button to generate a new QR code. This will make a request to your Worker.</p>
<input type="text" id="text" value="https://workers.dev"></input>
<button onclick="generate()">Generate QR Code</button>
<p>Generated QR Code Image</p>
<img id="qr" src="#" />
<script>
  function generate() {
    fetch(window.location.pathname, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: document.querySelector("#text").value })
    })
    .then(response => response.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onloadend = function () {
        document.querySelector("#qr").src = reader.result; // Update the image source with the newly generated QR code
      }
      reader.readAsDataURL(blob);
    })
  }
</script>
`;