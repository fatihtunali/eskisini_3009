// export_schema_md.js — MySQL Shell (JS mode) için
// Kullanım:
// mysqlsh --uri root@93.113.96.11:3306 --ssl-mode=REQUIRED --js -f C:/Users/fatih/Desktop/export_schema_md.js > C:/Users/fatih/Desktop/eskisini_db_schema.md

const DB = "eskisini_db";

// Yardımcı: SQL çalıştır ve tüm satırları dizi olarak döndür
function q(sql) {
  const r = session.runSql(sql);
  const rows = [];
  let row;
  while ((row = r.fetchOne())) rows.push(row);
  return { rows, cols: r.getColumns() };
}

// Başlık
print(`# ${DB} — Veri Sözlüğü (Şema Açıklaması)\n`);
print(`> Oluşturma tarihi: ${new Date().toISOString()}\n`);

// Tablolar listesi
let res = q(`
  SELECT TABLE_NAME
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA='${DB}' AND TABLE_TYPE='BASE TABLE'
  ORDER BY TABLE_NAME
`);
const tables = res.rows.map(r => r[0]);

// Görünümler listesi
res = q(`
  SELECT TABLE_NAME
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA='${DB}' AND TABLE_TYPE='VIEW'
  ORDER BY TABLE_NAME
`);
const views = res.rows.map(r => r[0]);

// ---- Özet
print(`## Özet\n`);
print(`- Tablolar: ${tables.length}`);
print(`- Görünümler: ${views.length}\n`);

// ---- Her tablo için: kolonlar
for (const t of tables) {
  print(`\n---\n\n## Tablo: \`${t}\`\n`);

  // SHOW CREATE TABLE
  let sct = q(`SHOW CREATE TABLE \`${DB}\`.\`${t}\``);
  if (sct.rows.length) {
    const createStmt = sct.rows[0][1];
    print(`<details><summary>CREATE TABLE</summary>\n\n\`\`\`sql\n${createStmt}\n\`\`\`\n</details>\n`);
  }

  // Kolonlar
  print(`### Kolonlar\n`);
  let cols = q(`
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA, COLUMN_COMMENT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='${DB}' AND TABLE_NAME='${t}'
    ORDER BY ORDINAL_POSITION
  `);
  print(`| Kolon | Tip | Null | Varsayılan | Key | Extra | Açıklama |\n|---|---|---|---|---|---|---|`);
  for (const r of cols.rows) {
    const [name, type, nullable, def, key, extra, comment] = r;
    const d = (def === null) ? '—' : String(def).replace(/\|/g, '\\|');
    const c = comment ? String(comment).replace(/\|/g, '\\|') : '';
    print(`| \`${name}\` | \`${type}\` | ${nullable} | ${d} | ${key||''} | ${extra||''} | ${c} |`);
  }

  // Indexler
  print(`\n### Indexler\n`);
  let idx = q(`
    SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, COLLATION, SUB_PART
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA='${DB}' AND TABLE_NAME='${t}'
    ORDER BY INDEX_NAME, SEQ_IN_INDEX
  `);
  if (idx.rows.length) {
    print(`| Index | Unique? | Sıra | Kolon | Collation | SubPart |\n|---|---|---|---|---|---|`);
    for (const r of idx.rows) {
      const [iname, nonuniq, seq, col, coll, sub] = r;
      print(`| \`${iname}\` | ${nonuniq===0?'Evet':'Hayır'} | ${seq} | \`${col}\` | ${coll||''} | ${sub||''} |`);
    }
  } else {
    print(`(Index yok)\n`);
  }

  // Yabancı anahtarlar
  print(`\n### Yabancı Anahtarlar\n`);
  let fks = q(`
    SELECT kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME,
           rc.UPDATE_RULE, rc.DELETE_RULE
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      ON kcu.CONSTRAINT_NAME=rc.CONSTRAINT_NAME
     AND kcu.CONSTRAINT_SCHEMA=rc.CONSTRAINT_SCHEMA
    WHERE kcu.TABLE_SCHEMA='${DB}' AND kcu.TABLE_NAME='${t}' AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY kcu.CONSTRAINT_NAME, kcu.POSITION_IN_UNIQUE_CONSTRAINT
  `);
  if (fks.rows.length) {
    print(`| Ad | Kolon | Referans | ON UPDATE | ON DELETE |\n|---|---|---|---|---|`);
    for (const r of fks.rows) {
      const [name, col, rt, rc_, up, del] = r;
      print(`| \`${name}\` | \`${col}\` | \`${rt}\`(\`${rc_}\`) | ${up} | ${del} |`);
    }
  } else {
    print(`(FK yok)\n`);
  }
}

// ---- Görünümler
if (views.length) {
  print(`\n---\n\n## Görünümler\n`);
  for (const v of views) {
    print(`\n### View: \`${v}\`\n`);
    let scv = q(`SHOW CREATE VIEW \`${DB}\`.\`${v}\``);
    if (scv.rows.length) {
      const createView = scv.rows[0][1];
      print(`\n\`\`\`sql\n${createView}\n\`\`\`\n`);
    }
  }
}

// ---- Trigger'lar
print(`\n---\n\n## Trigger'lar\n`);
let trg = q(`
  SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING
  FROM INFORMATION_SCHEMA.TRIGGERS
  WHERE TRIGGER_SCHEMA='${DB}'
  ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME
`);
if (trg.rows.length) {
  print(`| Ad | Zaman | Olay | Tablo |\n|---|---|---|---|`);
  for (const r of trg.rows) {
    const [name, ev, tab, timing] = r;
    print(`| \`${name}\` | ${timing} | ${ev} | \`${tab}\` |`);
  }
} else {
  print(`(Trigger yok)\n`);
}

// ---- Rutinler (PROCEDURE/FUNCTION)
print(`\n---\n\n## Rutinler (PROCEDURE / FUNCTION)\n`);
let rts = q(`
  SELECT ROUTINE_TYPE, ROUTINE_NAME
  FROM INFORMATION_SCHEMA.ROUTINES
  WHERE ROUTINE_SCHEMA='${DB}'
  ORDER BY ROUTINE_TYPE, ROUTINE_NAME
`);
if (rts.rows.length) {
  for (const r of rts.rows) {
    const [type, name] = r;
    print(`\n### ${type}: \`${name}\`\n`);
    let scr = q(`SHOW CREATE ${type} \`${DB}\`.\`${name}\``);
    if (scr.rows.length) {
      const createTxt = scr.rows[0][2] || scr.rows[0][1]; // sütun index'i sürüme göre değişebilir
      print(`\n\`\`\`sql\n${createTxt}\n\`\`\`\n`);
    }
  }
} else {
  print(`(Rutin yok)\n`);
}

print(`\n---\n\n> Bu doküman MySQL Shell ile otomatik üretildi.\n`);
