
import { getAllLenses } from "./lenses.model.js";

export async function fetchAllLenses(req, res) {
    try {
        const lenses = await getAllLenses();        
        res.status(200).json(lenses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export default { fetchAllLenses };