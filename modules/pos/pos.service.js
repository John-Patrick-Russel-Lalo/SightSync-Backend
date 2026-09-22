// pos.service.js
import pool from "../../shared/config/db.js";

const PAYMENT_METHODS = ["cash", "card", "qr"];

const roundToCent = (value) => Math.round(value * 100) / 100;

export function generateReceiptNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `RC-${datePart}-${randomPart}`;
}

function buildProductName(item) {
  if (item.frame_name) return item.frame_name;
  if (item.lens_name) return item.lens_name;
  return item.sku;
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export async function createSale(saleData) {
  const {
    items,
    customerName,
    paymentMethod = "cash",
    amountTendered,
    discountAmount = 0,
    taxRate = 0,
    soldBy,
  } = saleData;

  if (!Array.isArray(items) || items.length === 0) {
    return {
      success: false,
      statusCode: 400,
      message: "items must be a non-empty array.",
    };
  }

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return {
      success: false,
      statusCode: 400,
      message: `paymentMethod must be one of: ${PAYMENT_METHODS.join(", ")}.`,
    };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const saleLines = [];
    let subtotal = 0;

    for (const line of items) {
      if (!line.inventoryId || !Number.isInteger(line.quantity) || line.quantity <= 0) {
        await client.query("ROLLBACK");
        return {
          success: false,
          statusCode: 400,
          message: "Each item requires a valid inventoryId and a positive integer quantity.",
        };
      }

      // Lock the inventory row so concurrent sales cannot oversell.
      const invRes = await client.query(
        `
        SELECT
          i.id,
          i.sku,
          i.category,
          i.quantity,
          i.selling_price,
          COALESCE(
            NULLIF(TRIM(f.brand || ' ' || COALESCE(f.model_number, '')), ''),
            ''
          ) AS frame_name,
          COALESCE(
            NULLIF(TRIM(l.brand || ' ' || COALESCE(l.lens_type, '')), ''),
            ''
          ) AS lens_name
FROM inventory i
        LEFT JOIN frames f ON i.frame_id = f.id
        LEFT JOIN lenses l ON i.lens_id = l.id
        WHERE i.id = $1
          AND i.is_active = TRUE
        FOR UPDATE OF i
        `,
        [line.inventoryId]
      );

      if (invRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return {
          success: false,
          statusCode: 404,
          message: `Inventory item ${line.inventoryId} not found.`,
        };
      }

      const inv = invRes.rows[0];

      if (inv.quantity < line.quantity) {
        await client.query("ROLLBACK");
        return {
          success: false,
          statusCode: 409,
          message: `Insufficient stock for ${inv.sku}. Available: ${inv.quantity}.`,
        };
      }

      const lineTotal = roundToCent(inv.selling_price * line.quantity);
      subtotal = roundToCent(subtotal + lineTotal);

      saleLines.push({
        inventoryId: inv.id,
        sku: inv.sku,
        productName: buildProductName(inv),
        category: inv.category,
        unitPrice: inv.selling_price,
        quantity: line.quantity,
        lineTotal,
      });

      // Deduct stock from inventory (this is how POS stays connected to inventory).
      await client.query(
        `
        UPDATE inventory
        SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [line.quantity, inv.id]
      );
    }

    const discount = roundToCent(Number(discountAmount) || 0);
    const taxAmount = roundToCent(subtotal * (Number(taxRate) || 0) / 100);
    const total = roundToCent(subtotal - discount + taxAmount);

    const tendered = amountTendered === undefined || amountTendered === null
      ? null
      : roundToCent(Number(amountTendered));
    const changeAmount =
      tendered === null
        ? null
        : roundToCent(Math.max(0, tendered - total));

    const receiptNumber = generateReceiptNumber();

    const saleRes = await client.query(
      `
      INSERT INTO sales (
        receipt_number,
        customer_name,
        subtotal,
        discount_amount,
        tax_amount,
        total,
        payment_method,
        amount_tendered,
        change_amount,
        sold_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        receiptNumber,
        customerName || null,
        subtotal,
        discount,
        taxAmount,
        total,
        paymentMethod,
        tendered,
        changeAmount,
        soldBy || null,
      ]
    );

    const sale = saleRes.rows[0];

    for (const line of saleLines) {
      await client.query(
        `
        INSERT INTO sale_items (
          sale_id,
          inventory_id,
          sku,
          product_name,
          category,
          unit_price,
          quantity,
          line_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          sale.id,
          line.inventoryId,
          line.sku,
          line.productName,
          line.category,
          line.unitPrice,
          line.quantity,
          line.lineTotal,
        ]
      );
    }

    await client.query("COMMIT");

    return {
      success: true,
      statusCode: 201,
      data: {
        ...sale,
        items: saleLines,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getAllSales(limit = 50, offset = 0) {
  const result = await pool.query(
    `
    SELECT
      s.id,
      s.receipt_number,
      s.customer_name,
      s.subtotal,
      s.discount_amount,
      s.tax_amount,
      s.total,
      s.payment_method,
      s.amount_tendered,
      s.change_amount,
      s.status,
      s.sold_by,
      u.username AS sold_by_name,
      s.created_at
    FROM sales s
    LEFT JOIN users u ON s.sold_by = u.id
    ORDER BY s.created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows;
}

export async function getSaleById(id) {
  const saleRes = await pool.query(
    `
    SELECT
      s.id,
      s.receipt_number,
      s.customer_name,
      s.subtotal,
      s.discount_amount,
      s.tax_amount,
      s.total,
      s.payment_method,
      s.amount_tendered,
      s.change_amount,
      s.status,
      s.sold_by,
      u.username AS sold_by_name,
      s.created_at
    FROM sales s
    LEFT JOIN users u ON s.sold_by = u.id
    WHERE s.id = $1
    `,
    [id]
  );

  const sale = saleRes.rows[0];
  if (!sale) return null;

  const itemsRes = await pool.query(
    `
    SELECT id, inventory_id, sku, product_name, category, unit_price, quantity, line_total
    FROM sale_items
    WHERE sale_id = $1
    ORDER BY id
    `,
    [id]
  );

  return { ...sale, items: itemsRes.rows };
}

export async function getSalesBySeller(userId, limit = 50, offset = 0) {
  const result = await pool.query(
    `
    SELECT
      s.id,
      s.receipt_number,
      s.customer_name,
      s.subtotal,
      s.discount_amount,
      s.tax_amount,
      s.total,
      s.payment_method,
      s.amount_tendered,
      s.change_amount,
      s.status,
      s.sold_by,
      s.created_at
    FROM sales s
    WHERE s.sold_by = $1
    ORDER BY s.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  return result.rows;
}

export async function getSalesSummary(startDate, endDate) {
  const salesRes = await pool.query(
    `
    SELECT
      COUNT(*)::int AS transaction_count,
      COALESCE(SUM(total), 0) AS total_revenue,
      COALESCE(SUM(subtotal), 0) AS subtotal_revenue,
      COALESCE(SUM(discount_amount), 0) AS total_discounts,
      COALESCE(SUM(tax_amount), 0) AS total_taxes
    FROM sales
    WHERE status = 'completed'
      AND created_at >= $1::date
      AND created_at < ($2::date + INTERVAL '1 day')
    `,
    [startDate, endDate]
  );

  const itemsRes = await pool.query(
    `
    SELECT COALESCE(SUM(si.quantity), 0)::int AS items_sold
    FROM sale_items si
    INNER JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'completed'
      AND s.created_at >= $1::date
      AND s.created_at < ($2::date + INTERVAL '1 day')
    `,
    [startDate, endDate]
  );

  return {
    startDate,
    endDate,
    ...salesRes.rows[0],
    items_sold: itemsRes.rows[0].items_sold || 0,
  };
}

export async function voidSale(id) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const saleRes = await client.query(
      `
      SELECT * FROM sales
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    const sale = saleRes.rows[0];

    if (!sale) {
      await client.query("ROLLBACK");
      return { success: false, statusCode: 404, message: "Sale not found." };
    }

    if (sale.status !== "completed") {
      await client.query("ROLLBACK");
      return {
        success: false,
        statusCode: 400,
        message: `Only 'completed' sales can be voided. Current status: ${sale.status}.`,
      };
    }

    // Restock inventory for each sold line item.
    const itemsRes = await client.query(
      `
      SELECT inventory_id, quantity
      FROM sale_items
      WHERE sale_id = $1
      `,
      [id]
    );

    for (const item of itemsRes.rows) {
      await client.query(
        `
        UPDATE inventory
        SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [item.quantity, item.inventory_id]
      );
    }

    const updateRes = await client.query(
      `
      UPDATE sales
      SET status = 'voided', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    await client.query("COMMIT");
    return { success: true, statusCode: 200, data: updateRes.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}