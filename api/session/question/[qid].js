import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({}, { strict: false });
const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);

let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
};

export default async function handler(req, res) {
    await connectDB();

    const { qid } = req.query;

    try {
        const session = await Session.findOne({
            $or: [
                { question: qid },
                { "question.id": qid },
                { "question.id": Number(qid) }
            ]
        });

        if (!session) {
            console.log("❌ No session found for:", qid);
            return res.status(404).json({ error: "No session found" });
        }

        console.log("✅ Found session:", session);

        res.status(200).json(session);
        res.status(200).json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}