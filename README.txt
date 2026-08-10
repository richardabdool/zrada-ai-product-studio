ZRADA AI Product Studio v2.1 — Server Key Edition

SECURITY CHANGE
- OpenAI API key is no longer stored in the browser.
- Add OPENAI_API_KEY as a secret Environment Variable in Render.
- Never put the API key in GitHub.

DEPLOY UPDATE
Upload these files to the existing GitHub repository, replacing the older files.
Render should auto-deploy after the GitHub commit.

RENDER SETUP
Environment > Add Environment Variable
Key: OPENAI_API_KEY
Value: your OpenAI API key
Save Changes

Then open Settings in the app and click Test Server Connection.

FAILED JOBS
The Generate Images button automatically retries jobs whose status is FAILED, so the product folder does not need to be uploaded again.
