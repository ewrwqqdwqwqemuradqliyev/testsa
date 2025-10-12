const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');

// ----------------------------------------------------------------------
// CLOUDINARY İNTEGRASYONU İÇİN YENİ KOD BAŞLANGICI
// ----------------------------------------------------------------------
const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// .env dosyasından değişkenleri yükle
dotenv.config();

// Cloudinary Konfigürasyonu
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
// ----------------------------------------------------------------------
// CLOUDINARY İNTEGRASYONU İÇİN YENİ KOD SONU
// ----------------------------------------------------------------------

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// QLOBAL DÜZELTME: Saat dilimi farkı (Azerbaycan için GMT+4, sadece bilgi için)
const TIMEZONE_OFFSET_MS = 4 * 60 * 60 * 1000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.json());
app.use(
  session({
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Mock Database (JSON files)
const dataDir = path.join(__dirname, 'data');
const usersFilePath = path.join(dataDir, 'users.json');
const adsFilePath = path.join(dataDir, 'ads.json');
const chatsFilePath = path.join(dataDir, 'chats.json');

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
if (!fs.existsSync(chatsFilePath)) {
  fs.writeFileSync(chatsFilePath, '[]');
}
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

let users = loadData(usersFilePath);
let ads = loadData(adsFilePath);
let chats = loadData(chatsFilePath);

// ----------------------------------------------------------------------
// File Uploads - Multer config
// ----------------------------------------------------------------------
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'elan_sayti_uploads',
    format: async (req, file) => 'jpg',
    public_id: (req, file) => `ad-${Date.now()}-${file.originalname.split('.')[0]}`
  },
});

const upload = multer({ storage: storage });
// ----------------------------------------------------------------------

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
  const { username, email, password } = req.body;
  const userExists = users.find((u) => u.username === username || u.email === email);
  if (userExists) {
    return res.send('Kullanıcı adı veya e-posta zaten mevcut!');
  }
  const newUser = { id: users.length > 0 ? users[users.length - 1].id + 1 : 1, username, email, password };
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
    res.send('Yanlış e-posta veya şifre');
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

app.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Kullanıcı oturumu açık değil' });
  }
  const user = users.find((u) => u.id === req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
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
        return res.send('Yeni şifreler eşleşmiyor!');
      }
    }
    req.session.username = user.username;
    saveData(usersFilePath, users);
    res.redirect('/accountPage');
  } else {
    res.status(404).send('Kullanıcı bulunamadı.');
  }
});

// Ad and Page Routes
app.get('/dashboard', (req, res) => {
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

app.get('/filters', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'filters.html'));
});

app.get('/auction-winner/:adId', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auction-winner.html'));
});

// Chat Routes
app.get('/chatlist', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chatlist.html'));
});

app.get('/chat/:recipientId/:adId', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
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
        priceText = ad.currentPrice ? `${ad.currentPrice} AZN (hârrac)` : 'Hârrac';
      } else {
        priceText = ad.currentPrice ? `${ad.currentPrice} AZN` : 'Fiyat belirtilmemiş';
      }
      return { ...ad, priceDisplay: priceText };
    });

    res.json(formattedAds);
  } catch (err) {
    res.status(500).json({ error: 'İlanlar alınamadı' });
  }
});

app.get('/getAd/:adCode', (req, res) => {
  const adCode = req.params.adCode;
  const ad = ads.find((a) => a.adCode === adCode);
  if (!ad) {
    return res.status(404).json({ error: 'İlan bulunamadı' });
  }

  const adData = { ...ad };
  if (ad.ad_type === 'auction' && req.session.userId !== ad.userId) {
    if (!ad.isEnded) {
      delete adData.seller_info;
      delete adData.seller_phone;
    }
  }
  res.json(adData);
});

app.get('/getAdById/:adId', isAuthenticated, (req, res) => {
  const adId = parseInt(req.params.adId);
  const ad = ads.find((a) => a.id === adId);
  if (!ad) {
    return res.status(404).json({ error: 'İlan bulunamadı.' });
  }
  res.json({ title: ad.title });
});

// addAd route
app.post('/addAd', isAuthenticated, upload.array('images', 5), (req, res) => {
  const { title, description, category, subcategory, ad_type, startPrice, buyNowPrice, endTime, seller_info, seller_phone } = req.body;

  const adCode = Date.now().toString(36) + Math.random().toString(36).substr(2);

  const images = req.files ? req.files.map(file => file.path) : [];

  const currentPrice = ad_type === 'auction' ? parseFloat(startPrice) || 0 : parseFloat(buyNowPrice) || 0;

  const properties = {};
  for (const key in req.body) {
    if (!['title', 'description', 'category', 'subcategory', 'ad_type', 'startPrice', 'buyNowPrice', 'endTime', 'images', 'seller_info', 'seller_phone'].includes(key)) {
      properties[key] = req.body[key];
    }
  }

  // DÜZELTME: endTime kontrolü ve varsayılan değer
  let finalEndTime = null;
  const now = Date.now();
  if (ad_type === 'auction' && endTime) {
    const parsedEndTime = new Date(endTime).getTime();
    // endTime gelecekte mi kontrolü
    if (isNaN(parsedEndTime) || parsedEndTime <= now) {
      console.warn('Geçersiz veya geçmiş endTime, varsayılan 5 dakika kullanılıyor:', endTime);
      finalEndTime = now + 5 * 60 * 1000; // Varsayılan: 5 dakika sonrası
    } else {
      finalEndTime = parsedEndTime; // Doğrudan kullan, ofset ekleme/çıkarma yok
    }
  } else if (ad_type === 'auction') {
    console.warn('endTime sağlanmadı, varsayılan 5 dakika kullanılıyor');
    finalEndTime = now + 5 * 60 * 1000; // Varsayılan: 5 dakika sonrası
  }
  console.log('Ham endTime:', endTime, 'İşlenmiş finalEndTime:', finalEndTime, 'Şu anki sunucu zamanı:', now, 'Sunucu zaman dilimi:', new Date().toString());

  const newAd = {
    id: ads.length > 0 ? Math.max(...ads.map(ad => ad.id)) + 1 : 1,
    title,
    description,
    category,
    subcategory,
    ad_type,
    currentPrice,
    startPrice: parseFloat(startPrice) || 0,
    buyNowPrice: parseFloat(buyNowPrice) || 0,
    endTime: finalEndTime,
    images,
    adCode,
    userId: req.session.userId,
    bids: [],
    properties,
    seller_info,
    seller_phone,
    isEnded: false,
  };
  ads.unshift(newAd);
  saveData(adsFilePath, ads);
  res.redirect('/dashboard');
});

// updateAd route
app.post('/updateAd/:id', isAuthenticated, upload.array('images', 5), async (req, res) => {
  const adId = parseInt(req.params.id);
  const adIndex = ads.findIndex((ad) => ad.id === adId && ad.userId === req.session.userId);

  if (adIndex !== -1) {
    const ad = ads[adIndex];
    const { title, description, category, subcategory, ad_type, startPrice, buyNowPrice, endTime, seller_info, seller_phone } = req.body;

    ad.title = title || ad.title;
    ad.description = description || ad.description;
    ad.category = category || ad.category;
    ad.subcategory = subcategory || ad.subcategory;
    ad.ad_type = ad_type || ad.ad_type;
    ad.seller_info = seller_info || ad.seller_info;
    ad.seller_phone = seller_phone || ad.seller_phone;

    ad.startPrice = parseFloat(startPrice) || ad.startPrice;
    ad.buyNowPrice = parseFloat(buyNowPrice) || ad.buyNowPrice;

    // DÜZELTME: endTime kontrolü ve varsayılan değer
    const now = Date.now();
    if (ad.ad_type === 'auction' && endTime) {
      const parsedEndTime = new Date(endTime).getTime();
      if (isNaN(parsedEndTime) || parsedEndTime <= now) {
        console.warn('Geçersiz veya geçmiş endTime, varsayılan 5 dakika kullanılıyor:', endTime);
        ad.endTime = now + 5 * 60 * 1000; // Varsayılan: 5 dakika sonrası
      } else {
        ad.endTime = parsedEndTime; // Doğrudan kullan, ofset ekleme/çıkarma yok
      }
    } else if (ad.ad_type === 'auction' && !endTime) {
      console.warn('endTime sağlanmadı, varsayılan 5 dakika kullanılıyor');
      ad.endTime = now + 5 * 60 * 1000; // Varsayılan: 5 dakika sonrası
    }
    console.log('Güncellenmiş endTime:', endTime, 'İşlenmiş ad.endTime:', ad.endTime, 'Şu anki sunucu zamanı:', now, 'Sunucu zaman dilimi:', new Date().toString());

    if (ad_type === 'auction') {
      ad.currentPrice = parseFloat(startPrice) || ad.currentPrice;
      delete ad.buyNowPrice;
    } else {
      ad.currentPrice = parseFloat(buyNowPrice) || ad.currentPrice;
      delete ad.startPrice;
    }

    const properties = {};
    for (const key in req.body) {
      if (!['title', 'description', 'category', 'subcategory', 'ad_type', 'startPrice', 'buyNowPrice', 'endTime', 'images', 'seller_info', 'seller_phone'].includes(key)) {
        properties[key] = req.body[key];
      }
    }
    ad.properties = properties;

    if (req.files && req.files.length > 0) {
      if (ad.images && Array.isArray(ad.images)) {
        for (const imagePath of ad.images) {
          try {
            const publicId = imagePath.split('/').slice(-2).join('/').split('.')[0];
            await cloudinary.uploader.destroy(publicId);
          } catch (error) {
            console.error('Cloudinary silme hatası (Update):', error);
          }
        }
      }
      ad.images = req.files.map(file => file.path);
    }

    saveData(adsFilePath, ads);
    res.redirect('/myAdsPage');
  } else {
    res.status(404).send('İlan bulunamadı veya size ait değil.');
  }
});

app.delete('/deleteAd/:id', isAuthenticated, async (req, res) => {
  const adId = parseInt(req.params.id);
  const adIndex = ads.findIndex((ad) => ad.id === adId && ad.userId === req.session.userId);
  if (adIndex !== -1) {
    const ad = ads[adIndex];

    if (ad.images && Array.isArray(ad.images)) {
      for (const imagePath of ad.images) {
        try {
          const publicId = imagePath.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (error) {
          console.error('Cloudinary silme hatası (Delete):', error);
        }
      }
    }

    ads.splice(adIndex, 1);
    saveData(adsFilePath, ads);
    res.sendStatus(200);
  } else {
    res.status(404).send('İlan bulunamadı veya size ait değil.');
  }
});

// Socket.io for live bidding and chat
io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  if (!userId) {
    console.log('Kullanıcı ID sağlanmadı, bağlantı reddedildi.');
    return;
  }
  console.log(`Kullanıcı ID bağlandı: ${userId}`);

  socket.on('joinAdRoom', (adId) => {
    socket.join(adId);
    console.log(`Kullanıcı ${userId} ilan odasına katıldı: ${adId}`);
  });

  socket.on('newBid', (data) => {
    const ad = ads.find((a) => a.id === data.adId);
    if (!ad || ad.ad_type !== 'auction' || ad.isEnded) {
      return socket.emit('bidError', { message: 'İlan bulunamadı veya hârrac değil.' });
    }
    if (data.amount <= ad.currentPrice) {
      return socket.emit('bidError', { message: 'Teklifiniz mevcut fiyattan yüksek olmalı.' });
    }

    const user = users.find((u) => u.id == userId);
    if (!user) {
      return socket.emit('bidError', { message: 'Oturum kapandı, tekrar giriş yapın.' });
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

  socket.on('joinChatRoom', ({ recipientId, adId }) => {
    const chatRoomId = [parseInt(userId), parseInt(recipientId), adId].sort((a, b) => a - b).join('_');
    socket.join(chatRoomId);
    console.log(`Kullanıcı ${userId} sohbet odasına katıldı: ${chatRoomId}`);
  });

  socket.on('sendMessage', (data) => {
    const { recipientId, message, adId } = data;
    const senderId = parseInt(userId);
    const numericRecipientId = parseInt(recipientId);
    const numericAdId = parseInt(adId);

    if (senderId === numericRecipientId) {
      return socket.emit('chatError', { message: 'Kendinize mesaj gönderemezsiniz.' });
    }

    const chatRoomId = [senderId, numericRecipientId, numericAdId].sort((a, b) => a - b).join('_');

    const ad = ads.find(a => a.id === numericAdId);
    const sender = users.find(u => u.id === senderId);
    const recipient = users.find(u => u.id === numericRecipientId);

    if (!sender || !recipient || !ad) {
      return socket.emit('chatError', { message: 'Sohbet başlatılamadı.' });
    }

    let existingChat = chats.find(
      (c) =>
        c.adId === numericAdId &&
        ((c.senderId === senderId && c.recipientId === numericRecipientId) ||
         (c.senderId === numericRecipientId && c.recipientId === senderId))
    );

    if (!existingChat) {
      existingChat = {
        id: chats.length > 0 ? chats[chats.length - 1].id + 1 : 1,
        adId: numericAdId,
        adTitle: ad.title,
        senderId: senderId,
        recipientId: numericRecipientId,
        messages: [],
      };
      chats.push(existingChat);
    }

    const newMessage = {
      senderId: senderId,
      message: message,
      timestamp: Date.now(),
      adId: numericAdId
    };

    existingChat.messages.push(newMessage);

    saveData(chatsFilePath, chats);

    socket.to(chatRoomId).emit('newMessage', newMessage);
  });

  socket.on('disconnect', () => {
    console.log(`Kullanıcı ${userId} bağlantıyı kesti`);
  });
});

// API Routes for Chat
app.get('/api/chats', isAuthenticated, (req, res) => {
  const userId = req.session.userId;
  const userChats = chats.filter(c => c.senderId === userId || c.recipientId === userId);

  const chatList = userChats.map(chat => {
    const otherUserId = chat.senderId === userId ? chat.recipientId : chat.senderId;
    const otherUser = users.find(u => u.id === otherUserId);
    const ad = ads.find(a => a.id === chat.adId);

    if (!otherUser || !ad) return null;

    const lastMessage = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;

    return {
      recipientId: otherUser.id,
      recipientName: otherUser.username,
      adId: chat.adId,
      adTitle: ad.title,
      lastMessage: lastMessage ? lastMessage.message : 'Henüz mesaj yok',
      timestamp: lastMessage ? lastMessage.timestamp : null
    };
  }).filter(Boolean).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  res.json(chatList);
});

app.get('/api/chats/:recipientId/:adId', isAuthenticated, (req, res) => {
  const userId = req.session.userId;
  const recipientId = parseInt(req.params.recipientId);
  const adId = parseInt(req.params.adId);

  if (isNaN(recipientId) || isNaN(adId)) {
    return res.status(400).json({ error: 'Geçersiz alıcı veya ilan ID' });
  }

  const chat = chats.find(
    (c) =>
      c.adId === adId &&
      ((c.senderId === userId && c.recipientId === recipientId) ||
       (c.senderId === recipientId && c.recipientId === userId))
  );

  if (!chat) {
    return res.json({ messages: [] });
  }
  res.json({ messages: chat.messages });
});

app.get('/api/user/:userId', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.userId));
  if (user) {
    res.json({ username: user.username });
  } else {
    res.status(404).send('Kullanıcı bulunamadı.');
  }
});

// Auction timer
setInterval(() => {
  const now = Date.now();
  let adsUpdated = false;
  ads.forEach((ad) => {
    if (ad.ad_type === 'auction' && ad.endTime && ad.endTime < now && !ad.isEnded) {
      ad.isEnded = true;
      adsUpdated = true;

      const winnerBid = ad.bids.length > 0 ? ad.bids[0] : null;
      const winnerId = winnerBid ? winnerBid.userId : null;

      const winnerUser = winnerId ? users.find((u) => u.id === winnerId) : null;
      const sellerUser = users.find((u) => u.id === ad.userId);

      if (winnerId) {
        console.log(`Hârrac bitti. İlan ID: ${ad.id}, Kazanan: ${winnerUser.username}`);
      } else {
        console.log(`Hârrac bitti. İlan ID: ${ad.id}, Kazanan yok.`);
      }
    }
  });

  if (adsUpdated) {
    saveData(adsFilePath, ads);
    io.emit('adsUpdated');
  }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor`));
