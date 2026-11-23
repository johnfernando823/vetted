# Vetted

The Vetted website: a home page for clients and a coach application form that saves answers to a Google Sheet.

| Page | File |
| --- | --- |
| Home | `index.html` |
| Coach application | `apply.html` |
| Settings (form link, client form link) | `assets/config.js` |
| Google Sheet connector | `apps-script/Code.gs` |

No client or coach data is stored in this repo. Applications go to the **Vetted Coach Applications** Google Sheet.

## Setup

### 1. Put the site online (GitHub Pages)
Repo **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`. Save. The site is served at **https://vettedtrain.com** (set by the `CNAME` file).

DNS at the domain registrar:

| Type | Host | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | johnfernando823.github.io |

Once DNS has spread, tick **Enforce HTTPS** on the Pages settings page.

### 2. Connect the application form to Google Sheets
1. Open the **Vetted Coach Applications** sheet in Google Drive.
2. **Extensions → Apps Script.** Delete the sample code, paste in everything from `apps-script/Code.gs`, and click **Save**.
3. **Deploy → New deployment.** Click the gear and choose **Web app**. Set *Execute as* to **Me** and *Who has access* to **Anyone**. Click **Deploy** and approve the permissions. Google warns that the app isn't verified: click **Advanced → Go to project**. It's your own script.
4. Copy the **Web app URL** (ends in `/exec`).
5. Paste it into `assets/config.js` as `formEndpoint`.

Each application becomes a row with status **New**, plus empty columns you fill in as you vet the coach: intro call, background check, certs, insurance, trial session.

If you change `Code.gs` later, go to **Deploy → Manage deployments → Edit → New version** so the live form uses the new code.

### 3. Link the "Find a coach" buttons
Put your client intake form link into `assets/config.js` as `clientFormUrl`.
