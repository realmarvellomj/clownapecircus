# CLOWN APE CIRCUS — V3 DEPLOY PACKAGE

This version is designed to be deployable as a static frontend on Netlify with **Supabase as the real application backend**.

## What changed

### Cinematic opening
- Full-screen portrait intro video.
- The supplied 464×688 video is displayed with `object-fit: contain`, so it is not cropped.
- Red velvet-style curtains frame the video.
- A spotlight/vignette surrounds the ape.
- When the video ends, the curtains slide open and the main hero fades/zooms into place.
- Sound remains muted by default for browser autoplay compatibility; users can enable it.

### Whitepaper
The placeholder has been replaced with a polished community-first narrative:
- Lore
- Community philosophy
- Collection
- Utility
- Ecosystem
- Four-act roadmap
- Mint section for 10,000 CLOWN APES
- Uses "Ticket Fee" rather than "Mint Price"

### Applications
The forms now submit directly to Supabase:
- Join The Carcus
  - X username
  - EVM address
  - Comment link
  - X follow link
  - Worthiness quiz
- Collaboration
  - Community / Project Name
  - Community / Project Link
  - Average Entries
  - Alpha Call Link placeholder
  - Proof of Entries upload
  - Raid / Alpha call / Collab Tweet

### Ringmaster dashboard
`dashboard.html` is a real authenticated admin dashboard:
- Email/password login
- Admin-only access enforced by Supabase RLS
- Application counts
- Search/filter
- Open full application
- View private proof uploads through expiring signed URLs
- Approve
- Reject
- Internal Ringmaster notes

## DEPLOYMENT

### 1. Create Supabase project
Create a project at Supabase.

### 2. Run database setup
Open Supabase SQL Editor and run:

`supabase/schema.sql`

This creates:
- profiles
- applications
- roles
- RLS policies
- private proof storage bucket
- storage security policies
- user profile trigger

### 3. Enable Anonymous Sign-Ins
In Supabase Authentication settings, enable Anonymous Sign-Ins.

Applicants do NOT need to create an account. The site silently creates an anonymous Supabase session so their application and uploaded proof can be securely associated with a user ID.

### 4. Create the Ringmaster account
In Supabase Authentication > Users, create an email/password user for the person who will manage applications.

Copy that user's UUID.

Run:

`update public.profiles set role='admin' where id='YOUR-RINGMASTER-USER-UUID';`

The account can now access `/ringmaster`.

### 5. Configure the frontend
Open:

`config.js`

Replace:

`https://YOUR-PROJECT.supabase.co`

and:

`YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY`

with your Supabase project's URL and public anon/publishable key.

**Never put a service_role/secret key in config.js.**

### 6. Test locally
You can use any static server. For example:

`python -m http.server 8080`

Then open:

`http://localhost:8080`

### 7. Deploy to Netlify
Upload this entire folder or connect your Git repository.

No build command is required.

The included `netlify.toml`:
- publishes the root directory
- adds basic security headers
- makes `/ringmaster` point to the dashboard

### 8. Production checklist
Before announcing the site:
- Add your real Supabase URL/key.
- Create/promote the Ringmaster admin.
- Test both forms.
- Test a proof upload.
- Test approve/reject.
- Confirm non-admin accounts cannot access applications.
- Replace the TBA ticket fee/date with final mint information.
- Replace gallery placeholders with the final collection art.
- Replace/update the whitepaper copy as the project evolves.
- Add your final domain to Supabase Auth URL configuration if you use email auth.
- Consider adding CAPTCHA/rate limiting before public launch if application abuse becomes a concern.

## Security architecture

The browser uses only the Supabase public anon/publishable key.

RLS is the security boundary:
- applicants can insert their own applications
- applicants can see only their own applications
- admins can review/update all applications
- proof files are stored in a private bucket
- only admins can read proof files
- signed proof URLs expire after 10 minutes

The dashboard does NOT contain a client-side admin password. Admin authority comes from the Supabase `profiles.role` field and database RLS.

## Folder structure

clown-apes-circus-site-v3/
- index.html
- styles.css
- app.js
- config.js
- dashboard.html
- dashboard.css
- dashboard.js
- netlify.toml
- README.md
- supabase/schema.sql
- assets/carcus-intro.mp4
- assets/clown-ape-circus-logo.png
- assets/arc-mark.png


### Cinematic continuity detail
A still frame from the end of the supplied intro video is used as a subtle, darkened hero background. This makes the ape/spotlight feel like it carries through the curtain opening rather than cutting abruptly to a separate page.


## Backend & Deployment — Owner Checklist

The website has two separate parts:

1. **Netlify** hosts the public website.
2. **Supabase** is the backend: Auth, Postgres applications database, and private proof-file storage.

### A. Create the Supabase backend

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql` from this package.
3. In **Authentication → Providers**, enable **Anonymous Sign-Ins**.
4. In **Settings → API Keys**, copy:
   - Project URL
   - Publishable key (`sb_publishable_...`)
5. Put those values into `config.js`.
6. In **Authentication → Users**, create your Ringmaster email/password account.
7. Copy the Ringmaster user's UUID.
8. In SQL Editor run:

```sql
update public.profiles
set role = 'admin'
where id = 'YOUR-RINGMASTER-USER-UUID';
```

Do not put a Supabase secret key in `config.js`. Only the publishable key belongs in browser code. The database's Row Level Security is what protects the application records.

### B. How you access the backend

You will have two places:

**Supabase Dashboard** — this is the actual backend control panel.
Use it to:
- view the database
- view Auth users
- manage Storage
- run SQL
- inspect project logs/settings
- manage API keys

**Ringmaster Dashboard** — your website's private application interface:
- `/dashboard.html`
- log in with your Ringmaster email/password
- review Join and Collab applications
- open proof files
- approve/reject
- add internal notes

The browser never receives the Supabase secret key.

### C. Deploy the public website

The easiest first deployment is Netlify:

1. Create/log into a Netlify account.
2. Drag the `clown-apes-circus-site-v4` folder into Netlify's deploy area.
3. Netlify gives you a live `*.netlify.app` URL.
4. Test:
   - intro video
   - Join The Carcus form
   - Collab form
   - proof upload
   - Ringmaster login
   - approve/reject
5. Once testing is successful, connect your real domain under Netlify **Domain management**.

### D. Recommended production workflow

For ongoing development, put this folder in a private GitHub repository and connect the repository to Netlify. Then every approved change can be deployed through Git rather than manually dragging files.

### E. Before public launch

Test the complete flow with a real test application:

Visitor → anonymous Supabase account → application row → private proof upload → Ringmaster login → review → approve/reject.

Do not publish the website until that full test passes.

### Security note

Anonymous sign-ins are used only so applicants can submit without creating an account. Supabase treats anonymous users as authenticated for database access, so the RLS policies in `schema.sql` are important. The private proof bucket is not publicly readable; Ringmaster admins receive temporary signed links when reviewing a file.


## Join form — Quote Tweet
The Join The Circus form includes a required Quote Tweet Link under Comment Link. Applicants are instructed to quote-tweet the required Circus task post and paste their resulting X/Twitter status URL. The browser validates that the value is an X/Twitter status URL before submission, and the Ringmaster dashboard highlights the submitted quote tweet for review.

## Whitelist checker / Ringmaster whitelist

This version adds a public wallet checker at `#whitelist` and Ringmaster whitelist management in `dashboard.html`.

### Supabase
Run the **WHITELIST MANAGEMENT** SQL block appended to `supabase/schema.sql` in Supabase SQL Editor. It creates `whitelist_entries`, a public-safe `check_whitelist()` RPC, and admin-only add/revoke RPCs.

### Workflow
1. Applicant submits Join application.
2. Ringmaster reviews and approves the application.
3. Ringmaster can use **Add Wallet To Whitelist** directly from the approved applicant review, or add the wallet in Whitelist Management.
4. Applicant enters the same EVM wallet in the public checker.
5. If active, the site shows **YOU'RE IN!** and an X button prefilled with: `Hi, I have just been accepted to join the circus, @ClownApeCircus`
6. Revoking an entry immediately makes the public checker return not-whitelisted.

The public checker never receives the whitelist table or its wallet list; it only receives a boolean result for the wallet being checked.
