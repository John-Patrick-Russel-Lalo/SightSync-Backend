import { generateSummary } from "./ai.service.js";

export const aiController = async (req, res) => {
    try {
        const prompt = req.body.prompt;
        console.log(prompt)
        const ai_summary = await generateSummary(prompt);
        res.status(200).json({ ai_summary });
    } catch (error) {
        console.error("AI Error:", error);

        res.status(503).json({
            message: "AI service is temporarily unavailable."
        });
    }
};

// Only whitelisted, bounded values reach the model: the client sends the
// figures it already computed for the Analytics page, never free-form text.
const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const text = (value, max = 40) => String(value ?? "").slice(0, max);

function buildAnalyticsSummaryPrompt(body) {
    const period = body.period || {};
    const stats = body.stats || {};
    const sales = stats.sales || {};
    const appointments = stats.appointments || {};
    const patients = stats.patients || {};
    const inventory = stats.inventory || {};
    const doctors = stats.doctors || {};

    // Without a previous period the deltas are meaningless, so say so instead
    // of printing a fake 0% change.
    const delta = (value) => (period.comparisonReady ? `${num(value)}%` : "n/a (no previous period)");

    const methodEntries = Object.entries(sales.methodCounts || {})
        .slice(0, 6)
        .map(([method, count]) => `${text(method, 20)}: ${num(count)}`)
        .join(", ");

    const lines = [
        "You are assisting the administration of an optometry clinic. Write an analytics summary for the reporting period below.",
        "Use ONLY the numbers given. Do not invent figures, diagnoses, guarantees, or recommendations about individual patients.",
        "",
        `Reporting period: ${text(period.startISO, 20)} to ${text(period.endISO, 20)} (${num(period.rangeDays)} days)`,
        `Period-over-period comparison available: ${period.comparisonReady ? "yes" : "no"}`,
        "",
        "Revenue and sales:",
        `- Total revenue: PHP ${num(sales.revenue)} (change vs previous period: ${delta(sales.revenueDelta)})`,
        `- Completed transactions: ${num(sales.transactions)} (change: ${delta(sales.transactionsDelta)})`,
        `- Average ticket: PHP ${num(sales.averageTicket)}`,
        `- Voided or refunded sales: ${num(sales.voided)} (${num(sales.voidRate)}% of sales in period)`,
        `- Discounts given: PHP ${num(sales.discounts)}`,
        `- Sales by payment method: ${methodEntries || "none recorded"}`,
        "",
        "Appointments:",
        `- Total in period: ${num(appointments.total)} (change: ${delta(appointments.totalDelta)})`,
        `- Completed: ${num(appointments.completed)} | Pending: ${num(appointments.pending)} | Scheduled: ${num(appointments.scheduled)} | Cancelled/declined/no-show: ${num(appointments.lost)}`,
        `- Completion rate: ${num(appointments.completionRate)}% | No-show rate: ${num(appointments.noShowRate)}%`,
        "",
        "Patients:",
        `- Total on file: ${num(patients.total)} | New in period: ${num(patients.newInWindow)} (change: ${delta(patients.newDelta)})`,
        `- Active: ${num(patients.active)} | Pending: ${num(patients.pending)} | Suspended: ${num(patients.suspended)} | Inactive: ${num(patients.inactive)}`,
        "",
        "Inventory:",
        `- Items tracked: ${num(inventory.items)} | Out of stock: ${num(inventory.outOfStock)} | Low stock: ${num(inventory.lowStock)}`,
        `- Stock value: PHP ${num(inventory.stockValue)} | Retail value: PHP ${num(inventory.retailValue)} | Dead capital: PHP ${num(inventory.deadCapital)}`,
        `- Sell-through: ${num(inventory.sellThrough)}%`,
        "",
        "Doctors:",
        `- Accounts: ${num(doctors.accounts)} | Without a profile: ${num(doctors.withoutProfile)} | No bookings in period: ${num(doctors.idle)}`,
        `- Share of bookings held by the busiest doctor: ${num(doctors.topShare)}%`,
        "",
        "Return a single paragraph of 5-7 sentences covering sales performance, appointment volume and attendance, patient growth, inventory health, and staffing, ending with the most notable risk or opportunity in the figures.",
    ];

    return lines.join("\n");
}

// POST /ai/analytics-summary
// Summarizes the numbers the Analytics page already displays for admins.
export const aiAnalyticsSummaryController = async (req, res) => {
    try {
        if (!req.body?.stats || !req.body?.period) {
            return res.status(400).json({ error: "Analytics data is required." });
        }

        const ai_summary = await generateSummary(buildAnalyticsSummaryPrompt(req.body));
        res.status(200).json({ ai_summary });
    } catch (error) {
        console.error("AI analytics summary error:", error);

        res.status(503).json({
            message: "AI service is temporarily unavailable."
        });
    }
};
