import 'dotenv/config';
import pg from "pg";
import { APP_TIMEZONE } from "../utils/dateTime.js";

const { Pool } = pg;

// DATE and TIMESTAMP WITHOUT TIME ZONE hold clinic wall-clock values with no
// timezone attached. By default `pg` converts them into JS Date objects using the
// *server's* timezone, so the same row serialised to JSON reads differently on a
// UTC production host than on a local machine (a 12:30 PM appointment becomes
// 8:30 PM). Returning the raw strings keeps every response identical everywhere
// and leaves the interpretation to the client.
pg.types.setTypeParser(1082, (value) => value); // 1082 = DATE
pg.types.setTypeParser(1114, (value) => value); // 1114 = TIMESTAMP WITHOUT TIME ZONE
// 1184 = TIMESTAMP WITH TIME ZONE stays a real instant and keeps the default parser.

const pool = new Pool({
    connectionString: process.env.DATABASE_URL_NEON,
    options: `-c timezone=${APP_TIMEZONE}`,
});

try {
    const result = await pool.query("SELECT NOW()");
    console.log("Database Connected");
    console.log("Server timezone:", APP_TIMEZONE);
    console.log(result.rows[0]);
} catch (err) {
    console.error(err);
}

export default pool;