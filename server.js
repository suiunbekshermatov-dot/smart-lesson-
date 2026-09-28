const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const MASTER_ADMIN_PASS = process.env.ADMIN_KEY || 'admin2026';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней хранения

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const TEACHERS_FILE = path.join(__dirname, 'teachers.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function getTeachers() {
  if (!fs.existsSync(TEACHERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(TEACHERS_FILE, 'utf8'));
}

function saveTeachers(data) {
  fs.writeFileSync(TEACHERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Загрузка файлов до 150 МБ
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const teacherId = req.params.teacherId;
    const dir = path.join(UPLOADS_DIR, `teacher_${teacherId}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, Date.now() + '_' + safeName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 150 * 1024 * 1024 }
});

app.post('/api/upload/:teacherId', upload.array('files'), (req, res) => {
  res.json({ success: true, count: req.files ? req.files.length : 0 });
});

app.get('/api/files/:teacherId', (req, res) => {
  const teacherId = req.params.teacherId;
  const dir = path.join(UPLOADS_DIR, `teacher_${teacherId}`);
  if (!fs.existsSync(dir)) return res.json([]);

  const now = Date.now();
  const fileNames = fs.readdirSync(dir);
  const result = [];

  fileNames.forEach(fn => {
    const fPath = path.join(dir, fn);
    const stat = fs.statSync(fPath);

    if (now - stat.mtimeMs > ONE_WEEK_MS) {
      fs.unlinkSync(fPath);
    } else {
      const daysLeft = Math.max(1, Math.ceil((ONE_WEEK_MS - (now - stat.mtimeMs)) / (24 * 60 * 60 * 1000)));
      result.push({
        id: fn,
        name: fn.replace(/^\d+_/, ''),
        url: `/uploads/teacher_${teacherId}/${fn}`,
        size: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
        date: stat.mtime.toLocaleDateString(),
        daysLeft: daysLeft
      });
    }
  });

  res.json(result);
});

app.delete('/api/files/:teacherId/:fileName', (req, res) => {
  const { teacherId, fileName } = req.params;
  const filePath = path.join(UPLOADS_DIR, `teacher_${teacherId}`, fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.json({ success: true });
});

// Автоочистка диска каждые 6 часов
function autoCleanup() {
  const now = Date.now();
  if (!fs.existsSync(UPLOADS_DIR)) return;

  fs.readdirSync(UPLOADS_DIR).forEach(tDir => {
    const p = path.join(UPLOADS_DIR, tDir);
    if (fs.statSync(p).isDirectory()) {
      fs.readdirSync(p).forEach(f => {
        const fp = path.join(p, f);
        if (now - fs.statSync(fp).mtimeMs > ONE_WEEK_MS) {
          fs.unlinkSync(fp);
          console.log(`[Auto-Clean] Удален файл: ${f}`);
        }
      });
    }
  });
}
setInterval(autoCleanup, 6 * 60 * 60 * 1000);

// API для преподавателей и админа
app.get('/api/teachers', (req, res) => {
  const list = getTeachers().map(({ password, ...rest }) => rest);
  res.json(list);
});

app.post('/api/teacher/verify', (req, res) => {
  const { teacherId, password } = req.body;
  const teacher = getTeachers().find(t => t.id == teacherId);
  if (teacher && teacher.password === password) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Ката сыр сөз!' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { masterPassword } = req.body;
  if (masterPassword === MASTER_ADMIN_PASS) {
    res.json({ success: true, token: 'secret-admin-session' });
  } else {
    res.status(401).json({ error: 'Мастер-пароль туура эмес!' });
  }
});

app.get('/api/admin/teachers', (req, res) => {
  res.json(getTeachers());
});

app.post('/api/admin/teachers', (req, res) => {
  const { name, email, password } = req.body;
  const list = getTeachers();
  const newId = list.length > 0 ? Math.max(...list.map(t => t.id)) + 1 : 1;
  const newT = { id: newId, name, email, password };
  list.push(newT);
  saveTeachers(list);
  res.json({ success: true, teacher: newT });
});

app.put('/api/admin/teachers/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, email, password } = req.body;
  const list = getTeachers();
  const idx = list.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Мугалим табылган жок' });
  list[idx] = { ...list[idx], name, email, password };
  saveTeachers(list);
  res.json({ success: true, teacher: list[idx] });
});

app.delete('/api/admin/teachers/:id', (req, res) => {
  const id = parseInt(req.params.id);
  let list = getTeachers();
  list = list.filter(t => t.id !== id);
  saveTeachers(list);
  const dir = path.join(UPLOADS_DIR, `teacher_${id}`);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
