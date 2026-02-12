# How to Get Your Equipment Booking Website Online

This guide will get your booking website live on the internet so students
can use it. It also sets up automatic emails when someone makes a booking.

You need three free services. Here's what they are in plain language:

  GITHUB = A website where your code is stored (like Google Drive but for code)
  VERCEL = A website that takes your code and turns it into a real website
  EMAILJS = A service that lets your website send emails

All three are free. You don't need a credit card.

You will do this ONCE. After that, the site just works.


================================================================================
PART 1: PUT YOUR CODE ON GITHUB
================================================================================

Think of this as uploading your project to the cloud so Vercel can find it.

STEP 1 - Make a GitHub account
  1. Open your browser
  2. Go to:  github.com
  3. Click the green "Sign up" button
  4. Enter your email, make a password, pick a username
  5. Complete the verification puzzle
  6. Check your email and click the verification link
  7. You now have a GitHub account. Stay logged in.

STEP 2 - Download "GitHub Desktop" (a program that uploads your code)
  1. Go to:  desktop.github.com
  2. Click "Download for macOS"
  3. Open the downloaded file and drag it to Applications
  4. Open GitHub Desktop from your Applications folder
  5. It will ask you to sign in - click "Sign in to GitHub.com"
  6. Your browser opens - click "Authorize desktop"
  7. Go back to the GitHub Desktop app. You're now signed in.

STEP 3 - Upload the booking project
  1. In GitHub Desktop, click the menu: File > Add Local Repository
  2. Click "Choose..." and navigate to:
       Desktop > CLAUDE CODE > equipment-booking
  3. Click "Open"
  4. A message says "This directory does not appear to be a Git repository"
  5. Click the blue link that says "create a repository"
  6. A form appears:
       - Name: equipment-booking  (should be filled in already)
       - Leave everything else as it is
  7. Click "Create Repository"
  8. Now click "Publish repository" (big blue button at the top)
  9. A popup appears:
       - Uncheck the box "Keep this code private" (so Vercel can see it)
       - Click "Publish Repository"
  10. Wait a few seconds. Done!

Your code is now on GitHub. You won't need to do this again.


================================================================================
PART 2: MAKE IT A REAL WEBSITE WITH VERCEL
================================================================================

Vercel reads your code from GitHub and turns it into a website with its
own address (URL) that anyone can visit.

STEP 1 - Make a Vercel account
  1. Go to:  vercel.com
  2. Click "Sign Up" (top right)
  3. Click "Continue with GitHub" (the easiest option)
  4. Your browser asks permission - click "Authorize Vercel"
  5. You're now on the Vercel dashboard.

STEP 2 - Create your website
  1. Click "Add New..." button (top right of the dashboard)
  2. Click "Project"
  3. You see a list of your GitHub repositories
  4. Find "equipment-booking" in the list
  5. Click the "Import" button next to it
  6. You see a "Configure Project" page
       - DON'T change anything. The defaults are correct.
  7. Click the "Deploy" button
  8. Wait 1-2 minutes. You'll see a progress bar.
  9. When it's done, you see "Congratulations!" and a preview of your site
  10. Your website address is shown at the top. It looks something like:
        equipment-booking-xxxx.vercel.app

  WRITE DOWN THIS ADDRESS. This is your live website!

  11. Click the address to open your site. It should show the booking tool!

If you open it and see the equipment list - Part 2 is done.
The site works, but emails don't work yet. That's Part 3.


================================================================================
PART 3: SET UP EMAIL SENDING WITH EMAILJS
================================================================================

Right now, when a student checks out, they can download a PDF but the
email doesn't send. This part fixes that.

EmailJS is a free service that sends emails from websites.
Free plan = 200 emails per month (more than enough for a school).


STEP 1 - Make an EmailJS account
  1. Go to:  emailjs.com
  2. Click "Sign Up" (top right corner)
  3. Easiest way: click "Sign up with Google" and use your Google account
     OR enter email + password manually
  4. You land on the EmailJS Dashboard


STEP 2 - Connect your email
  (This tells EmailJS which email address to send FROM)

  1. On the left side of the page, click "Email Services"
  2. Click "Add New Service"
  3. You see a list of email providers with logos. Pick yours:
       - If you have a Gmail:     click "Gmail"
       - If you use Outlook:      click "Outlook 365"
  4. A popup appears. Click "Connect Account"
  5. Sign in to your email when prompted
  6. Allow/authorize the permissions it asks for
  7. Back on the EmailJS page, you see the service is connected
  8. The "Name" field can be anything, like: Equipment Booking
  9. Click "Create Service"

  10. IMPORTANT: You now see your service in the list.
      Look at the column that says "Service ID"
      It looks something like:  service_abc1234

      COPY THIS and save it somewhere (like a note on your desktop).
      You'll need it later. This is your SERVICE ID.


STEP 3 - Create the email template
  (This is what the email looks like when someone makes a booking)

  1. On the left side, click "Email Templates"
  2. Click "Create New Template"
  3. You see an email editor. Fill it in like this:

     SUBJECT LINE (the top field):
     -------------------------------------------------------
     Equipment Booking - {{student_name}} ({{student_class}})
     -------------------------------------------------------

     The {{words}} are placeholders. They get replaced with real
     data when someone checks out. Don't change them.

  4. In the big text area (the email body), delete whatever is there
     and paste this EXACTLY:

     -------------------------------------------------------
     New Equipment Booking Request

     Student: {{student_name}}
     Class: {{student_class}}
     Rental Period: {{date_from}} to {{date_to}}
     Number of items: {{items_count}}

     Equipment List:
     {{items_list}}

     Total Price: {{total_price}}

     ---
     Sent from Molkom Equipment Booking System
     -------------------------------------------------------

  5. Now you need to set who receives the email.
     Look for a "To Email" field.
     Type in:  fredrik.fridlund@fhsregionvarmland.se

  6. Click "Save" (top right)

  7. IMPORTANT: You now see your template in the list.
     Look at the column that says "Template ID"
     It looks something like:  template_xyz5678

     COPY THIS and save it. This is your TEMPLATE ID.


STEP 4 - Find your Public Key
  1. Click on your account name or avatar (top right corner)
  2. Click "Account"
  3. You are now on the "General" tab
  4. Scroll down until you see "Public Key"
     It looks something like:  aBcDeFgHiJkLmN

     COPY THIS and save it. This is your PUBLIC KEY.


You should now have THREE codes saved:
  - Service ID    (from Step 2)    example: service_abc1234
  - Template ID   (from Step 3)    example: template_xyz5678
  - Public Key    (from Step 4)    example: aBcDeFgHiJkLmN


STEP 5 - Tell your website about these codes
  (This connects your website to EmailJS)

  1. Go to:  vercel.com
  2. Click on your "equipment-booking" project
  3. Click "Settings" (tab at the top of the page)
  4. On the left sidebar, click "Environment Variables"
  5. You see two text fields: "Key" and "Value"

  6. You need to add THREE entries. Do them one at a time:

     FIRST ENTRY:
       Key:    VITE_EMAILJS_SERVICE_ID
       Value:  (paste your Service ID here, e.g. service_abc1234)
       Click "Save"

     SECOND ENTRY:
       Key:    VITE_EMAILJS_TEMPLATE_ID
       Value:  (paste your Template ID here, e.g. template_xyz5678)
       Click "Save"

     THIRD ENTRY:
       Key:    VITE_EMAILJS_PUBLIC_KEY
       Value:  (paste your Public Key here, e.g. aBcDeFgHiJkLmN)
       Click "Save"

  7. Now the website needs to restart to pick up these codes.
     Click "Deployments" (tab at the top)
  8. You see a list of deployments. On the most recent one (the top one),
     click the three dots "..." on the right side
  9. Click "Redeploy"
  10. A popup appears. Click "Redeploy" again to confirm.
  11. Wait 1-2 minutes for it to rebuild.

  DONE! Your site now sends emails when students check out!


================================================================================
PART 4: ADD THE SITE TO MICROSOFT TEAMS
================================================================================

  1. Open Microsoft Teams
  2. Go to the Team/channel where students should see it
  3. At the top, next to the existing tabs, click the "+" button
  4. A popup appears. Search for "Website"
  5. Click "Website"
  6. Fill in:
       - Tab name:  Equipment Booking
       - URL:       (paste your Vercel URL, like equipment-booking-xxxx.vercel.app)
  7. Click "Save"

  A new tab appears. Students click it and the booking tool opens right
  inside Teams. It also works if they open the URL on their phone.


================================================================================
HOW TO UPDATE PRICES LATER
================================================================================

All equipment prices are in one file:
  equipment-booking/src/data/equipment.json

Open it in any text editor (TextEdit, VS Code, etc).
Each item looks like this:

  {
    "id": 1,
    "name": "Sony Venice 2",
    "category": "CAMERA",
    "description": "",
    "priceExclVat": 7500,
    "priceInclVat": 9375
  }

Change the numbers after "priceExclVat" and "priceInclVat".
Items with price 0 show "Price TBD" on the website.

After saving the file, upload the changes:
  1. Open GitHub Desktop
  2. It automatically shows what you changed
  3. At the bottom left, type a short note like "Updated prices"
  4. Click "Commit to main"
  5. Click "Push origin" (top bar)
  6. Vercel detects the change and rebuilds automatically (takes ~1 min)

Your website now shows the new prices!


================================================================================
IF SOMETHING ISN'T WORKING
================================================================================

"The website loads but emails don't send"
  - Go to vercel.com > your project > Settings > Environment Variables
  - Make sure all THREE variables are there and spelled exactly right
  - The keys must be EXACTLY: VITE_EMAILJS_SERVICE_ID,
    VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY
  - After fixing, go to Deployments and click Redeploy

"I get an error when clicking Send Booking"
  - Go to emailjs.com > Email Services
  - Make sure your email service shows as "Active" (green)
  - If it says "Inactive", click on it and reconnect your email

"Emails arrive but look wrong"
  - Go to emailjs.com > Email Templates
  - Make sure the {{placeholders}} are spelled exactly as shown above
  - The curly braces {{ }} must be double on both sides

"The site doesn't load in Teams"
  - Make sure the URL starts with https://
  - Try opening the URL in a normal browser tab first
  - If it works in the browser but not Teams, your school's Teams admin
    may need to allow external websites in tabs

"I need help"
  - Ask me (Claude) for help - just describe what you see and what went wrong
