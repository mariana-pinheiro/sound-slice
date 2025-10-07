const express = require('express');
const userController = require("../controllers/userController");
const requireAuth = require("../middleware/auth");
const mongoose = require("mongoose");

const router = express.Router();

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
router.post('/register', upload.single("profilePic"), userController.registerUser);
router.post('/login', userController.loginUser);

router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);

router.get('/me', requireAuth, userController.me);
router.post('/logout', requireAuth, userController.logout);
router.put('/update', requireAuth, upload.single("profilePic"), userController.updateUser);
router.get("/payments", requireAuth, userController.getUserPayments);
router.get("/reuses", requireAuth, userController.getUserReuses)

router.get("/profile-pic/:id", async (req, res) => {
  try {
    const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "profilePics",
    });

    const fileId = new mongoose.Types.ObjectId(req.params.id);
    gfs.openDownloadStream(fileId).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar imagem.");
  }
});

module.exports = router;
