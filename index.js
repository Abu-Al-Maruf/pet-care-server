const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mrrlkes.mongodb.net/pet-care?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db("pet-care").collection("services");
    const bookingCollection = client.db("pet-care").collection("bookings");

    // middleware for verify token

    const verifyToken = (req, res, next) => {
      const { token } = req.cookies;
      if (!token) {
        return res.status(401).send({ message: "unauthorize access" });
      }

      jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorize no access" });
        }

        req.user = decoded;
        next();
      });
    };

    //   get services

    // filtering by brand
    // http://localhost:5000/api/v1/services?brand=Feline Feast

    // sort by price
    //localhost:5000/api/v1/services?sortField=price&sortOrder=asc

    // pagination
    // localhost:5000/api/v1/services?page=1&limit=10

    app.get("/api/v1/services", async (req, res) => {
      const brand = req.query.brand;
      const sortField = req.query.sortField;
      const sortOrder = req.query.sortOrder;
      // pagination
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const skip = (page - 1) * limit;

      let query = {};
      let sortQuery = {};
      if (brand) {
        query.brand = brand;
      }
      if (sortField && sortOrder) {
        sortQuery[sortField] = sortOrder;
      }
      // total count for pagination
      const count = await serviceCollection.estimatedDocumentCount();

      const result = await serviceCollection
        .find(query)
        .skip(skip)
        .limit(limit)
        .sort(sortQuery)
        .toArray();
      res.send({ count, result });
    });

    // create booking
    app.post("/api/v1/user/create-booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);

      res.send(result);
    });

    // get bookings
    app.get("/api/v1/user/bookings", verifyToken, async (req, res) => {
      const userEmail = req.user?.email;
      const queryEmail = req.query?.email;
      if (queryEmail !== userEmail) {
        return res.status(403).send("forbidden access");
      }

      let query = {};
      if (queryEmail) {
        query.email = queryEmail;
      }

      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    //  jwt token related api
    app.post("/api/v1/auth/access-token", (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.SECRET_TOKEN, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    // cancel booking
    app.delete("/api/v1/user/cancel-booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Pet Care Server running...");
});

app.listen(port, () => {
  console.log(`Pet care listening on port ${port}`);
});
