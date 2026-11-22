import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../shared/config/db.js", () => ({ default: { query: vi.fn() } }));
import pool from "../../shared/config/db.js";
import { handleUpdatePrices } from "./inventory.controller.js";

const response = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe("inventory price updates", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([-1, "10", "", null, undefined, true, Infinity, NaN])(
    "rejects invalid prices: %s", async (value) => {
      for (const field of ["unitCost", "sellingPrice"]) {
        const res = response();
        await handleUpdatePrices({ params: { id: "7" }, body: {
          unitCost: 100, sellingPrice: 200, [field]: value,
        } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(pool.query).not.toHaveBeenCalled();
      }
    }
  );

  it("saves zero and decimal prices without updating stock or catalog references", async () => {
    const item = { id: 7, unit_cost: 0, selling_price: 250.75 };
    pool.query.mockResolvedValueOnce({ rows: [item] });
    const res = response();
    await handleUpdatePrices({ params: { id: "7" }, body: {
      unitCost: 0, sellingPrice: 250.75, quantity: 999, frameId: null,
    } }, res);
    const [sql, values] = pool.query.mock.calls[0];
    expect(values).toEqual(["7", 0, 250.75]);
    expect(sql).not.toMatch(/quantity\s*=|frame_id\s*=|lens_id\s*=/);
    expect(res.json).toHaveBeenCalledWith({ message: "Prices updated successfully.", data: item });
  });

  it("returns 404 for a missing or archived item", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = response();
    await handleUpdatePrices({ params: { id: "7" }, body: { unitCost: 0, sellingPrice: 10 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
