import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

/**
 * Exporte des données vers un fichier Excel basé sur le template officiel.
 * - Ne touche absolument PAS aux lignes 1 à 6 (en-tête Sonatrach, logo et division préservés).
 * - Modifie à partir de la ligne 7 :
 *     - Ligne 7 : Titre centré sur toute la largeur du tableau
 *     - Ligne 9 : En-têtes avec largeurs, polices et bordures adaptées
 *     - Ligne 10+ : Données nettoyées et formatées avec le bon alignement (sans les décimales parasites)
 *
 * @param {string} templatePath - Chemin du template
 * @param {Array<Object>} dataRows - Données à insérer
 * @param {string} outputFileName - Nom du fichier de sortie
 * @param {Object} options - Options de mise en page (title, headers, columnWidths, columnAlignments, columnFormats)
 */
export const exportWithTemplate = async (
  templatePath,
  dataRows,
  outputFileName = 'export',
  options = {}
) => {
  if (!dataRows || dataRows.length === 0) {
    alert('Aucune donnée à exporter.');
    return;
  }

  const {
    title,
    headers,
    columnWidths = [],
    columnAlignments = [],
    columnFormats = [],
  } = options;

  const workbook = new ExcelJS.Workbook();

  try {
    const url =
      typeof templatePath === 'string' &&
      (templatePath.startsWith('http') ||
        templatePath.startsWith('data:') ||
        templatePath.startsWith('blob:'))
        ? templatePath
        : encodeURI(templatePath);

        console.log(templatePath + "||"+url)
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Échec HTTP ${response.status} (${response.statusText || 'Non trouvé'}) lors de l'accès au modèle.`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
  } catch (err) {
    console.error(`Erreur de chargement du template "${templatePath}" :`, err);
    alert(`Erreur lors du chargement du modèle Excel :\n${err.message || err}`);
    return;
  }

  // Ne conserver que la première feuille active pour l'export
  while (workbook.worksheets.length > 1) {
    workbook.removeWorksheet(workbook.worksheets[1].id);
  }

  const worksheet = workbook.worksheets[0];
  const numCols = headers ? headers.length : (dataRows[0] ? Object.keys(dataRows[0]).length : 5);

  // 1. NE PAS TOUCHER aux lignes 1 à 6 (En-tête officiel Sonatrach strictement préservé)

  // 2. Ligne 7 : Titre centré sur toute la largeur du tableau
  if (title) {
    // Retirer les fusions précédentes sur la ligne 7 (ex: A7:E7) pour s'adapter au nombre réel de colonnes
    try {
      worksheet.unMergeCells('A7:E7');
    } catch (e) {}
    try {
      worksheet.unMergeCells('A7:F7');
    } catch (e) {}
    try {
      worksheet.unMergeCells('A7:G7');
    } catch (e) {}

    const lastColLetter = worksheet.getColumn(numCols).letter;
    worksheet.mergeCells(`A7:${lastColLetter}7`);

    const titleCell = worksheet.getCell('A7');
    titleCell.value = title;
    titleCell.font = { name: 'Calibri', size: 14, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // 3. Ajuster la largeur des colonnes
  if (columnWidths && columnWidths.length > 0) {
    columnWidths.forEach((w, idx) => {
      worksheet.getColumn(idx + 1).width = w;
    });
  }

  // 4. Ligne 9 : En-têtes de colonnes propres avec bordures et alignement centré
  if (headers && Array.isArray(headers)) {
    headers.forEach((hdr, idx) => {
      const colNum = idx + 1;
      const cell = worksheet.getCell(9, colNum);
      cell.value = hdr;
      cell.font = { name: 'Calibri', size: 11, bold: true, italic: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      };
    });
  }

  // 5. Nettoyer les anciennes lignes d'exemple à partir de la ligne 10
  const totalRows = Math.max(worksheet.rowCount, 100);
  for (let r = 10; r <= totalRows; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= Math.max(numCols, 15); c++) {
      const cell = row.getCell(c);
      cell.value = null;
      cell.border = undefined;
      cell.fill = undefined;
      cell.numFmt = undefined;
    }
  }

  // 6. Insérer les nouvelles données à partir de la ligne 10
  const startRow = 10;
  const thinBorder = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  dataRows.forEach((rowData, index) => {
    const currentRow = startRow + index;
    const values = Array.isArray(rowData) ? rowData : Object.values(rowData);

    values.forEach((value, colIndex) => {
      const colNum = colIndex + 1;
      const cell = worksheet.getCell(currentRow, colNum);
      cell.value = value !== null && value !== undefined ? value : '';

      // Police standard et bordure complète
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = thinBorder;

      // Alignement spécifique par colonne
      const align = columnAlignments[colIndex] || 'left';
      cell.alignment = { vertical: 'middle', horizontal: align };

      // Format numérique spécifique par colonne (évite les décimales parasites sur N° Lot)
      if (columnFormats[colIndex]) {
        cell.numFmt = columnFormats[colIndex];
      } else if (typeof value === 'number') {
        // Entier par défaut sans décimales
        cell.numFmt = Number.isInteger(value) ? '#,##0' : '#,##0.00';
      }
    });
  });

  // 7. Ligne de TOTAL général avec calculs / formules d'addition
  const { totalConfig } = options;
  if (totalConfig && dataRows.length > 0) {
    const totalRowIndex = startRow + dataRows.length;
    const labelColEnd = totalConfig.labelColEnd || 2;

    const totalBorderStyle = {
      top: { style: 'thin' },
      bottom: { style: 'double' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };

    const totalFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' },
    };

    // Appliquer le style de fond et de bordure sur toute la largeur de la ligne de total
    for (let c = 1; c <= numCols; c++) {
      const cell = worksheet.getCell(totalRowIndex, c);
      cell.border = totalBorderStyle;
      cell.fill = totalFill;
      cell.font = { name: 'Calibri', size: 11, bold: true };
    }

    // Fusionner les cellules pour le label "TOTAL GÉNÉRAL"
    if (labelColEnd > 1) {
      const startLetter = worksheet.getColumn(1).letter;
      const endLetter = worksheet.getColumn(labelColEnd).letter;
      worksheet.mergeCells(`${startLetter}${totalRowIndex}:${endLetter}${totalRowIndex}`);
    }

    const labelCell = worksheet.getCell(totalRowIndex, 1);
    labelCell.value = totalConfig.label || 'TOTAL GÉNÉRAL';
    labelCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Insérer les formules et valeurs de somme pour les colonnes configurées
    if (totalConfig.columns && Array.isArray(totalConfig.columns)) {
      totalConfig.columns.forEach((colCfg) => {
        const colNum = colCfg.col;
        const cell = worksheet.getCell(totalRowIndex, colNum);

        // Calculer la somme JavaScript pour affichage immédiat
        const calculatedSum = dataRows.reduce((acc, row) => {
          const vals = Array.isArray(row) ? row : Object.values(row);

          const rawVal = vals[colNum - 1];
          const quantity =
            typeof rawVal === 'number'
              ? rawVal
              : parseFloat(rawVal) || 0;

          // Colonne Type Mouvement
          const movementType = vals[2];

          return acc + (movementType === 'OUT' ? -quantity : quantity);
        }, 0);

        // Formule Excel dynamique avec résultat pré-calculé
        cell.value = calculatedSum;

        cell.alignment = { vertical: 'middle', horizontal: colCfg.align || 'right' };
        if (colCfg.numFmt) {
          cell.numFmt = colCfg.numFmt;
        } else {
          cell.numFmt = Number.isInteger(calculatedSum) ? '#,##0' : '#,##0.00';
        }
      });
    }
  }

  // Configuration de l'impression pour que toutes les colonnes tiennent sur la page (pas de coupure)
  worksheet.pageSetup = {
    orientation: numCols > 5 ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  // Nettoyage des noms définis orphelins (definedNames)
  if (workbook.definedNames && Array.isArray(workbook.definedNames.model)) {
    workbook.definedNames.model = workbook.definedNames.model.filter(
      (nameObj) => !nameObj.localSheetId || nameObj.localSheetId === 0
    );
  }

  // 7. Télécharger le fichier complété
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${outputFileName}.xlsx`
  );
};

/**
 * Exporte un tableau d'objets au format CSV
 */
export const exportToCSV = (dataRows, outputFileName = 'export') => {
  if (!dataRows || dataRows.length === 0) {
    alert('Aucune donnée à exporter.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(dataRows);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${outputFileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Analyse et extrait les produits d'un fichier Excel d'inventaire
 * Compatible avec le modèle "inventaire produits pharmaceutiques2024.xlsx"
 * Supporte la lecture multi-feuilles, détection des en-têtes et nettoyage des données.
 *
 * @param {File} file - Fichier Excel sélectionné
 * @returns {Promise<{items: Array<Object>, totalCount: number, sheetNames: Array<string>}>}
 */
export const parseInventoryExcel = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('Aucun fichier fourni.'));
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const items = [];
        const sheetNames = workbook.SheetNames;

        sheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) return;

          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          if (!rows || rows.length === 0) return;

          // 1. Trouver l'index de la ligne d'en-tête (cherche 'designation' ou 'item')
          let headerIdx = -1;
          for (let i = 0; i < Math.min(rows.length, 15); i++) {
            const r = rows[i];
            if (
              r &&
              Array.isArray(r) &&
              r.some(
                (c) =>
                  typeof c === 'string' &&
                  (c.toLowerCase().includes('designation') ||
                    c.toLowerCase().includes('désignation'))
              )
            ) {
              headerIdx = i;
              break;
            }
          }

          // Si non trouvé par désignation, chercher 'item'
          if (headerIdx === -1) {
            for (let i = 0; i < Math.min(rows.length, 15); i++) {
              const r = rows[i];
              if (
                r &&
                Array.isArray(r) &&
                r.some(
                  (c) =>
                    typeof c === 'string' &&
                    c.toLowerCase().trim() === 'item'
                )
              ) {
                headerIdx = i;
                break;
              }
            }
          }

          if (headerIdx === -1) return; // Pas une feuille d'inventaire

          const headers = (rows[headerIdx] || []).map((h) =>
            h ? String(h).trim().toLowerCase() : ''
          );

          let desigCol = headers.findIndex(
            (h) => h.includes('designat') || h.includes('désignat')
          );
          let qtyCol = headers.findIndex(
            (h) => h.includes('quantit') || h.includes('qte')
          );
          let priceCol = headers.findIndex(
            (h) => h.includes('prix') || h.includes('pu')
          );

          // Valeurs par défaut si les colonnes ne sont pas détectées avec précision
          if (desigCol === -1) desigCol = 1;
          if (qtyCol === -1) qtyCol = 2;
          if (priceCol === -1) priceCol = 3;

          // 2. Extraire les lignes de données
          for (let r = headerIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;

            const rawDesig = row[desigCol];
            if (!rawDesig || typeof rawDesig !== 'string') continue;

            const name = rawDesig.trim();
            if (!name) continue;

            const lowerName = name.toLowerCase();
            // Ignorer les lignes de totaux ou de signatures
            if (
              lowerName.startsWith('total') ||
              lowerName.includes('chef centre') ||
              lowerName.includes('exploitation') ||
              lowerName.includes('direction') ||
              lowerName.includes('division')
            ) {
              continue;
            }

            const rawQty = row[qtyCol];
            const rawPrice = row[priceCol];

            let quantity = 0;
            if (rawQty !== undefined && rawQty !== null && rawQty !== '') {
              const parsedQ = parseInt(rawQty, 10);
              if (!isNaN(parsedQ) && parsedQ >= 0) {
                quantity = parsedQ;
              }
            }

            let unitPrice = 0.0;
            if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
              const parsedP = parseFloat(rawPrice);
              if (!isNaN(parsedP) && parsedP >= 0) {
                unitPrice = parsedP;
              }
            }

            items.push({
              name,
              category: 'Pharmaceutique',
              quantity,
              unitPrice,
              sheet: sheetName,
              row: r + 1,
            });
          }
        });

        resolve({
          items,
          totalCount: items.length,
          sheetNames,
        });
      } catch (err) {
        console.error('Erreur lors de la lecture du fichier Excel:', err);
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};