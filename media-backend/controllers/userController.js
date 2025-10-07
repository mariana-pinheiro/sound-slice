// controllers/userController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const FRONTEND_URL = process.env.FRONTEND_URL;
const transporter = require('../config/mailer');
const mongoose = require("mongoose");

function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('auth', token, {
    httpOnly: true,
    sameSite: "none",
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    domain: 'localhost'
  });
}

// ---------- REGISTO ----------
const registerUser = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      dob,
      email,
      password,
      country,
      city,
      phone,
      ethWallet,
      acceptPayments,
      terms,
      privacy
    } = req.body;

    const termsBool = terms === "true" || terms === true;
    const privacyBool = privacy === "true" || privacy === true;
    const acceptPaymentsBool = acceptPayments === "true" || acceptPayments === true;

    if (!firstname || !lastname || !dob || !email || !password || !termsBool || !privacyBool) {
      return res.status(400).json({ error: "Campos obrigatórios em falta ou termos não aceites." });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Este email já está registado." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let profilePicId = null;

    if (req.file) {
      profilePicId = new mongoose.Types.ObjectId();

      const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: "profilePics",
      });

      await new Promise((resolve, reject) => {
        const uploadStream = gfs.openUploadStreamWithId(
          profilePicId,
          req.file.originalname,
          { contentType: req.file.mimetype }
        );

        uploadStream.end(req.file.buffer);
        uploadStream.on("finish", resolve);
        uploadStream.on("error", reject);
      });
    }

    const user = new User({
      firstname,
      lastname,
      dob,
      email,
      password: hashedPassword,
      country,
      city,
      phone,
      ethWallet,
      acceptPayments: acceptPaymentsBool,
      terms: termsBool,
      privacy: privacyBool,
      profilePic: profilePicId,
    });

    await user.save();
    res.status(201).json({ message: "Utilizador registado com sucesso!" });

  } catch (error) {
    console.error("Erro no registerUser:", error);
    res.status(500).json({ error: "Erro ao registar utilizador." });
  }
};

// ---------- LOGIN -------
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email e palavra‑passe são obrigatórios.' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Email ou palavra‑passe inválidos.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Email ou palavra‑passe inválidos.' });
    const token = jwt.sign(
      { id: user._id.toString(), firstname: user.firstname, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: 'Login bem-sucedido!',
      token,
      firstname: user.firstname,
      email: user.email
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao iniciar sessão.' });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();

    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    const base = process.env.BACKEND_URL || "http://localhost:3000";

    res.json({
      id: user._id,
      firstname: user.firstname,
      lastname: user.lastname,
      phone: user.phone || "",
      ethWallet: user.ethWallet || "",
      country: user.country || "",
      city: user.city || "",
      profilePic: user.profilePic
        ? `${base}/api/users/profile-pic/${user.profilePic}`
        : null,
    });
  } catch (err) {
    console.error("erro /me:", err);
    res.status(500).json({ error: "Erro a carregar perfil." });
  }
};

// ---------- LOGOUT ----------
const logout = (req, res) => {
  res.clearCookie('auth', { httpOnly: true, sameSite: 'lax', secure: false });
  res.json({ message: 'Sessão terminada.' });
};

// ----------RESET PASSWORD ----------
const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const user = await User.findOne({ email });

    if (user) {
      user.resetPasswordToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
      await user.save();

      const link = `${FRONTEND_URL}/reset-password.html?token=${user.resetPasswordToken}`;
      const info = await transporter.sendMail({
        to: user.email,
        subject: 'Redefinição de palavra‑passe',
        text: `Redefine aqui: ${link}`
      });
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log('📨 Preview URL:', preview);
    }

    res.json({ message: 'Se o email existir, enviámos instruções.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no pedido de reset.' });
  }
};


const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) return res.status(400).json({ error: 'Token inválido ou expirado.' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password atualizada com sucesso.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro a atualizar password.' });
  }
};


// ---------- UPDATE USER ----------
const updateUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = {};

    if (req.body.firstname) updates.firstname = req.body.firstname;
    if (req.body.lastname) updates.lastname = req.body.lastname;
    if (req.body.phone) updates.phone = req.body.phone;
    if (req.body.ethWallet) updates.ethWallet = req.body.ethWallet;
    if (req.body.country) updates.country = req.body.country;
    if (req.body.city) updates.city = req.body.city;

    if (req.file) {
      const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: "profilePics",
      });

      const profilePicId = new mongoose.Types.ObjectId();
      const uploadStream = gfs.openUploadStreamWithId(
        profilePicId,
        req.file.originalname,
        { contentType: req.file.mimetype }
      );
      uploadStream.end(req.file.buffer);

      updates.profilePic = profilePicId;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ error: "Utilizador não encontrado" });

    res.json({
      message: "Perfil atualizado com sucesso!",
      user: {
        id: updatedUser._id,
        firstname: updatedUser.firstname,
        lastname: updatedUser.lastname,
        phone: updatedUser.phone,
        email: updatedUser.email,
        ethWallet: updatedUser.ethWallet,
        country: updatedUser.country,
        city: updatedUser.city,
        profilePic: updatedUser.profilePic
          ? `/api/users/profile-pic/${updatedUser.profilePic}`
          : null,
      },
    });
  } catch (err) {
    console.error(" Erro ao atualizar perfil:", err);
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
};

const Payment = require("../models/Payment");
const Track = require("../models/Track");
const getUserPayments = async (req, res) => {
  try {
    const userId = req.user.id;

    const reusedTracks = await Track.find({
      user: userId,
      type: "reuse"
    })
      .populate({
        path: "reusedFrom",
        populate: { path: "user", select: "firstname lastname" },
        select: "title user metadata contractAddress"
      })
      .lean();

    const payments = reusedTracks.map(track => {
      const originalUser = track.reusedFrom?.user;
      const basePrice = track.reusedFrom?.metadata?.basePrice || 0;
      const percent = track.reusePercentage || 0;
      const valueEth = (basePrice * percent / 100).toFixed(4);

      return {
        date: track.createdAt,
        valueEth,
        direction: "out",
        counterparty: originalUser
          ? `${originalUser.firstname} ${originalUser.lastname}`
          : "Desconhecido",
        trackTitle: track.reusedFrom?.title || track.title || "—"
      };
    });

    res.json(payments);
  } catch (err) {
    console.error("Erro ao obter pagamentos:", err);
    res.status(500).json({ error: "Erro ao obter pagamentos" });
  }
};

// GET /api/users/reuses
const getUserReuses = async (req, res) => {
  try {
    const userId = req.user.id;

    const myReuses = await Track.find({
      user: userId,
      type: "reuse"
    })
      .populate({
        path: "reusedFrom",
        populate: {
          path: "user",
          model: "User",
          select: "firstname lastname"
        }
      })
      .lean();

    const myOriginals = await Track.find({
      user: userId,
      $or: [{ type: "original" }, { type: { $exists: false } }],
      totalReuses: { $gt: 0 }
    }).select("title totalReuses");

    const response = {
      reusedByOthers: myOriginals.map(t => ({
        title: t.title,
        totalReuses: t.totalReuses || 0
      })),

      myReuses: myReuses.map(r => ({
        title: r.title,
        originalTitle: r.reusedFrom?.title || "Desconhecida",
        ownerName: r.reusedFrom?.user
          ? `${r.reusedFrom.user.firstname} ${r.reusedFrom.user.lastname}`
          : "Desconhecido",
        percent: r.reusePercentage || r.metadata?.imaf?.percent || 0
      }))
    };

    res.json(response);
  } catch (err) {
    console.error("Erro ao obter reutilizações:", err);
    res.status(500).json({ error: "Erro ao obter reutilizações" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  me,
  logout,
  updateUser,
  getUserPayments,
  getUserReuses
};
