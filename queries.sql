-- 15. How many trees does the imported dataset contain?
SELECT COUNT(*) FROM trees;

-- 16. What are the top 10 most frequent botanical names?
SELECT botanical_name, COUNT(*) as count 
FROM trees 
GROUP BY botanical_name 
ORDER BY count DESC 
LIMIT 10;

-- 17. Which neighborhood has the most trees?
SELECT n.name, COUNT(t.id) as tree_count 
FROM trees t 
JOIN neighborhoods n ON t.neighborhood_id = n.id 
GROUP BY n.name 
ORDER BY tree_count DESC 
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
ORDER BY n.name ASC;

-- 21. Which trees are located on 'Aachener Strasse'?
-- Using ILIKE and % to account for "Strasse" vs "Straße" variations in raw data
SELECT tree_number, botanical_name, street 
FROM trees 
WHERE street ILIKE 'Aachener Str%';

-- 22. Which location type (first letter of the tree number) appears most frequently?
SELECT SUBSTRING(tree_number, 1, 1) as location_type, COUNT(*) as count 
FROM trees 
GROUP BY location_type 
ORDER BY count DESC 
LIMIT 1;
