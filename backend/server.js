import express from "express";
import cors from "cors";
import chatRoute from "./routes/chat.js";
import rfpsRoute from "./routes/rfps.js";
import vendorRepliesRoute from "./routes/vendorReplies.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/chat", chatRoute);
app.use("/api/rfps", rfpsRoute);
app.use("/api/vendor", vendorRepliesRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Backend running on port", PORT));
