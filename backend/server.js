import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import Session from "./models/Session.js";

dotenv.config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// connect DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));


// ✅ 1. SAVE SESSION
app.post("/api/session", async (req, res) => {
  try {
    const session = await Session.create(req.body);
    res.json({ id: session._id });
  } catch (err) {
    res.status(500).json({ error: "Failed to save" });
  }
});


// ✅ 2. LOAD SESSION
app.get("/api/session/question/:qid", async (req, res) => {
  try {
    const qid = req.params.qid;

    const session = await Session.findOne({
      "question.id": qid
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ error: "No session found" });
    }

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: "Failed to load" });
  }
});


// server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));