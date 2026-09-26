-- Inventory Management Schema
-- Reference schema for SightSync inventory module (frames, lenses, inventory).

-- Enums for item classification and inventory status
DO $$
BEGIN
    CREATE TYPE item_category AS ENUM ('frame', 'lens', 'accessory');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE frame_gender AS ENUM ('unisex', 'men', 'women', 'kids');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Frames Table
CREATE TABLE IF NOT EXISTS frames (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model_number VARCHAR(100) NOT NULL,
    color VARCHAR(50),
    frame_type VARCHAR(50), -- Full-Rim, Semi-Rimless, Rimless
    material VARCHAR(50),   -- Acetate, Titanium, Metal, Plastic
    gender frame_gender DEFAULT 'unisex',
    lens_width INT,          -- e.g., 52mm
    bridge_width INT,        -- e.g., 18mm
    temple_length INT,       -- e.g., 140mm
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lenses Table
CREATE TABLE IF NOT EXISTS lenses (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    lens_type VARCHAR(50) NOT NULL,   -- Single Vision, Bifocal, Progressive
    material VARCHAR(50) NOT NULL,    -- CR-39, Polycarbonate, High Index 1.67
    index_value NUMERIC(3, 2),        -- e.g., 1.50, 1.61, 1.67, 1.74
    coating VARCHAR(100),            -- Anti-Reflective, Blue Light Shield, Photochromic
    min_sphere NUMERIC(4, 2),        -- e.g., -10.00
    max_sphere NUMERIC(4, 2),        -- e.g., +6.00
    min_cylinder NUMERIC(4, 2),      -- e.g., -4.00
    max_cylinder NUMERIC(4, 2),      -- e.g., 0.00
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Table (Central stock tracking)
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    category item_category NOT NULL,
    frame_id INT REFERENCES frames(id) ON DELETE SET NULL,
    lens_id INT REFERENCES lenses(id) ON DELETE SET NULL,
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reorder_level INT NOT NULL DEFAULT 5,
    unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE, -- soft-delete flag: archived items are hidden but never destroyed (POS history/restock depend on the row)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration for existing databases:
-- ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;