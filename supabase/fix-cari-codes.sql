-- Tüm cari kodlarını adın ilk harfi + sıra numarası formatına düzelt
-- A.0001, A.0002, M.0001 vb.

WITH sorted AS (
  SELECT id, name,
    ROW_NUMBER() OVER (
      PARTITION BY UPPER(SUBSTRING(name, 1, 1))
      ORDER BY created_at, id
    ) AS rn
  FROM cariler
  WHERE is_active = true
),
updated AS (
  SELECT id,
    UPPER(SUBSTRING(name, 1, 1)) || '.' || LPAD(rn::text, 4, '0') AS new_code
  FROM sorted
)
UPDATE cariler
SET code = u.new_code
FROM updated u
WHERE cariler.id = u.id;

-- Sonucu göster
SELECT code, name FROM cariler WHERE is_active = true ORDER BY code;
