-- 15. How many trees does the imported dataset contain?
SELECT COUNT(*) FROM trees;

-- 16. What are the top 10 most frequent botanical names?
SELECT botanical_name, COUNT(*) as total 
FROM trees 
GROUP BY botanical_name 
ORDER BY total DESC 
LIMIT 10;

-- 17. Which neighborhood has the most trees?
SELECT n.name, COUNT(t.id) as total
FROM trees t 
JOIN neighborhoods n ON t.neighborhood_id = n.id 
GROUP BY n.name 
ORDER BY total DESC 
LIMIT 1;

-- 18. How many trees were planted after the year 2000?
SELECT COUNT(*) 
FROM trees 
WHERE planting_year > 2000;

-- 19. Which trees are listed as natural monuments? (Sample of 10 to avoid overwflow)
SELECT tree_number, botanical_name, street
FROM trees 
WHERE natural_monument = TRUE
LIMIT 10;

-- 20. What is the average trunk circumference and height per neighborhood?
SELECT n.name, 
       ROUND(AVG(t.trunk_circumference_cm), 2) as avg_circumference_cm, 
       ROUND(AVG(t.height_m), 2) as avg_height_m 
FROM trees t 
JOIN neighborhoods n ON t.neighborhood_id = n.id 
GROUP BY n.name
ORDER BY n.name;

-- 21. Which trees are located on 'Aachener Strasse'? (Sample of 10 to avoid overwflow)
SELECT *
FROM trees 
WHERE street ILIKE 'Aachener Str%'
LIMIT 10;

-- 22. Which location type (first letter of the tree number) appears most frequently?
SELECT LEFT(tree_number, 1) AS location_type, COUNT(*) AS total
FROM trees
WHERE tree_number IS NOT NULL
GROUP BY location_type 
ORDER BY total DESC 
LIMIT 1;
