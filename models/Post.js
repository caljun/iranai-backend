const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true },
  reason: { type: String, required: true, maxlength: 30 }, // 30文字制限追加
  category: {
    type: String,
    required: true,
    enum: ["使わん", "飽きた", "壊れた"] // 固定カテゴリ
  },
  email: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Post", PostSchema);
