// backend/routes/pinata.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');

// Setup Multer to parse multipart/form-data
const upload = multer({ storage: multer.memoryStorage() });

router.post('/pin', upload.single('file'), async (req, res) => {
  try {
    const { jwt } = req.body;
    const file = req.file;

    const form = new FormData();
    form.append('file', file.buffer, file.originalname);

    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${jwt}`,
      },
    });

    res.json({ IpfsHash: response.data.IpfsHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
