import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  shapes: Array,
  codes: Array,
  question: Object,
  offset: Object,
  zoom: Number,
  darkMode: Boolean,
}, { timestamps: true });

export default mongoose.model("Session", sessionSchema);