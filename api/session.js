import mongoose from "mongoose";

// 🔥 Simple schema (adjust if you already have one)
const SessionSchema = new mongoose.Schema({}, { strict: false });
const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);
console.log("MONGO_URI:", process.env.MONGO_URI);
// 🔥 DB connect
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
};

export default async function handler(req, res) {
  await connectDB();

  if (req.method === "POST") {
    try {
      const session = new Session(req.body);
      await session.save();
      res.status(200).json({ id: session._id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "GET") {
    try {
      const { id } = req.query;
      const session = await Session.findById(id);
      res.status(200).json(session);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}