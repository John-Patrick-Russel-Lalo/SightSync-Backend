-- Point of Sale (POS) Module Schema
-- Reference schema for SightSync POS module (sales, sale_items).
-- Depends on the inventory schema (`item_category`) and the `users` table.

-- Enums for payment method and sale status
DO $$
BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'card', 'qr');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE sale_status AS ENUM ('completed', 'voided', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Sales Table (transaction header / receipt)
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(150),
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_method payment_method NOT NULL DEFAULT 'cash',
    amount_tendered NUMERIC(10, 2),
    change_amount NUMERIC(10, 2),
    status sale_status NOT NULL DEFAULT 'completed',
    sold_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sale Items Table (transaction lines, snapshot of sold product data)
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    inventory_id INT NOT NULL REFERENCES inventory(id),
    sku VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    category item_category,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    quantity INT NOT NULL CHECK (quantity > 0),
    line_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_inventory_id ON sale_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);