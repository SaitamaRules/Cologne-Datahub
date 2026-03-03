CREATE TABLE neighborhoods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE trees (
    id SERIAL PRIMARY KEY,
    tree_number VARCHAR(50) UNIQUE,
    botanical_name VARCHAR(200),
    planting_year INTEGER,
    trunk_diameter_cm NUMERIC,
    trunk_circumference_cm NUMERIC,
    height_m NUMERIC,
    crown_diameter_m NUMERIC,
    street VARCHAR(200),
    neighborhood_id INTEGER REFERENCES neighborhoods(id),
    natural_monument BOOLEAN,
    lat NUMERIC,
    lon NUMERIC
);
