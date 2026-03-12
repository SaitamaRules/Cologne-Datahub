CREATE TABLE IF NOT EXISTS neighborhoods (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE trees (
    id SERIAL PRIMARY KEY,
    tree_number TEXT UNIQUE,
    botanical_name TEXT,
    planting_year INTEGER,
    trunk_diameter_cm NUMERIC,
    trunk_circumference_cm NUMERIC,
    height_m NUMERIC,
    crown_diameter_m NUMERIC,
    street TEXT,
    neighborhood_id INTEGER REFERENCES neighborhoods(id),
    natural_monument BOOLEAN,
    lat NUMERIC,
    lon NUMERIC
);
