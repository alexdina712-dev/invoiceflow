import 'dotenv/config';
import { app } from './app.js';
const port = Number(process.env.PORT || 4002);
app.listen(port, '0.0.0.0', () => console.log(`CareerLens API ready on port ${port}`));
