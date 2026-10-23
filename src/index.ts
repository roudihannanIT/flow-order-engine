import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK', message: 'FlowOrder Engine is running...' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});