const express = require("express");
const app = express();
const port = 8080;
const mongoose = require("mongoose");
const csv = require("csv-parser");
const fs = require("fs");
const multer = require("multer");
const bodyParser = require("body-parser");
const Trade = require("./models/trade");

const upload = multer({ dest: "uploads/" });
app.use(bodyParser.json());

main()
  .then(() => {
    console.log("DB is connected");
  })
  .catch((err) => {
    console.log(err);
  });

// DB connection function
async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/cryptoTrade", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

// ------------------Task 1--------------------
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => {
      const [baseCoin, quoteCoin] = data.Market.split("/");
      results.push({
        utcTime: new Date(data.UTC_Time),
        operation: data.Operation,
        baseCoin,
        quoteCoin,
        amount: parseFloat(data["Buy/Sell Amount"]),
        price: parseFloat(data.Price),
      });
    })
    .on("end", () => {
      Trade.insertMany(results)
        .then(() => {
          fs.unlinkSync(req.file.path); // Remove file after processing
          res.status(200).send("File uploaded and data saved.");
        })
        .catch((error) => {
          res.status(500).send("Error saving data to database.");
        });
    });
});

// -------------------Task 2-----------------------
app.post("/balance", async (req, res) => {
  const { timestamp } = req.body;
  const queryTime = new Date(timestamp);

  try {
    const trades = await Trade.find({ utcTime: { $lte: queryTime } });
    const balances = {};

    trades.forEach((trade) => {
      const { baseCoin, amount, operation } = trade;
      if (!balances[baseCoin]) {
        balances[baseCoin] = 0;
      }
      if (operation.toLowerCase() === "buy") {
        balances[baseCoin] += amount;
      } else if (operation.toLowerCase() === "sell") {
        balances[baseCoin] -= amount;
      }
    });

    res.status(200).json(balances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, (req, res) => {
  console.log(`server is listning to port ${port}`);
});
