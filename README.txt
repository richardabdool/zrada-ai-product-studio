ZRADA AI PRODUCT STUDIO v2 — WEB CATEGORY ENGINE
=================================================

WHY THIS VERSION
Windows Smart App Control was interfering with the local BAT/PowerShell editions.
This version is designed to run as a normal hosted website in Chrome/Edge, so staff do not run local scripts.

CATEGORY ENGINE
Women's Dress
Women's Top / Blouse
Women's Skirt
Women's Jeans
Women's Pants
Men's T-Shirt
Men's Polo / Shirt
Men's Jeans
Men's Pants / Shorts
Handbag — Lifestyle
Handbag — Product Only
Bra — Product Only
Panty — Product Only
Shoes / Slippers
Accessory — Product Only
Household — Product Only

Each category has separate:
- framing
- garment preservation rules
- model type
- neutral outfit instructions
- pose instructions
- background selection
- crop rules
- exact garment-length rules

STYLE CONSISTENCY
The first generated color for a style is automatically reused as the SECOND reference image for every later color in the same style.
This improves consistency of model identity, face, body shape, pose, background and lighting.

OPENAI
Uses the Image API edit endpoint:
POST /v1/images/edits
Default model: gpt-image-2
Default output: 1024x1536 high quality.

The API key is saved only in browser localStorage and sent to the web server only for the current API call.
For a hosted deployment, use HTTPS.

RUN LOCALLY (FOR A DEVELOPER)
Requires Node.js 20+:
npm start
Then open http://localhost:8787

DEPLOY
The included render.yaml is prepared for Render.
Any Node.js hosting service that runs `node server.js` will work.

IMPORTANT
This package is SOURCE for a hosted web application. Once hosted, the user only opens a URL and Windows Smart App Control is no longer involved.
