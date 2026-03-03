CREATE TABLE neighborhoods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE trees (
    id SERIAL PRIMARY KEY,
    tree_number VARCHAR(50) UNIQUE,
    botanical_name VARCHAR(200),
    planting_year INTEGER,
    trunk_diameter_cm NUMERIC(8,2),
    trunk_circumference_cm NUMERIC(8,2),
    height_m NUMERIC(6,2),
    crown_diameter_m NUMERIC(6,2),
    street VARCHAR(200),
    neighborhood_id INTEGER REFERENCES neighborhoods(id),
    natural_monument BOOLEAN,
    lat NUMERIC(10,7),
    lon NUMERIC(10,7)
);
