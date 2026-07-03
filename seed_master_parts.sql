-- SQL Migration Script to create and populate master_parts table in Supabase PostgreSQL
-- Copy and run this script in your Supabase -> SQL Editor

-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS master_parts (
    id SERIAL PRIMARY KEY,
    part_number TEXT UNIQUE NOT NULL,
    part_name TEXT,
    home_line TEXT,
    backup_line TEXT,
    model_code TEXT,
    cycle_time NUMERIC,
    sebango TEXT,
    material TEXT,
    area TEXT,
    tonnage TEXT,
    cavity NUMERIC DEFAULT 1,
    mold TEXT,
    weight NUMERIC DEFAULT 0,
    spec NUMERIC DEFAULT 1,
    process TEXT DEFAULT 'injection',
    shikake NUMERIC DEFAULT 2,
    customer_pno TEXT,
    customer_sebango TEXT,
    daily_requirement_n NUMERIC DEFAULT 0,
    daily_requirement_n1 NUMERIC DEFAULT 0,
    daily_requirement_n2 NUMERIC DEFAULT 0,
    daily_requirement_n3 NUMERIC DEFAULT 0,
    month_n_forecast NUMERIC DEFAULT 0,
    month_n1_forecast NUMERIC DEFAULT 0,
    month_n2_forecast NUMERIC DEFAULT 0,
    month_n3_forecast NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.1 Robust Schema Upgrade: Add missing columns if they do not exist (covers cases where table was created with old schema)
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS cavity NUMERIC DEFAULT 1;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS mold TEXT DEFAULT 'MOLD-01';
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS spec NUMERIC DEFAULT 1;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS process TEXT DEFAULT 'injection';
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS shikake NUMERIC DEFAULT 2;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS customer_pno TEXT;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS customer_sebango TEXT;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS daily_requirement_n NUMERIC DEFAULT 0;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS daily_requirement_n1 NUMERIC DEFAULT 0;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS daily_requirement_n2 NUMERIC DEFAULT 0;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS daily_requirement_n3 NUMERIC DEFAULT 0;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS month_n_forecast NUMERIC DEFAULT 0;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS month_n1_forecast NUMERIC DEFAULT 0;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS month_n2_forecast NUMERIC DEFAULT 0;
ALTER TABLE master_parts ADD COLUMN IF NOT EXISTS month_n3_forecast NUMERIC DEFAULT 0;

-- 2. Clean existing data (optional, uncomment if needed)
-- TRUNCATE TABLE master_parts RESTART IDENTITY CASCADE;

-- 3. Insert real production parts
INSERT INTO master_parts (part_number, part_name, home_line, backup_line, model_code, cycle_time, sebango, material, area, tonnage, cavity, mold, weight, spec, process)
VALUES
    ('52159-BZ290', 'COVER, RR BUMPER', 'F2 #6', 'F4 #B3', 'D40D', 72, 'U0-4511-R1G3', 'PP TSOP7 R1G3', 'F2', '2500T', 1, 'MOLD-BUMP-01', 3.8, 12, 'injection'),
    ('52119-BZD010', 'COVER FR BUMPER STD', 'F4 #B1', 'F4 #B1', 'D17D', 60, 'U0-1B00-R299', 'PP RESIN COSMOPLENE TSOP7 (NAT)', 'F4', '3500T', 1, 'MOLD-BUMP-02', 4.2, 2, 'injection'),
    ('52159-BZ270-00', 'COVER, RR BUMPER', 'F2 #6', 'F4 B#3', 'D40D', 59, 'U0-4531-R1G3', 'TSOP7-R1G3', 'F2', '2500T', 1, 'MOLD-BUMP-03', 3.6, 12, 'injection'),
    ('52119-BZ480', 'COVER, FR BUMPER (EMBOSS)', 'F2 #6', 'F4 B#3', 'D40D', 70, 'U0-4501-R1G3', 'TSOP7-R1G3', 'F2', '2500T', 1, 'MOLD-BUMP-04', 4.0, 6, 'injection'),
    ('55434-KK020-C0', 'PANEL, INST PANEL FINISH, LWR CTR (RHD)', 'F4 #8', 'F4 #1', '660A', 47, 'U0-2960-201B', 'PP LA880T 201B-1', 'F4', '2500T', 1, 'MOLD-PNL-01', 0.8, 6, 'injection'),
    ('55434-KK030-C0', 'PANEL, INST PANEL FINISH, LWR CTR (LHD)', 'F4 #8', 'F4 #1', '660A', 47, 'U0-2961-201B', 'PP LA880T 201B-1', 'F4', '2500T', 1, 'MOLD-PNL-02', 0.8, 6, 'injection'),
    ('53112-0K170-00', 'GRILLE, RADIATOR, LWR', 'F3 #1', 'F3 #1', '660A', 59, 'U0-2928-11BK03', 'TSOP7 11BK03', 'F3', '1300T', 1, 'MOLD-GRILL-01', 1.2, 8, 'injection'),
    ('52169-0K200-00', 'COVER, RR BUMPER, LWR', 'F3 #3', 'F3 #3', '650A', 51, 'U0-3302-11BK03', 'TSOP7 11BK03', 'F3', '1300T', 1, 'MOLD-BUMP-05', 1.5, 20, 'injection'),
    ('53111-0K750', 'GRILLE, RADIATOR', 'F3 #3', 'F3 #3', '650A', 60, 'U0-0030-BLCK', 'ASA S210B4-0256K', 'F3', '1300T', 1, 'MOLD-GRILL-02', 1.8, 12, 'injection'),
    ('53111-0K760', 'GRILLE, RADIATOR', 'F3 #2', 'F3 #2', '650A', 60, 'U0-0031-BLCK', 'ASA S210B4-0256K', 'F3', '1300T', 1, 'MOLD-GRILL-03', 1.8, 12, 'injection'),
    ('711623N1 T001', 'SKID GARN,FR BUMPER', 'F3 #3', 'F3 #3', '3M0A', 58.5, 'U0-6135-NH696', 'PP SP-855 RT (NH-696)', 'F3', '1300T', 1, 'MOLD-SKID-01', 0.9, 30, 'injection'),
    ('711623N1 T402', 'SKID GRAN,FR BUMPER', 'F3 #2', 'F3 #2', '3M0A', 70, 'U0-6136-NH696', 'PP X425T (NH-696)', 'F3', '1300T', 1, 'MOLD-SKID-02', 0.9, 60, 'injection'),
    ('1411-0D060', 'CASE', 'F4 #1', 'F4 #8', '501N', 84, 'I-262', 'NYLON ZYTEL 103F HS NC010', 'F4', '2500T', 1, 'MOLD-CASE-01', 0.5, 15, 'injection'),
    ('55311-BZ850-C0', 'PANEL, INSTRUMENT RHD', 'F3 #9', 'F3 #9', 'D55L', 59, 'U0-4850-202B', 'PP LA 880T NAT+MB 202B', 'F3', '1600T', 1, 'MOLD-PNL-03', 3.2, 9, 'injection'),
    ('55311-BZ860-C0', 'PANEL, INSTRUMENT LHD', 'F3 #9', 'F3 #10', 'D55L', 54, 'U0-4851-202B', 'PP LA 880T NAT+MB 202B', 'F3', '1600T', 1, 'MOLD-PNL-04', 3.2, 6, 'injection'),
    ('55550-BZ200-C0', 'DOOR ASSY, GLOVE COMPARTMENT', 'F3 #1', 'F3 #1', 'D55L', 48, 'U0-4855-202B', 'PP LA 880T NAT+MB 202B', 'F3', '1300T', 1, 'MOLD-DOOR-01', 0.7, 3, 'injection'),
    ('52119-BZR70', 'COVER, FR BUMPER (D-BRAND)', 'F4 #B1', 'F4 #B1', 'D26A', 60, 'U0-5038-RX04', 'PP LA880T NAT', 'F4', '3500T', 1, 'MOLD-BUMP-06', 4.2, 2, 'injection'),
    ('53111-BZ580', 'GRILLE, RADIATOR (D-BRAND) W/O CAMERA', 'F3 #10', 'F3 #13', 'D26A', 55, 'U0-5022-201B', '0CA041 BLK-RX04', 'F3', '1600T', 1, 'MOLD-GRILL-04', 1.6, 9, 'injection'),
    ('52119-BZS00', 'COVER, FR BUMPER (T-BRAND)', 'F4 #B1', 'F4 #B1', 'D26A', 60, 'U0-5039-RX04', 'PP LA880T NAT', 'F4', '3500T', 1, 'MOLD-BUMP-07', 4.2, 2, 'injection'),
    ('53111-BZ600', 'GRILLE, RADIATOR (T-BRAND)', 'F3 #10', 'F3 #9', 'D26A', 65, 'U0-5024-201B', 'PP LA880T NAT', 'F3', '1600T', 1, 'MOLD-GRILL-05', 1.6, 9, 'injection'),
    ('53111-BZ620', 'GRILLE, RADIATOR (AERO)', 'F3 #6', 'F3 #6', 'D26A', 60, 'U0-5020-201B', 'ABS 100-X01 201B', 'F3', '1600T', 1, 'MOLD-GRILL-06', 1.7, 12, 'injection'),
    ('55550-BZ170-C0', 'DOOR ASSY, GLOVE COMPARTMENT (RHD)', 'F3 #1', 'F3 #1', 'D26A', 49, 'U0-5029-202B', 'PP LA880T NAT - 202B', 'F3', '1300T', 1, 'MOLD-DOOR-02', 0.7, 3, 'injection'),
    ('55550-BZ220-C0', 'DOOR ASSY, GLOVE COMPARTMENT (LHD)', 'F3 #1', 'F3 #1', 'D26A', 53, 'U0-5030-202B', 'PP LA880T NAT - 202B', 'F3', '1300T', 1, 'MOLD-DOOR-03', 0.7, 3, 'injection'),
    ('58848-37080', 'COVER, SHIFT LEVER, HOLE', 'F4 #7', 'F4 #1', '928A', 63, 'I-G14', 'PVC-JL004A-BS092-Black', 'F4', '2500T', 1, 'MOLD-CVR-01', 0.3, 12, 'injection'),
    ('55551-VT010', 'DOOR, GLOVE COMPARTMENT, OUTER', 'F3 #13', 'F3 #10', '560B', 53, 'U0-5105-BLCK', 'PP LA880T NAT-202B', 'F3', '650T', 1, 'MOLD-DOOR-04', 0.4, 10, 'injection'),
    ('55552-VT010', 'DOOR, GLOVE COMPARTMENT, INNER', 'F3 #10', 'F3 #13', '560B', 56, 'U0-5106-BLCK', 'PP LA880T NAT-202B', 'F3', '1600T', 1, 'MOLD-DOOR-05', 0.4, 10, 'injection'),
    ('55551-VT020', 'DOOR, GLOVE COMPARTMENT, OUTER', 'F3 #13', 'F3 #10', '560B', 55, 'U0-5107-BLCK', 'PP LA880T NAT-202B', 'F3', '650T', 1, 'MOLD-DOOR-06', 0.4, 10, 'injection'),
    ('55552-VT020', 'DOOR, GLOVE COMPARTMENT, INNER', 'F3 #10', 'F3 #13', '560B', 55, 'U0-5108-BLCK', 'PP LA880T NAT-202B', 'F3', '1600T', 1, 'MOLD-DOOR-07', 0.4, 10, 'injection'),
    ('62511-VT010', 'PANEL, QUARTER TRIM, RH', 'F2 #7', 'F2 #7', '560B', 62, 'U0-5087-202B', 'PP BI32AT-N0602-202B', 'F2', '2500T', 1, 'MOLD-PNL-05', 2.1, 15, 'injection'),
    ('62512-VT010', 'PANEL, QUARTER TRIM, LH', 'F2 #7', 'F2 #7', '560B', 60, 'U0-5089-202B', 'PP BI32AT-N0602-202B', 'F2', '2500T', 1, 'MOLD-PNL-06', 2.1, 15, 'injection'),
    ('67751-VT010', 'BOARD, BACK DOOR TRIM', 'F2 #7', 'F2 #7', '560B', 60, 'U0-5091-202B', 'PP BI32AT-N0602-202B', 'F2', '2500T', 1, 'MOLD-BOARD-01', 1.8, 21, 'injection'),
    ('76871-BZ570', 'COVER, RR SPOILER', 'F3 #2', 'F3 #2', 'D03B', 65, 'U0-5622-BLCK', 'ABS 440Y-X50 B1', 'F3', '1300T', 1, 'MOLD-SPOIL-01', 1.3, 24, 'injection'),
    ('62631-BZ040', 'PANEL, QUARTER TRIM, RR RH', 'F2 #8', 'F2 #8', 'D03B', 60, 'U0-5607-BLCK', 'BR5B1 202B', 'F2', '2500T', 1, 'MOLD-PNL-07', 2.4, 12, 'injection'),
    ('62632-BZ040', 'PANEL, QUARTER TRIM, RR LH', 'F2 #8', 'F2 #8', 'D03B', 60, 'U0-5609-BLCK', 'BR5B1 202B', 'F2', '2500T', 1, 'MOLD-PNL-08', 2.4, 12, 'injection'),
    ('62632-BZ050', 'PANEL, QUARTER TRIM, RR LH - HV', 'F2 #8', 'F2 #8', 'D03B', 60, 'U0-5611-BLCK', 'BR5B1 202B', 'F2', '2500T', 1, 'MOLD-PNL-09', 2.4, 12, 'injection'),
    ('75851/2-BZ130-00', 'BODY ROCKER PANEL, RH/LH', 'F2 #3', 'F2 #3', 'D17D', 61, 'U0-1A95/6-BLCK', 'PP RESIN COSMOPLENE TSOP7 (NAT)', 'F2', '3500T', 2, 'MOLD-ROCK-01', 2.2, 1, 'injection');

-- Verify insertion
SELECT count(*) FROM master_parts;
