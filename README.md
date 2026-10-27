# East Africa Tourism Website

An Express website and API backed by MongoDB. The existing HTML pages are
copied into the MongoDB `pages` collection the first time the server starts,
then served from that collection. Booking requests and inquiry-chat messages
are saved in separate collections. CSS, JavaScript, and image files continue
to be served from the project directory.

## Run locally

1. Install and start MongoDB Community Server on this computer.
2. Copy `.env.example` to `.env`. Set `MONGODB_URI` and `MONGODB_DATABASE`
   there if your local MongoDB uses different settings.
3. From this project folder, run:

   ```powershell
   npm start
   ```

The website is available at `http://127.0.0.1:3000`. The API connects to
`mongodb://127.0.0.1:27017` and uses the `east_africa_tourism` database by
default. Check the connection at `http://127.0.0.1:3000/api/health`.

Page seeding only adds pages that do not already exist. Once a page is in
MongoDB, that database document is the served version; editing the local HTML
file later will not overwrite the saved page.

## API

The supported resources are `pages`, `destinations`, `tours`, `bookings`,
`customers`, and `inquiries`. Documents are flexible JSON objects.

The booking form writes documents with contact details, destination, traveler
count, dates, special requests, and a creation timestamp to `bookings`. The
server validates required booking details and returns a success confirmation
only after MongoDB accepts the insert; the booking page displays the server's
success or error response. The inquiry chat writes each question and its
response to `inquiries`. Page documents use `slug` (for example, `index.html`)
and `html`; they can be listed through the API and updated with
`PATCH /api/pages/{id}`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check the MongoDB connection |
| `GET` | `/api/{resource}?limit=20&skip=0` | List documents (limit 1-100) |
| `POST` | `/api/{resource}` | Create a document |
| `GET` | `/api/{resource}/{id}` | Get one document |
| `PATCH` | `/api/{resource}/{id}` | Update document fields |
| `DELETE` | `/api/{resource}/{id}` | Delete a document |

The API and website currently listen on `127.0.0.1` and do not include
authentication. Do not expose them to the public internet as-is. In particular,
editing the `pages` collection allows changing the HTML served to site visitors.

Example:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:3000/api/destinations `
    -ContentType "application/json" `
    -Body '{"name":"Serengeti National Park","country":"Tanzania"}'
  ```
