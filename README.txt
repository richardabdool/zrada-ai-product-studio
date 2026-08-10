ZRADA AI PRODUCT STUDIO v2.2 — BULK CONSISTENCY ENGINE

WHAT THIS BUILD DOES
- Keeps OPENAI_API_KEY on the Render server. Never put the key in GitHub.
- Upload one parent folder containing multiple style folders.
- Detects each style folder and all color images inside it.
- Generates the first color of each style as its master reference.
- Reuses that generated reference for the remaining colors of the same style.
- Keeps category-specific rules for dresses, tops, skirts, jeans, pants, menswear, handbags, underwear, footwear and other products.
- Review, approve, regenerate or reject images.
- Exports all approved images as ONE real ZIP, organized into style folders.

RENDER
Environment variable: OPENAI_API_KEY = your OpenAI API key
Start command: npm start

UPDATE EXISTING GITHUB REPOSITORY
Upload/replace: server.js, package.json, render.yaml, README.txt and the entire public folder. Commit directly to main. Render should auto-deploy.

IMPORTANT
Do not upload your API key to GitHub or place it in any browser-side file.
