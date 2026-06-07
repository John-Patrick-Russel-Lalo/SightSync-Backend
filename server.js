import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3500;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});