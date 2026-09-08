import * as XLSX from 'xlsx';

/**
 * Exporte des données vers un fichier Excel basé sur un modèle (template)
 * Si le modèle est inaccessible, un fichier Excel standard est généré automatiquement en repli.
 *
 * @param {string} templatePath - Chemin relatif vers le template (ex: '/templates/inventaire-produits.xlsx')
 * @param {Array<Object>} dataRows - Données à exporter (chaque objet représente une ligne)
 * @param {string} outputFileName - Nom du fichier de sortie (sans extension)
 * @param {number} sheetIndex - Index de la feuille cible (0 par défaut)
 */
export const exportWithTemplate = async (
  templatePath,
  dataRows,
  outputFileName = 'export',
  sheetIndex = 0
) => {
  if (!dataRows || dataRows.length === 0) {
    alert('Aucune donnée à exporter.');
    return;
  }

  let workbook;

  try {
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Template introuvable : ${templatePath} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    workbook = XLSX.read(arrayBuffer, { type: 'array' });
  } catch (err) {
    console.warn(`Impossible de charger le template "${templatePath}", repli sur un export Excel standard.`, err);
    // Repli de secours : génère un classeur propre avec SheetJS
    const fallbackSheet = XLSX.utils.json_to_sheet(dataRows);
    const fallbackWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(fallbackWb, fallbackSheet, 'Données');
    XLSX.writeFile(fallbackWb, `${outputFileName}.xlsx`);
    return;
  }

  const sheetName = workbook.SheetNames[sheetIndex] || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Première ligne de données (Ligne 10 dans le template Sonatrach)
  const startRow = 10;

  dataRows.forEach((rowData, index) => {
    const currentRow = startRow + index;
    const values = Object.values(rowData);

    values.forEach((value, colIndex) => {
      const cellAddress = XLSX.utils.encode_cell({
        r: currentRow - 1,
        c: colIndex,
      });

      const isNum = typeof value === 'number' && !isNaN(value);
      sheet[cellAddress] = {
        t: isNum ? 'n' : 's',
        v: value !== null && value !== undefined ? value : '',
      };
    });
  });

  // Mettre à jour la plage du tableau (!ref)
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:G10');
  range.e.r = Math.max(range.e.r, startRow - 1 + dataRows.length);
  sheet['!ref'] = XLSX.utils.encode_range(range);

  // Télécharger le classeur complété
  XLSX.writeFile(workbook, `${outputFileName}.xlsx`);
};

/**
 * Exporte un tableau d'objets au format CSV
 *
 * @param {Array<Object>} dataRows - Données à exporter
 * @param {string} outputFileName - Nom du fichier de sortie (sans extension)
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
