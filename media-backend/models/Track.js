const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'uploads.files' },
  coverId: { type: mongoose.Schema.Types.ObjectId, ref: 'uploads.files' }, // GridFS
  metadata: { type: Object }, // JSON SC4M/IMAF
  contractAddress: { type: String }, // Ethereum
  createdAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originalOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  coholders: [
    {
      name: String,
      percentage: Number
    }
  ],
  reusedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Track' },
  reusePercentage: { type: Number },
  totalReuses: { type: Number, default: 0 },
  type: {
    type: String,
    enum: ["original", "reuse", "mix"],
    default: "original"
  }
}, { timestamps: true });

module.exports = mongoose.models.Track || mongoose.model("Track", trackSchema);

