const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  toEmail: { type: String, required: true },         // 通知の宛先
  type: { type: String, required: true },            // 通知の種類（like, comment, want など）
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" }, // 関連する投稿
  fromEmail: { type: String },                       // 通知を送ったユーザー
  createdAt: { type: Date, default: Date.now }       // 作成日時
});

module.exports = mongoose.model("Notification", notificationSchema);
