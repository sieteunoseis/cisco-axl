SELECT NAME,
       param
FROM typemodel AS model,
     productsupportsfeature AS p
WHERE p.tkmodel = model.enum
  AND p.tksupportsfeature =
    (SELECT enum
     FROM typesupportsfeature
     WHERE NAME = 'Multiple Call Display')
  AND model.tkclass =
    (SELECT enum
     FROM typeclass
     WHERE NAME = 'Phone')
  AND name='Cisco Dual Mode for Android'