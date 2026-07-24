const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const uploadDir = process.env.CHAT_UPLOAD_PATH
  ? path.resolve(process.env.CHAT_UPLOAD_PATH)
  : path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_FORMATS = [
  {
    mime: 'image/jpeg',
    extension: '.jpg',
    matches: buffer => buffer.length >= 3
      && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  },
  {
    mime: 'image/png',
    extension: '.png',
    matches: buffer => buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  },
  {
    mime: 'image/gif',
    extension: '.gif',
    matches: buffer => buffer.length >= 6
      && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
  },
  {
    mime: 'image/webp',
    extension: '.webp',
    matches: buffer => buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  },
  {
    mime: 'image/bmp',
    extension: '.bmp',
    matches: buffer => buffer.length >= 2
      && buffer.subarray(0, 2).toString('ascii') === 'BM'
  }
];

function detectImageFormat(buffer) {
  return IMAGE_FORMATS.find(format => format.matches(buffer)) || null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

router.post('/', authMiddleware, (req, res) => {
  upload.single('image')(req, res, async (error) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '图片大小不能超过 10MB' });
      }
      return res.status(400).json({ error: '文件上传失败' });
    }
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的图片' });
    }

    const format = detectImageFormat(req.file.buffer);
    if (!format || req.file.mimetype !== format.mime) {
      return res.status(400).json({ error: '图片内容与声明格式不一致或格式不受支持' });
    }

    const filename = `${crypto.randomUUID()}${format.extension}`;
    const destination = path.join(uploadDir, filename);
    try {
      await fs.promises.writeFile(destination, req.file.buffer, { flag: 'wx' });
      res.status(201).json({
        message: '上传成功',
        fileUrl: `/uploads/${filename}`,
        filename
      });
    } catch (writeError) {
      console.error('保存上传文件错误:', writeError);
      res.status(500).json({ error: '文件保存失败' });
    }
  });
});

module.exports = router;
module.exports.detectImageFormat = detectImageFormat;
