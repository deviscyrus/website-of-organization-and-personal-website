require("dotenv").config();

const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("node:path");
const { readFile } = require("node:fs/promises");

const app = express();
const port = Number(process.env.PORT || 3000);
const host = "127.0.0.1";
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const databaseName = process.env.MONGODB_DATABASE || "east_africa_tourism";
const resources = new Set([
  "destinations",
  "tours",
  "bookings",
  "customers",
  "inquiries",
  "pages",
]);
const pageFiles = [
  "index.html",
  "services.html",
  "bookings.html",
  "moreinfo.html",
  "submission page.html",
];
const mongoClient = new MongoClient(mongoUri);

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getCollection(resource) {
  if (!resources.has(resource)) {
    throw new HttpError(404, "Resource not found");
  }
  return mongoClient.db(databaseName).collection(resource);
}

function validateDocument(document) {
  if (
    document === null ||
    typeof document !== "object" ||
    Array.isArray(document)
  ) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  if (Object.keys(document).length === 0) {
    throw new HttpError(400, "Request body must not be empty");
  }

  function validateKeys(value) {
    if (Array.isArray(value)) {
      value.forEach(validateKeys);
      return;
    }
    if (value === null || typeof value !== "object") {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if (
        key.startsWith("$") ||
        key.includes(".") ||
        ["__proto__", "constructor", "prototype"].includes(key)
      ) {
        throw new HttpError(400, `Invalid field name: ${key}`);
      }
      validateKeys(child);
    }
  }

  if (Object.hasOwn(document, "_id")) {
    throw new HttpError(400, "_id cannot be supplied");
  }
  validateKeys(document);
  return document;
}

function validateBooking(document) {
  const requiredTextFields = [
    ["fullName", "Full name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["destination", "Destination"],
    ["startDate", "Start date"],
    ["endDate", "End date"],
  ];

  for (const [field, label] of requiredTextFields) {
    if (typeof document[field] !== "string" || document[field].trim() === "") {
      throw new HttpError(400, `${label} is required`);
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.email)) {
    throw new HttpError(400, "Enter a valid email address");
  }
  if (!/^[0-9+\-()\s]{7,}$/.test(document.phone)) {
    throw new HttpError(400, "Enter a valid phone number");
  }
  if (!Number.isInteger(document.travelers) || document.travelers < 1) {
    throw new HttpError(400, "Number of travelers must be at least 1");
  }
  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  if (
    !isValidDate(document.startDate) ||
    !isValidDate(document.endDate) ||
    document.endDate < document.startDate
  ) {
    throw new HttpError(400, "Enter valid travel dates; the end date must not precede the start date");
  }

  return document;
}

function parseObjectId(id) {
  if (!ObjectId.isValid(id)) {
    throw new HttpError(400, "Invalid document ID");
  }
  return new ObjectId(id);
}

app.get("/api/health", async (request, response) => {
  await mongoClient.db(databaseName).command({ ping: 1 });
  response.json({ status: "ok", database: databaseName });
});

app.get("/api/:resource", async (request, response) => {
  const collection = getCollection(request.params.resource);
  const limit = request.query.limit === undefined ? 20 : Number(request.query.limit);
  const skip = request.query.skip === undefined ? 0 : Number(request.query.skip);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, "limit must be an integer between 1 and 100");
  }
  if (!Number.isInteger(skip) || skip < 0 || skip > 1000000) {
    throw new HttpError(400, "skip must be an integer between 0 and 1000000");
  }

  const [data, total] = await Promise.all([
    collection.find({}).sort({ _id: 1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(),
  ]);
  response.json({ data, total, limit, skip });
});

app.post("/api/:resource", async (request, response) => {
  const collection = getCollection(request.params.resource);
  const document = validateDocument(request.body);
  if (request.params.resource === "bookings") {
    validateBooking(document);
  }
  const result = await collection.insertOne(document);
  response.status(201).json({
    ...document,
    _id: result.insertedId,
    ...(request.params.resource === "bookings"
      ? { message: "Booking request saved successfully" }
      : {}),
  });
});

app.get("/api/:resource/:id", async (request, response) => {
  const collection = getCollection(request.params.resource);
  const document = await collection.findOne({
    _id: parseObjectId(request.params.id),
  });
  if (!document) {
    throw new HttpError(404, "Document not found");
  }
  response.json(document);
});

app.patch("/api/:resource/:id", async (request, response) => {
  const collection = getCollection(request.params.resource);
  const changes = validateDocument(request.body, true);
  const result = await collection.findOneAndUpdate(
    { _id: parseObjectId(request.params.id) },
    { $set: changes },
    { returnDocument: "after" },
  );
  if (!result) {
    throw new HttpError(404, "Document not found");
  }
  response.json(result);
});

app.delete("/api/:resource/:id", async (request, response) => {
  const collection = getCollection(request.params.resource);
  const result = await collection.deleteOne({
    _id: parseObjectId(request.params.id),
  });
  if (result.deletedCount === 0) {
    throw new HttpError(404, "Document not found");
  }
  response.status(204).end();
});

app.get("/", async (request, response) => {
  const page = await mongoClient
    .db(databaseName)
    .collection("pages")
    .findOne({ slug: "index.html" });
  if (!page) {
    throw new HttpError(404, "Page not found");
  }
  response.type("html").send(page.html);
});

app.get("/:page.html", async (request, response, next) => {
  const slug = `${request.params.page}.html`;
  if (!pageFiles.includes(slug)) {
    next();
    return;
  }

  const page = await mongoClient
    .db(databaseName)
    .collection("pages")
    .findOne({ slug });
  if (!page) {
    throw new HttpError(404, "Page not found");
  }
  response.type("html").send(page.html);
});

const staticFiles = express.static(__dirname, {
  dotfiles: "deny",
  index: false,
});

app.use((request, response, next) => {
  if (
    request.path === "/website.js" ||
    /\.(?:css|jpe?g|png|gif|svg|webp|ico)$/i.test(request.path)
  ) {
    staticFiles(request, response, next);
    return;
  }
  next();
});

app.use((request, response) => {
  response.status(404).json({ error: "Route not found" });
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Request failed:", error);
  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
  const message =
    status === 413
      ? "Request body is too large"
      : status === 400
        ? "Invalid JSON request"
        : "Internal server error";
  response
    .status(status)
    .json({ error: message });
});

async function start() {
  await mongoClient.connect();
  await mongoClient.db(databaseName).command({ ping: 1 });
  const pagesCollection = mongoClient.db(databaseName).collection("pages");
  for (const slug of pageFiles) {
    const html = await readFile(path.join(__dirname, slug), "utf8");
    await pagesCollection.updateOne(
      { slug },
      {
        $setOnInsert: {
          slug,
          html,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }
  app.listen(port, host, () => {
    console.log(`Tourism API listening at http://${host}:${port}`);
    console.log(`Connected to MongoDB database "${databaseName}"`);
    console.log("Website pages are served from the MongoDB pages collection");
  });
}

async function stop(signal) {
  console.log(`${signal} received; closing MongoDB connection`);
  await mongoClient.close();
  process.exit(0);
}

process.on("SIGINT", () => void stop("SIGINT"));
process.on("SIGTERM", () => void stop("SIGTERM"));

start().catch(async (error) => {
  console.error("Unable to start the API or connect to MongoDB:", error);
  await mongoClient.close();
  process.exitCode = 1;
});