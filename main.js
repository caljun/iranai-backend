const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config();

const Post = require("./models/Post");
const Comment = require("./models/Comment");
const Notification = require("./models/Notification");
const User = require("./models/User");

const app = express();
///cors
app.use(cors({
  origin: "https://iranai-frontend.onrender.com",  // ←ここはあなたのフロントURLに合わせて
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json({limit: "5mb"}));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB接続成功"))
  .catch((err) => console.error("MongoDB接続失敗:", err));

function generateToken(email) {
  return jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "24h" });
}

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "トークンがありません" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "トークンが無効です" });
    req.user = decoded;
    next();
  });
}

// ユーザー登録
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashed }); // ← これが保存処理
    res.json({ token: generateToken(user.email) });
  } catch (err) {
    console.error("ユーザー登録エラー:", err);
    res.status(500).json({ message: "登録に失敗しました" });
  }
});

// ログイン（今回は簡略化）
app.post("/login", async (req, res) => {
  const { email } = req.body;
  res.json({ token: generateToken(email) });
});

// 投稿作成
app.post("/posts", verifyToken, async (req, res) => {
    try {
      const { name, image, reason, category } = req.body;
  
      // 必須チェック
      if (!name || !image || !reason || !category) {
        return res.status(400).json({ message: "全ての項目（name, image, reason, category）が必要です" });
      }
  
      const post = new Post({
        name,
        image,
        reason,
        category,
        email: req.user.email,
        createdAt: new Date()
      });
  
      const saved = await post.save();
      res.status(201).json({ message: "投稿が保存されました", post: saved });
    } catch (err) {
      console.error("投稿保存エラー:", err);
      res.status(500).json({ message: "投稿に失敗しました" });
    }
  });  

// 自分の投稿一覧取得
app.get("/posts/me", verifyToken, async (req, res) => {
  try {
    const posts = await Post.find({ email: req.user.email }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "取得に失敗しました" });
  }
});

// 投稿取得（詳細）
app.get("/posts/:id", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "投稿が見つかりません" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: "投稿取得エラー" });
  }
});

// 投稿削除
app.delete("/posts/:id", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "投稿が見つかりません" });
    if (post.email !== req.user.email)
      return res.status(403).json({ message: "削除権限がありません" });

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: "削除されました" });
  } catch (err) {
    res.status(500).json({ message: "削除に失敗しました" });
  }
});

// ✅ コメント取得
app.get("/posts/:id/comments", async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.id }).sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: "コメント取得に失敗しました" });
  }
});

// ✅ コメント投稿（唯一のPOSTルート、重複なし）
app.post("/posts/:id/comments", verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "コメント内容が必要です" });

    const newComment = new Comment({
      postId: req.params.id,
      text,
      email: req.user.email
    });

    const saved = await newComment.save();

    const post = await Post.findById(req.params.id);
    if (post && post.email !== req.user.email) {
      await Notification.create({
        toEmail: post.email,
        type: "コメント",
        postId: req.params.id,
        fromEmail: req.user.email
      });
    }

    res.status(201).json({ message: "コメントが保存されました", comment: saved });
  } catch (err) {
    console.error("コメント保存エラー:", err);
    res.status(500).json({ message: "コメント保存に失敗しました" });
  }
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`サーバー起動中：ポート ${PORT}`);
});

// 他人の投稿一覧を取得（/posts/user/:username）
app.get("/posts/user/:username", async (req, res) => {
    try {
      const email = `${req.params.username}@example.com`; // ユーザー登録形式と揃える
      const posts = await Post.find({ email }).sort({ createdAt: -1 });
      res.json(posts);
    } catch (err) {
      console.error("ユーザー投稿取得エラー:", err);
      res.status(500).json({ message: "ユーザー投稿取得エラー" });
    }
  });

// 他のルートの下に追加していく（例：app.delete("/posts/:id",...) のあと）

// 🔹 通知取得
app.get("/notifications/me", verifyToken, async (req, res) => {
    try {
      const notifications = await Notification.find({ toEmail: req.user.email })
        .sort({ createdAt: -1 })
        .populate("postId");
  
      res.json(notifications);
    } catch (err) {
      console.error("通知取得エラー:", err);
      res.status(500).json({ message: "通知の取得に失敗しました" });
    }
  });
  
// 🔹 通知作成
app.post("/notifications", verifyToken, async (req, res) => {
    const { toEmail, type, postId } = req.body;
  
    if (!toEmail || !type || !postId) {
      return res.status(400).json({ message: "必要な情報が不足しています" });
    }
  
    try {
      const newNotification = new Notification({
        toEmail,
        type,
        postId,
        fromEmail: req.user.email
      });
  
      const saved = await newNotification.save();
      res.status(201).json(saved);
    } catch (err) {
      console.error("通知作成エラー:", err);
      res.status(500).json({ message: "通知の保存に失敗しました" });
    }
  });

  // PUT: プロフィール画像を保存（変更）
app.put("/user/profile-image", verifyToken, async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ message: "画像がありません" });

  try {
    const user = await User.findOneAndUpdate(
      { email: req.user.email },
      { profileImage: image },
      { new: true }
    );
    res.json({ message: "保存しました", profileImage: user.profileImage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "保存失敗" });
  }
});

app.get("/posts/user-email/:email", async (req, res) => {
  try {
    const posts = await Post.find({ email: req.params.email }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error("ユーザー投稿取得エラー:", err);
    res.status(500).json({ message: "ユーザー投稿取得エラー" });
  }
});

// 🔹 プロフィール画像取得
app.get("/user/profile-image", verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ message: "ユーザーが見つかりません" });
    res.json({ profileImage: user.profileImage || null });
  } catch (err) {
    console.error("プロフィール画像取得エラー:", err);
    res.status(500).json({ message: "画像取得エラー" });
  }
});

// 🔹 プロフィール画像保存
app.put("/user/profile-image", verifyToken, async (req, res) => {
  try {
    const { image } = req.body;
    const updated = await User.findOneAndUpdate(
      { email: req.user.email },
      { profileImage: image },
      { new: true }
    );
    res.json({ success: true, profileImage: updated.profileImage });
  } catch (err) {
    console.error("プロフィール画像保存エラー:", err);
    res.status(500).json({ message: "画像保存エラー" });
  }
});

