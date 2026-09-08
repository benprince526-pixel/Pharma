import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';

/**
 * Exporte des données vers un fichier Excel basé sur un modèle (template)
 * avec préservation de l'en-tête et insertion du logo.
 *
 * @param {string} templatePath - Chemin relatif vers le template
 * @param {Array<Object>} dataRows - Données à exporter
 * @param {string} outputFileName - Nom du fichier de sortie
 * @param {number} sheetIndex - Index de la feuille cible (0 par défaut)
 * @param {string} logoPath - Chemin vers le logo (ex: '/logo.png')
 */
export const exportWithTemplate = async (
  templatePath,
  dataRows,
  outputFileName = 'export',
  sheetIndex = 0,
  logoPath = '/logo.png'
) => {
  if (!dataRows || dataRows.length === 0) {
    alert('Aucune donnée à exporter.');
    return;
  }

  const workbook = new ExcelJS.Workbook();

  try {
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Template introuvable : ${templatePath} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
  } catch (err) {
    console.warn(`Impossible de charger le template "${templatePath}", repli sur export standard.`, err);
    
    // Repli de secours standard avec en-têtes automatiques
    const fallbackWb = new ExcelJS.Workbook();
    const fallbackSheet = fallbackWb.addWorksheet('Données');
    
    if (dataRows.length > 0) {
      fallbackSheet.columns = Object.keys(dataRows[0]).map((key) => ({ header: key, key }));
      fallbackSheet.addRows(dataRows);
    }

    const buffer = await fallbackWb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${outputFileName}.xlsx`);
    return;
  }

  const worksheet = workbook.worksheets[sheetIndex] || workbook.worksheets[0];

  // Ligne de début des données (Ligne 10 selon les templates Sonatrach, les lignes 1 à 9 étant réservées aux en-têtes/titres)
  const startRow = 10;

  dataRows.forEach((rowData, index) => {
    const currentRow = startRow + index;
    const values = Object.values(rowData);

    values.forEach((value, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1);
      
      // Dupliquer le style de la ligne modèle (ligne 10) si présent
      const templateCell = worksheet.getCell(startRow, colIndex + 1);
      if (templateCell && templateCell.style) {
        cell.style = { ...templateCell.style };
      }

      cell.value = value !== null && value !== undefined ? value : '';
    });
  });

  // Insertion du logo (en-tête en haut à gauche: A1)
  if (logoPath) {
    try {
      const logoResponse = await fetch(logoPath);
      if (logoResponse.ok) {
        const logoArrayBuffer = await logoResponse.arrayBuffer();
        const extension = logoPath.split('.').pop().toLowerCase() === 'jpg' ? 'jpeg' : 'png';

        const imageId = workbook.addImage({
          buffer: logoArrayBuffer,
          extension: extension,
        });

        // Positionnement du logo sur les cellules A1 à B4 (En-tête)
        worksheet.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 130, height: 65 },
        });
      }
    } catch (imageErr) {
      console.warn('Impossible d\'insérer le logo :', imageErr);
    }
  }

  // Nettoyage sécurisé des noms définis orphelins (definedNames)
  if (workbook.definedNames && Array.isArray(workbook.definedNames.model)) {
    workbook.definedNames.model = workbook.definedNames.model.filter((nameObj) => {
      return nameObj.localSheetId === undefined || nameObj.localSheetId === sheetIndex;
    });
  }

  // Génération du fichier binaire et téléchargement
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
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