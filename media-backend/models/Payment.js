// models/Payment.js
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  counterparty: { type: String, required: false },
  trackTitle: { type: String },
  valueEth: { type: String },
  direction: { type: String, enum: ["in", "out"], required: true },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Payment", paymentSchema);
