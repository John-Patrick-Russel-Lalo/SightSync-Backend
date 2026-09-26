import { describe, it, expect, vi, beforeEach } from "vitest";
import pool from "../../shared/config/db.js";
import {
  createSale,
  getAllSales,
  getSaleById,
  getSalesSummary,
  voidSale,
  generateReceiptNumber,
} from "./pos.service.js";

vi.mock("../../shared/config/db.js", () => {
  const queryMock = vi.fn();
  const connectMock = vi.fn();
  return {
    default: {
      query: queryMock,
      connect: connectMock,
    },
  };
});

describe("POS Service", () => {
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
  });

  describe("generateReceiptNumber", () => {
    it("should return a receipt number in RC-YYYYMMDD-XXXXXX format", () => {
      const receipt = generateReceiptNumber();
      expect(receipt).toMatch(/^RC-\d{8}-\d{6}$/);
    });
  });

  describe("createSale", () => {
    it("should return 400 when items is not a non-empty array", async () => {
      const result = await createSale({ items: [] });
      expect(result).toEqual({
        success: false,
        statusCode: 400,
        message: "items must be a non-empty array.",
      });
    });

    it("should return 400 for an invalid payment method", async () => {
      const result = await createSale({
        items: [{ inventoryId: 1, quantity: 1 }],
        paymentMethod: "bitcoin",
      });
      expect(result).toEqual({
        success: false,
        statusCode: 400,
        message: "paymentMethod must be one of: cash, card, qr.",
      });
    });

    it("should return 404 when an inventory item does not exist", async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // inventory select

      const result = await createSale({
        items: [{ inventoryId: 99, quantity: 1 }],
      });

      expect(result).toEqual({
        success: false,
        statusCode: 404,
        message: "Inventory item 99 not found.",
      });
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should return 409 when stock is insufficient", async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            sku: "FR-001",
            category: "frame",
            quantity: 1,
            selling_price: 100,
            frame_name: "Ray-Ban Aviator",
            lens_name: "",
          }],
        }); // inventory select

      const result = await createSale({
        items: [{ inventoryId: 1, quantity: 5 }],
      });

      expect(result).toEqual({
        success: false,
        statusCode: 409,
        message: "Insufficient stock for FR-001. Available: 1.",
      });
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should successfully create a sale, deduct stock, and compute totals", async () => {
      const mockCreatedSale = {
        id: 10,
        receipt_number: "RC-20260922-123456",
        customer_name: "Juan Dela Cruz",
        subtotal: 1000,
        discount_amount: 50,
        tax_amount: 120,
        total: 1070,
        payment_method: "cash",
        amount_tendered: 2000,
        change_amount: 930,
        status: "completed",
        sold_by: 5,
        created_at: "2026-09-22 10:00:00",
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            sku: "FR-001",
            category: "frame",
            quantity: 10,
            selling_price: 500,
            frame_name: "Ray-Ban Aviator",
            lens_name: "",
          }],
        }) // inventory select (locked)
        .mockResolvedValueOnce({ rows: [] }) // inventory stock decrement
        .mockResolvedValueOnce({ rows: [mockCreatedSale] }) // INSERT sales
        .mockResolvedValueOnce({ rows: [] }) // INSERT sale_items
        .mockResolvedValueOnce({}); // COMMIT

      const result = await createSale({
        items: [{ inventoryId: 1, quantity: 2 }],
        customerName: "Juan Dela Cruz",
        paymentMethod: "cash",
        amountTendered: 2000,
        discountAmount: 50,
        taxRate: 12,
        soldBy: 5,
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(201);
      expect(result.data.subtotal).toBe(1000);
      expect(result.data.tax_amount).toBe(120);
      expect(result.data.total).toBe(1070);
      expect(result.data.change_amount).toBe(930);
      expect(result.data.items).toEqual([
        {
          inventoryId: 1,
          sku: "FR-001",
          productName: "Ray-Ban Aviator",
          category: "frame",
          unitPrice: 500,
          quantity: 2,
          lineTotal: 1000,
        },
      ]);

      // Stock decrement query executed
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE inventory"),
        [2, 1]
      );
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("voidSale", () => {
    it("should return 404 if sale does not exist", async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT sale FOR UPDATE

      const result = await voidSale(99);

      expect(result).toEqual({
        success: false,
        statusCode: 404,
        message: "Sale not found.",
      });
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should return 400 if sale is not completed", async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, status: "refunded" }] }); // SELECT sale FOR UPDATE

      const result = await voidSale(1);

      expect(result).toEqual({
        success: false,
        statusCode: 400,
        message: "Only 'completed' sales can be voided. Current status: refunded.",
      });
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should restock inventory and void the sale", async () => {
      const mockVoidedSale = {
        id: 1,
        receipt_number: "RC-20260922-123456",
        status: "voided",
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, status: "completed" }] }) // SELECT sale FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ inventory_id: 1, quantity: 2 }] }) // sale_items
        .mockResolvedValueOnce({ rows: [] }) // inventory restock
        .mockResolvedValueOnce({ rows: [mockVoidedSale] }) // UPDATE sales
        .mockResolvedValueOnce({}); // COMMIT

      const result = await voidSale(1);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe("voided");
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE inventory"),
        [2, 1]
      );
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("getAllSales", () => {
    it("should fetch all sales with pagination", async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, receipt_number: "RC-20260922-123456", total: 1070 }],
      });

      const sales = await getAllSales(50, 0);

      expect(sales).toEqual([
        { id: 1, receipt_number: "RC-20260922-123456", total: 1070 },
      ]);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("FROM sales"), [50, 0]);
    });
  });

  describe("getSaleById", () => {
    it("should return null when sale does not exist", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const sale = await getSaleById(99);
      expect(sale).toBeNull();
    });

    it("should include line items in the sale detail", async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, receipt_number: "RC-20260922-123456", total: 1070 }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, inventory_id: 1, sku: "FR-001", quantity: 2 }],
        });

      const sale = await getSaleById(1);

      expect(sale.receipt_number).toBe("RC-20260922-123456");
      expect(sale.items).toEqual([
        { id: 1, inventory_id: 1, sku: "FR-001", quantity: 2 },
      ]);
    });
  });

  describe("getSalesSummary", () => {
    it("should return a daily summary with item count", async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [{
            transaction_count: 3,
            total_revenue: 3210,
            subtotal_revenue: 3000,
            total_discounts: 100,
            total_taxes: 310,
          }],
        })
        .mockResolvedValueOnce({ rows: [{ items_sold: 6 }] });

      const summary = await getSalesSummary("2026-09-22", "2026-09-22");

      expect(summary).toMatchObject({
        transaction_count: 3,
        total_revenue: 3210,
        items_sold: 6,
      });
    });
  });
});