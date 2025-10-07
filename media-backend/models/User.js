const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  artistName: String,
  dob: Date,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  country: String,
  city: String,
  ethWallet: { type: String},
  profilePic: { type: mongoose.Schema.Types.ObjectId, ref: 'uploads.files' },
  acceptPayments: Boolean,
  terms: Boolean,
  privacy: Boolean,
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
