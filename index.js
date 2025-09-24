const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.json());
app.use(
  session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Mock Database (JSON files)
const dataDir = path.join(__dirname, 'data');
const usersFilePath = path.join(dataDir, 'users.json');
const adsFilePath = path.join(dataDir, 'ads.json');

const loadData = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
    return [];
  }
};

const saveData = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Ensure data directories and files exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
if (!fs.existsSync(usersFilePath)) {
  fs.writeFileSync(usersFilePath, '[]');
}
if (!fs.existsSync(adsFilePath)) {
  fs.writeFileSync(adsFilePath, '[]');
}
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

let users = loadData(usersFilePath);
let ads = loadData(adsFilePath);

// File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Routes
app.get('/', (req, res) => {
  res.redirect('/login');
});

// User Routes
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/register', (req, res) => {
  const { username, email, password, phone } = req.body;
  const userExists = users.find((u) => u.username === username || u.email === email);
  if (userExists) {
    return res.send('İstifadəçi adı və ya e-poçt artıq mövcuddur!');
  }
  const newUser = { id: users.length + 1, username, email, password, phone };
  users.push(newUser);
  saveData(usersFilePath, users);
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email && u.password === password);
  if (user) {
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/dashboard');
  } else {
    res.send('Yanlış e-poçt və ya şifrə');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/accountPage', isAuthenticated, (req, res) => {
  const user = users.find((u) => u.id === req.session.userId);
  if (!user) {
    return res.redirect('/logout');
  }
  res.sendFile(path.join(__dirname, 'public', 'accountPage.html'));
});

app.get('/me', isAuthenticated, (req, res) => {
  const user = users.find((u) => u.id === req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  res.json({ id: user.id, username: user.username, email: user.email, phone: user.phone });
});

app.post('/updateAccount', isAuthenticated, (req, res) => {
  const { username, email, phone, new_password, confirm_password } = req.body;
  const userIndex = users.findIndex((u) => u.id === req.session.userId);
  if (userIndex !== -1) {
    const user = users[userIndex];
    user.username = username;
    user.email = email;
    user.phone = phone;
    if (new_password) {
      if (new_password === confirm_password) {
        user.password = new_password;
      } else {
        return res.send('Yeni şifrələr uyğun gəlmir!');
      }
    }
    req.session.username = user.username;
    saveData(usersFilePath, users);
    res.redirect('/accountPage');
  } else {
    res.status(404).send('İstifadəçi tapılmadı.');
  }
});

// Ad and Page Routes
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/addAdPage', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'addAdPage.html'));
});

app.get('/myAdsPage', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'myAds.html'));
});

app.get('/editAd/:id', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'editAd.html'));
});

app.get('/ads/:adCode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ad.html'));
});

app.get('/filters', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'filters.html'));
});

app.get('/auction-winner/:adId', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auction-winner.html'));
});

// API Routes for Ads
app.get('/getUserAds', isAuthenticated, (req, res) => {
  const userAds = ads.filter((ad) => ad.userId === req.session.userId);
  res.json(userAds);
});

app.get('/getAds', (req, res) => {
  try {
    const filters = req.query;
    let filteredAds = loadData(adsFilePath);

    if (Object.keys(filters).length > 0) {
      filteredAds = filteredAds.filter((ad) => {
        let matches = true;
        for (const key in filters) {
          if (!filters[key]) continue;
          const filterValue = filters[key].toLowerCase();
          if (key === 'q') {
            if (!ad.title.toLowerCase().includes(filterValue) && !ad.description.toLowerCase().includes(filterValue)) {
              matches = false;
              break;
            }
          } else if (ad.properties && ad.properties[key] && ad.properties[key].toLowerCase() !== filterValue) {
            matches = false;
            break;
          } else if (ad[key] && ad[key].toLowerCase() !== filterValue) {
            matches = false;
            break;
          }
        }
        return matches;
      });
    }

    const formattedAds = filteredAds.map((ad) => {
      let priceText;
      if (ad.ad_type === 'auction') {
        priceText = ad.currentPrice ? `${ad.currentPrice} AZN (hərrac)` : 'Hərrac';
      } else {
        priceText = ad.currentPrice ? `${ad.currentPrice} AZN` : 'Qiymət göstərilməyib';
      }
      return { ...ad, priceDisplay: priceText };
    });

    res.json(formattedAds);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ads' });
  }
});

app.get('/getAd/:adCode', (req, res) => {
  const adCode = req.params.adCode;
  const ad = ads.find((a) => a.adCode === adCode);
  if (!ad) {
    return res.status(404).send('Elan tapılmadı');
  }

  const userId = req.session.userId;
  const isOwner = ad.userId === userId;
  const isAuctionEnded = ad.ad_type === 'auction' && ad.isEnded;
  const isWinner = isAuctionEnded && ad.bids.length > 0 && ad.bids[0].userId === userId;

  const responseData = {
    ...ad,
    isOwner,
    isWinner,
    isAuctionEnded,

  };

  if (ad.ad_type === 'fixed') {
      const seller = users.find(u => u.id === ad.userId);
      responseData.contactName = seller ? seller.username : 'Naməlum';
      responseData.contactPhone = seller ? seller.phone : null;
  } else if (ad.ad_type === 'auction' && isAuctionEnded) {
      if (isOwner) {
          const winner = users.find(u => u.id === ad.bids[0].userId);
          responseData.contactName = winner ? winner.username : 'Naməlum';
          responseData.contactPhone = winner ? winner.phone : null;
      } else if (isWinner) {
          const seller = users.find(u => u.id === ad.userId);
          responseData.contactName = seller ? seller.username : 'Naməlum';
          responseData.contactPhone = seller ? seller.phone : null;
      } else {
          responseData.contactName = null;
          responseData.contactPhone = null;
      }
  } else {
    responseData.contactName = null;
    responseData.contactPhone = null;
  }

  res.json(responseData);
});

app.get('/getBids/:adId', (req, res) => {
  const adId = parseInt(req.params.adId);
  const ad = ads.find((a) => a.id === adId);
  res.json(ad && ad.bids ? ad.bids : []);
});

app.post('/addAd', isAuthenticated, upload.single('image'), (req, res) => {
  const { title, description, category, subcategory, ad_type, startPrice, buyNowPrice, endTime } = req.body;

  const adCode = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const image = req.file ? req.file.filename : null;

  const currentPrice = ad_type === 'auction' ? parseFloat(startPrice) || 0 : parseFloat(buyNowPrice) || 0;

  const properties = {};
  for (const key in req.body) {
    if (!['title', 'description', 'category', 'subcategory', 'ad_type', 'startPrice', 'buyNowPrice', 'endTime', 'image'].includes(key)) {
      properties[key] = req.body[key];
    }
  }

  const user = users.find((u) => u.id === req.session.userId);

  const newAd = {
    id: ads.length > 0 ? ads[0].id + 1 : 1,
    title,
    description,
    category,
    subcategory,
    ad_type,
    currentPrice,
    startPrice: parseFloat(startPrice) || 0,
    buyNowPrice: parseFloat(buyNowPrice) || 0,
    endTime: ad_type === 'auction' ? new Date(endTime).getTime() : null,
    image,
    adCode,
    userId: req.session.userId,
    bids: [],
    properties,
    seller_info: user ? user.username : 'Naməlum',
    seller_phone: user ? user.phone : null,
    isEnded: false,
  };

  ads.unshift(newAd);
  saveData(adsFilePath, ads);
  res.redirect('/dashboard');
});

app.post('/updateAd/:id', isAuthenticated, upload.single('image'), (req, res) => {
  const adId = parseInt(req.params.id);
  const adIndex = ads.findIndex((ad) => ad.id === adId && ad.userId === req.session.userId);

  if (adIndex !== -1) {
    const ad = ads[adIndex];
    const { title, description, category, subcategory, ad_type, startPrice, buyNowPrice, endTime } = req.body;

    ad.title = title || ad.title;
    ad.description = description || ad.description;
    ad.category = category || ad.category;
    ad.subcategory = subcategory || ad.subcategory;
    ad.ad_type = ad_type || ad.ad_type;
    ad.startPrice = parseFloat(startPrice) || ad.startPrice;
    ad.buyNowPrice = parseFloat(buyNowPrice) || ad.buyNowPrice;
    ad.endTime = endTime || ad.endTime;
    if (ad.ad_type === 'auction' && endTime) {
        ad.endTime = new Date(endTime).getTime();
    }


    const properties = {};
    for (const key in req.body) {
      if (!['title', 'description', 'category', 'subcategory', 'ad_type', 'startPrice', 'buyNowPrice', 'endTime', 'image'].includes(key)) {
        properties[key] = req.body[key];
      }
    }
    ad.properties = properties;

    if (req.file) {
      if (ad.image) {
        const oldImagePath = path.join(uploadsDir, ad.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      ad.image = req.file.filename;
    }

    saveData(adsFilePath, ads);
    res.redirect('/myAdsPage');
  } else {
    res.status(404).send('Elan tapılmadı və ya sizə aid deyil.');
  }
});

app.delete('/deleteAd/:id', isAuthenticated, (req, res) => {
  const adId = parseInt(req.params.id);
  const adIndex = ads.findIndex((ad) => ad.id === adId && ad.userId === req.session.userId);
  if (adIndex !== -1) {
    const ad = ads[adIndex];
    if (ad.image) {
      const imagePath = path.join(uploadsDir, ad.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    ads.splice(adIndex, 1);
    saveData(adsFilePath, ads);
    res.sendStatus(200);
  } else {
    res.status(404).send('Elan tapılmadı və ya sizə aid deyil.');
  }
});

// Socket.io for live bidding
io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  if (!userId) {
      console.log('User ID not provided, connection rejected or ignored.');
      return;
  }
  console.log(`User ID connected: ${userId}`);

  socket.on('joinAdRoom', (adId) => {
    socket.join(adId);
    console.log(`User ${userId} joined room for ad ${adId}`);
  });

  socket.on('newBid', (data) => {
    const ad = ads.find((a) => a.id === data.adId);
    if (!ad || ad.ad_type !== 'auction' || ad.isEnded) {
      return socket.emit('bidError', { message: 'Ad not found or is not an auction.' });
    }
    if (data.amount <= ad.currentPrice) {
      return socket.emit('bidError', { message: 'Təklifiniz mövcud qiymətdən yüksək olmalıdır.' });
    }

    const user = users.find((u) => u.id == userId);
    if (!user) {
      return socket.emit('bidError', { message: 'Sessiya bitib, yenidən daxil olun.' });
    }

    ad.currentPrice = data.amount;
    const newBid = {
      userId: user.id,
      user: user.username,
      amount: data.amount,
      timestamp: Date.now(),
    };
    ad.bids.unshift(newBid);
    saveData(adsFilePath, ads);

    io.to(ad.id).emit('updateBid', { adId: ad.id, amount: ad.currentPrice, user: user.username });
  });

  socket.on('disconnect', () => {
    console.log(`User ${userId} disconnected`);
  });
});

// Auction timer
setInterval(() => {
  const now = Date.now();
  let adsUpdated = false;
  ads.forEach((ad) => {
    if (ad.ad_type === 'auction' && ad.endTime < now && !ad.isEnded) {
      ad.isEnded = true;
      adsUpdated = true;

      const winnerBid = ad.bids.length > 0 ? ad.bids[0] : null;
      const winnerId = winnerBid ? winnerBid.userId : null;

      const winnerUser = winnerId ? users.find((u) => u.id === winnerId) : null;
      const sellerUser = users.find((u) => u.id === ad.userId);

      if (winnerId) {
        console.log(`Auction for ad ${ad.id} ended. Winner is user ${winnerId}.`);
      }

      io.to(ad.id).emit('auctionEnded', {
        adId: ad.id,
        winnerId: winnerId,
        sellerInfo: sellerUser,
        winnerInfo: winnerUser,
      });
    }
  });

  if (adsUpdated) {
    saveData(adsFilePath, ads);
  }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));