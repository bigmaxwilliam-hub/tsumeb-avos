# Tsumeb Avos — Order & Admin Web App

A simple web app for taking avocado orders and managing them from a password-protected admin page. Built with **Cloudflare Workers**, **Cloudflare D1 (SQLite)**, and plain HTML/JavaScript.

- **Live Order Page:** https://avocado-orders.bigmaxwilliam.workers.dev
- **Live Admin Dashboard:** https://avocado-orders.bigmaxwilliam.workers.dev/admin

---

## Project Files

- `public/index.html` — The public order form for customers (N$15 per avocado / N$150 per bag of 10).
- `public/admin/index.html` — The password-protected admin dashboard (view orders, switch the store between **Open** and **Waitlist**, mark orders as **Paid** or **Delivered**, and download CSV).
- `src/index.js` — The Cloudflare Worker backend that saves orders, generates daily reference codes (like `F027`), checks the admin password, and exports CSV files.
- `schema.sql` — The SQLite database table definitions (`orders` and `settings`).
- `wrangler.jsonc` — The Cloudflare Worker configuration file.

---

## 1. How to Run the App Locally

1. Open a terminal in this project folder (`C:\Users\Max\Desktop\tsumeb-avos`).
2. Make sure the local database tables exist (you only need to run this once):
   ```powershell
   npx.cmd wrangler d1 execute avocado-orders --local --file=schema.sql
   ```
3. Make sure you have a file named `.dev.vars` in the folder containing your local test password:
   ```ini
   ADMIN_PASSWORD=test1234
   ```
   *(This file is listed in `.gitignore`, so it is never uploaded to GitHub.)*
4. Start the local server:
   ```powershell
   npx.cmd wrangler dev
   ```
5. Open your browser:
   - **Public form:** http://127.0.0.1:8787
   - **Admin page:** http://127.0.0.1:8787/admin (log in with username `admin` and password `test1234`)
6. Press `Ctrl + C` in the terminal when you want to stop the local server.

---

## 2. How to Deploy a Change

Whenever you edit the HTML pages or Worker code and want to publish your changes live:

1. **(Optional)** Save your changes to GitHub first:
   ```powershell
   git add -A
   git commit -m "Describe your change here"
   git push origin main
   ```
2. Deploy to Cloudflare:
   ```powershell
   npx.cmd wrangler deploy
   ```
3. If you ever want to change your live admin password on Cloudflare, run:
   ```powershell
   npx.cmd wrangler secret put ADMIN_PASSWORD
   ```
   Then type your new password and press **Enter**.

---

## 3. How to Manage & Download the Orders

1. Open the live Admin Dashboard: https://avocado-orders.bigmaxwilliam.workers.dev/admin
2. Enter the username `admin` and your `ADMIN_PASSWORD`.
3. From the Admin Dashboard you can:
   - **Switch between Open and Waitlist:** Use the **Open / Waitlist** toggle at the top right to control whether customers on the public page can place confirmed orders or join the priority waitlist.
   - **Update Order Status:**
     - Click **Mark Paid** once a customer has paid. The order will stay marked as **Paid**.
     - Click **Delivered** to toggle delivery on or off. Once an order is both **Paid** and **Delivered**, it automatically moves under **Order completed**.
   - **Download Orders for Excel:** Click the green **Download CSV** button in the top right corner. This downloads `tsumeb-avos-orders.csv`, which you can double-click to open directly in Microsoft Excel.
