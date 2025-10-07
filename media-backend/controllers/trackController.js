const Track = require('../models/Track');

const addTrack = async (req, res) => {
  try {
    const { title, artist } = req.body;

    const track = await Track.create({
      title,
      artist,
      filePath: req.file ? req.file.path : undefined,
      user: req.user.id
    });

    res.status(201).json({ message: 'Música adicionada!', track });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar música.' });
  }
};

const getMyTracks = async (req, res) => {
  try {
    const tracks = await Track.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(tracks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar músicas.' });
  }
};

module.exports = { addTrack, getMyTracks };