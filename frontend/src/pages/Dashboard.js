import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { productService, authService, userService, decodeToken, batchService, stockMovementService } from '../services/api';
import companyLogo from '../services/logo.png';
import '../styles/Dashboard.css';
import { exportWithTemplate, exportToCSV, parseInventoryExcel } from '../services/excelService';

import prodTemplate from '../templates/inventaire produits pharmaceutiques2024.xlsx';
import lotTemplate from '../templates/inventaire lots pharmaceutiques2024.xlsx';
import mvtTemplate from '../templates/inventaire mouvements stock pharmaceutiques2024.xlsx';

// Composant réutilisable pour la pagination professionnelle des tableaux
const TablePagination = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemName = 'éléments',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  const pageNumbers = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="table-pagination-bar">
      <div className="pagination-info">
        Affichage de <strong>{startItem}</strong> à <strong>{endItem}</strong> sur <strong>{totalItems}</strong> {itemName}
      </div>

      <div className="pagination-controls">
        <div className="page-size-selector">
          <span>Lignes :</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="pagination-buttons">
          <button
            type="button"
            className="pag-btn"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="Première page"
          >
            «
          </button>
          <button
            type="button"
            className="pag-btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="Page précédente"
          >
            ‹
          </button>

          {startPage > 1 && <span className="pag-ellipsis">...</span>}

          {pageNumbers.map((p) => (
            <button
              type="button"
              key={p}
              className={`pag-btn ${p === currentPage ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ))}

          {endPage < totalPages && <span className="pag-ellipsis">...</span>}

          <button
            type="button"
            className="pag-btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            title="Page suivante"
          >
            ›
          </button>
          <button
            type="button"
            className="pag-btn"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            title="Dernière page"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
};

// En-tête de colonne avec indicateur de tri interactif
const SortableHeader = ({ label, field, sortConfig, onSort, align = 'left', style = {} }) => {
  const isSorted = sortConfig.field === field;
  const isAsc = sortConfig.direction === 'asc';

  return (
    <th
      className={`sortable-th text-${align}`}
      onClick={() => onSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none', ...style }}
      title={`Cliquer pour trier par ${label}`}
    >
      <div className={`th-content align-${align}`}>
        <span>{label}</span>
        <span className={`sort-icon-indicator ${isSorted ? 'active' : ''}`}>
          {isSorted ? (isAsc ? ' ▲' : ' ▼') : ' ↕'}
        </span>
      </div>
    </th>
  );
};

// Fonction de tri générique
const genericSort = (list, sortConfig, getValue) => {
  if (!sortConfig || !sortConfig.field) return list;
  return [...list].sort((a, b) => {
    const valA = getValue ? getValue(a, sortConfig.field) : a[sortConfig.field];
    const valB = getValue ? getValue(b, sortConfig.field) : b[sortConfig.field];

    if (valA === valB) return 0;
    if (valA === null || valA === undefined || valA === '') return 1;
    if (valB === null || valB === undefined || valB === '') return -1;

    let comp = 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      comp = valA - valB;
    } else {
      comp = String(valA).localeCompare(String(valB), 'fr', { numeric: true, sensitivity: 'base' });
    }

    return sortConfig.direction === 'asc' ? comp : -comp;
  });
};

// Gestionnaire d'inversion ou changement de colonne de tri
const handleSort = (sortConfig, setSortConfig, field) => {
  setSortConfig((prev) => {
    if (prev.field === field) {
      return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    }
    return { field, direction: 'asc' };
  });
};

function Dashboard({ onLogout }) {
  const [activeSection, setActiveSection] = useState('home');
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [users, setUsers] = useState([]);

  // États de recherche, filtrage, tri et pagination pour les tableaux
  const [medSearch, setMedSearch] = useState('');
  const [medFilter, setMedFilter] = useState('all'); // all, in_stock, out_of_stock
  const [medSort, setMedSort] = useState({ field: 'item', direction: 'asc' });
  const [medPage, setMedPage] = useState(1);
  const [medPageSize, setMedPageSize] = useState(15);

  const [batchSearch, setBatchSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('all'); // all, with_expiry, no_expiry, low_stock
  const [batchSort, setBatchSort] = useState({ field: 'batch_id', direction: 'desc' });
  const [batchPage, setBatchPage] = useState(1);
  const [batchPageSize, setBatchPageSize] = useState(15);

  const [expSearch, setExpSearch] = useState('');
  const [expSort, setExpSort] = useState({ field: 'expiryDate', direction: 'asc' });
  const [expPage, setExpPage] = useState(1);
  const [expPageSize, setExpPageSize] = useState(15);

  const [mvtSearch, setMvtSearch] = useState('');
  const [mvtFilter, setMvtFilter] = useState('all'); // all, IN, OUT
  const [mvtDate, setMvtDate] = useState(''); // YYYY-MM-DD
  const [mvtSort, setMvtSort] = useState({ field: 'id', direction: 'desc' });
  const [mvtPage, setMvtPage] = useState(1);
  const [mvtPageSize, setMvtPageSize] = useState(15);

  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all'); // all, ADMIN, PHARMACIST, STOCK_MANAGER
  const [userSort, setUserSort] = useState({ field: 'username', direction: 'asc' });
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);

  // États pour les graphiques interactifs (plots)
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredDonut, setHoveredDonut] = useState(null);

  // États pour l'import Excel d'inventaire
  const [showImportModal, setShowImportModal] = useState(false);
  const [importItems, setImportItems] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importFileDetails, setImportFileDetails] = useState(null);
  const fileInputRef = useRef(null);
  const [editingUser, setEditingUser] = useState(null);
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'PHARMACIST',
  });
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    role: 'PHARMACIST',
    password: '',

  });
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
  const [username, setUsername] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [showAddProductForm, setShowAddProductForm] = useState(false);
  const [addProductForm, setAddProductForm] = useState({
    item: '',
    designation: '',
    unitPrice: '',
  });
  const [addProductError, setAddProductError] = useState('');
  const [addProductSuccess, setAddProductSuccess] = useState('');
  
  // State for Product Editing
  const [editingProductId, setEditingProductId] = useState(null);
  const [editProductForm, setEditProductForm] = useState({
    product_id: 0,
    item: '',
    designation: '',
    quantity: '',
    unitPrice: '',
  });

  const [showAddBatchForm, setShowAddBatchForm] = useState(false);
  const [addBatchForm, setAddBatchForm] = useState({
    batch_id: '',
    expiryDate: '',
    product: '',
    batch_quantity: 0
  });
  const [addBatchError, setAddBatchError] = useState('');
  const [addBatchSuccess, setAddBatchSuccess] = useState('');
  
  // State for Batch Editing
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [editBatchForm, setEditBatchForm] = useState({
    batch_id: '',
    expiryDate: '',
    product: '',
    batch_quantity: 0
  });

  const navigate = useNavigate();

  const fetchMedicines = async () => {
    try {
      const response = await productService.getAll();
      if (response.data && Array.isArray(response.data)) {
        setMedicines(response.data);
      } 
    } catch (error) {
      console.error('Error fetching products from API:', error);
    } finally {
      setLoading(false);
    }
  };

const fetchBatches = async () => {
  try {
    const response = await batchService.getAll();

    //console.log("BATCHES AFTER FETCH:", response.data);

    if (response.data && Array.isArray(response.data)) {
      setBatches(response.data);
    }
  } catch (error) {
    console.error(error);
  }
};
  useEffect(() => {
    fetchMedicines();
    fetchBatches();
    fetchStockMovements();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = decodeToken(token);
      setUsername(decoded?.sub || 'User');
      if (decoded && decoded.role === 'ADMIN') {
        setIsAdmin(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      const fetchUsers = async () => {
        try {
          const response = await userService.getAllUsers();
          setUsers(response.data || []);
        } catch (error) {
          console.error('Error fetching users:', error);
        }
      };
      fetchUsers();
    }
  }, [isAdmin]);

  const handleImportFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportError('');
    setImportSuccess('');

    try {
      const parsed = await parseInventoryExcel(file);
      if (!parsed.items || parsed.items.length === 0) {
        alert('Aucun produit valide trouvé dans ce fichier Excel.');
        setImportLoading(false);
        return;
      }

      // Identifier les produits déjà existants dans la base
      const existingNamesSet = new Set(
        medicines.map(m => (m.item || '').trim().toLowerCase())
      );

      // Suivre aussi les noms apparus dans les feuilles précédentes pour marquer les doublons
      const seenNamesInImport = new Set();

      const itemsWithStatus = parsed.items.map((it, idx) => {
        const lowerName = it.name.trim().toLowerCase();
        const existsInDb = existingNamesSet.has(lowerName);
        const existsInPreviousRows = seenNamesInImport.has(lowerName);
        const isExisting = existsInDb || existsInPreviousRows;

        seenNamesInImport.add(lowerName);

        return {
          ...it,
          id: idx + 1,
          isExisting,
        };
      });

      setImportFileDetails({
        fileName: file.name,
        totalCount: parsed.totalCount,
        sheetNames: parsed.sheetNames,
      });
      setImportItems(itemsWithStatus);
      setShowImportModal(true);
    } catch (err) {
      console.error('Erreur importation:', err);
      alert("Erreur lors de l'analyse du fichier Excel: " + (err.message || err));
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!importItems || importItems.length === 0) return;

    setImportLoading(true);
    setImportError('');
    setImportSuccess('');

    try {
      const payload = importItems.map(item => ({
        name: item.name,
        category: item.category || 'Pharmaceutique',
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
      }));

      const res = await productService.importProducts(payload);
      const data = res.data;

      setImportSuccess(
        `Importation réussie ! ${data.productsCreated} nouveau(x) produit(s), ${data.productsUpdated} produit(s) rattaché(s), ${data.batchesCreated} lot(s) créé(s), ${data.movementsCreated} mouvement(s) de stock initial créé(s).`
      );

      await fetchStockMovements();
      await fetchBatches();
      await fetchMedicines();

      setTimeout(() => {
        setShowImportModal(false);
        setImportSuccess('');
        setImportItems([]);
      }, 3500);
    } catch (err) {
      console.error('Erreur lors de la confirmation d’importation:', err);
      setImportError(
        err.response?.data?.message ||
        "Une erreur s'est produite lors de l'enregistrement de l'inventaire importé."
      );
    } finally {
      setImportLoading(false);
    }
  };

  const handleCloseImportModal = () => {
    if (importLoading) return;
    setShowImportModal(false);
    setImportItems([]);
    setImportError('');
    setImportSuccess('');
  };
  const handleLogout = () => {
    authService.logout();
    onLogout();
    navigate('/login');
  };

  const handleAddProductChange = (e) => {
    const { name, value } = e.target;
    setAddProductForm({ ...addProductForm, [name]: value });
  };

  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    setAddProductError('');
    setAddProductSuccess('');

    if (
      !addProductForm.item?.trim() ||
      !addProductForm.designation?.trim() ||
      !addProductForm.unitPrice
    ) {
      setAddProductError('Tous les champs sont obligatoires');
      return;
    }

    try {
      const newProduct = {
        item: addProductForm.item.trim(),
        designation: addProductForm.designation.trim(),
        quantity: 0,
        unitPrice: Number(addProductForm.unitPrice)
      };

      await productService.create(newProduct);

      setAddProductSuccess('Médicament ajouté avec succès!');
      setAddProductForm({
        item: '',
        designation: '',
        unitPrice: ''
      });

      await fetchStockMovements();
      await fetchBatches();
      await fetchMedicines();
      setTimeout(() => setShowAddProductForm(false), 1500);

    } catch (error) {
      console.error(error);
      setAddProductError(
        error.response?.data?.message ||
        "Erreur lors de l'ajout du médicament"
      );
    }
  };

  const handleEditProduct = (medicine) => {
    setEditingProductId(medicine.product_id);
    setEditProductForm({
      product_id: medicine.product_id,
      item: medicine.item,
      designation: medicine.designation,
      quantity: medicine.quantity,
      unitPrice: medicine.unitPrice,
    });
  };

  const handleEditProductChange = (e) => {
    const { name, value } = e.target;
    setEditProductForm({ ...editProductForm, [name]: value });
  };

  const handleUpdateProduct = async (id) => {
    try {
      const updatedProduct = {
        product_id: editProductForm.product_id,
        item: editProductForm.item,
        designation: editProductForm.designation,
        quantity: parseInt(editProductForm.quantity),
        unitPrice: parseFloat(editProductForm.unitPrice),
      };

      if (productService.update) {
        await productService.update(id, updatedProduct);
      } else {
        setMedicines(medicines.map((med) => (med.id === id ? { ...med, ...updatedProduct } : med)));
      }
      
      setEditingProductId(null);
      await fetchStockMovements();
      await fetchBatches();
      await fetchMedicines();
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Erreur lors de la mise à jour du médicament');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce médicament?')) {
      try {
        if (productService.delete) {
          await productService.delete(id);
        }
        setMedicines(
          medicines.filter(
            (med) => med.product_id !== id
          )
        );
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Erreur lors de la suppression');
      }
    }
  };

  const initialAddBatchState = { expiryDate: '', product: '', batch_quantity: '' };

  const handleAddBatchChange = (e) => {
    const { name, value } = e.target;
    setAddBatchForm({ ...addBatchForm, [name]: value });
  };

  const handleAddBatchSubmit = async (e) => {
    e.preventDefault();
    setAddBatchError('');
    setAddBatchSuccess('');

    if (
      !addBatchForm.expiryDate ||
      !addBatchForm.product ||
      addBatchForm.batch_quantity === '' ||
      addBatchForm.batch_quantity === null
    ) {
      setAddBatchError('Tous les champs sont obligatoires');
      return;
    }

    const selectedProductId = parseInt(addBatchForm.product, 10);
    const quantityValue = parseInt(addBatchForm.batch_quantity, 10);

    if (isNaN(selectedProductId)) {
      setAddBatchError("Veuillez sélectionner un médicament valide.");
      return;
    }

    if (isNaN(quantityValue) || quantityValue < 0) {
      setAddBatchError("La quantité du lot doit être un nombre supérieur ou égal à zéro.");
      return;
    }

    try {
      const newBatch = {
        expiryDate: addBatchForm.expiryDate,
        batch_quantity: quantityValue,
        product: {
          product_id: selectedProductId
        }
      };

      await batchService.create(newBatch);

      setAddBatchSuccess('Lot ajouté avec succès!');
      setAddBatchForm(initialAddBatchState);
      await fetchStockMovements();
      await fetchBatches();
      await fetchMedicines();
      setTimeout(() => setShowAddBatchForm(false), 1500);
    } catch (error) {
      console.error('Error adding Batch:', error);
      setAddBatchError(error.response?.data?.message || "Erreur lors de l'ajout d'un lot");
    }
  };

  const handleEditBatch = (batch) => {
    const id = batch.batch_id || batch.batchId;
    const productId = batch.product?.product_id || batch.product?.productId || batch.product?.id || batch.product || '';

    setEditingBatchId(id);
    setEditBatchForm({
      batch_id: id,
      expiryDate: batch.expiryDate || '',
      batch_quantity: batch.batch_quantity || batch.quantity || 0,
      product: productId
    });
  };

  const handleEditBatchChange = (e) => {
    const { name, value } = e.target;
    setEditBatchForm({ ...editBatchForm, [name]: value });
  };

  const handleUpdateBatch = async (id) => {
    const productId = parseInt(editBatchForm.product, 10);
    const quantityValue = parseInt(editBatchForm.batch_quantity, 10);

    if (isNaN(productId) || isNaN(quantityValue) || quantityValue < 0) {
      alert("Veuillez saisir un produit valide et une quantité ≥ 0.");
      return;
    }

    try {
      const updatedBatch = {
        batch_id: id,
        expiryDate: editBatchForm.expiryDate,
        batch_quantity: quantityValue,
        product: {
          product_id: productId
        }
      };

      if (batchService.update) {
        await batchService.update(id, updatedBatch);
      } else {
        setBatches(
          batches.map((batch) => {
            const currentId = batch.batch_id || batch.batchId;
            return currentId === id ? { ...batch, ...updatedBatch } : batch;
          })
        );
      }

      setEditingBatchId(null);
      await fetchStockMovements();
      await fetchBatches();
      await fetchMedicines();
    } catch (error) {
      console.error('Error updating Batch:', error);
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour du lot');
    }
  };

  const handleDeleteBatch = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce lot?')) {
      try {
        if (batchService.delete) {
          await batchService.delete(id);
        }
        setBatches(batches.filter((batch) => (batch.batch_id || batch.batchId) !== id));
      } catch (error) {
        console.error('Error deleting Batch:', error);
        alert('Erreur lors de la suppression');
      }
    }
  };
// Retirer la quantité (Mouvement de sortie)
const handleClearExpiredBatch = async (batch) => {
  if (window.confirm(`Retirer toute la quantité (${batch.batch_quantity}) du lot #${batch.batch_id} ?`)) {
    try {
      await batchService.clearExpired(batch.batch_id);
      await fetchStockMovements();
      await fetchBatches();
      await fetchMedicines();
    } catch (error) {
      console.error("Erreur lors du retrait du lot périmé:", error);
      alert("Erreur lors du retrait du lot");
    }
  }
};

// Archiver le lot (Masquer des calculs sans changer batch_quantity)
const handleArchiveBatch = async (batch) => {
  if (window.confirm(`Archiver le lot #${batch.batch_id} ? Il sera exclu des calculs de stock.`)) {
    try {
      await batchService.archive(batch.batch_id);
      await fetchStockMovements();
      await fetchBatches();
      await fetchMedicines();
    } catch (error) {
      console.error("Erreur lors de l'archivage du lot:", error);
      alert("Erreur lors de l'archivage");
    }
  }
};

  const initialAddMovementState = {
    movement_type: 'IN',
    productId: '',
    batch: '',
    quantity: '',
    reason: ''
  };

  const initialEditMovementState = {
    id: '',
    movement_type: '',
    quantity: '',
    reason: '',
    batch: ''
  };

  const [stockMovements, setStockMovements] = useState([]);
  const [showAddMovementForm, setShowAddMovementForm] = useState(false);
  const [addMovementForm, setAddMovementForm] = useState(initialAddMovementState);
  const [addMovementError, setAddMovementError] = useState('');
  const [addMovementSuccess, setAddMovementSuccess] = useState('');

  const [editingMovementId, setEditingMovementId] = useState(null);
  const [editMovementForm, setEditMovementForm] = useState(initialEditMovementState);

  const fetchStockMovements = async () => {
    try {
      const response = await stockMovementService.getAll();
      if (response.data && Array.isArray(response.data)) {
        setStockMovements(response.data);
      }
    } catch (error) {
      console.error('Error fetching stock movements from API:', error);
    }
  };

  const handleAddMovementChange = (e) => {
    const { name, value } = e.target;
    setAddMovementForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMovementProductChange = (e) => {
    const selectedProdId = e.target.value;
    setAddMovementForm((prev) => ({
      ...prev,
      productId: selectedProdId,
      batch: ''
    }));
  };

  const handleAddMovementSubmit = async (e) => {
    e.preventDefault();
    setAddMovementError('');
    setAddMovementSuccess('');

    if (!addMovementForm.productId) {
      setAddMovementError('Veuillez d\'abord sélectionner un médicament / produit.');
      return;
    }

    if (!addMovementForm.batch) {
      setAddMovementError('Veuillez sélectionner un lot pour ce produit.');
      return;
    }

    if (!addMovementForm.movement_type || !addMovementForm.quantity || !addMovementForm.reason) {
      setAddMovementError('Tous les champs sont obligatoires');
      return;
    }

    const selectedBatchId = parseInt(addMovementForm.batch, 10);
    const quantityValue = parseInt(addMovementForm.quantity, 10);

    if (isNaN(selectedBatchId)) {
      setAddMovementError('Veuillez sélectionner un lot valide.');
      return;
    }

    if (isNaN(quantityValue) || quantityValue <= 0) {
      setAddMovementError('La quantité doit être un nombre supérieur à zéro.');
      return;
    }

    const targetBatch = batches.find(
      (b) => String(b.batch_id || b.batchId) === String(selectedBatchId)
    );
    if (addMovementForm.movement_type === 'OUT' && targetBatch) {
      const currentBatchQty = Number(targetBatch.batch_quantity) || 0;
      if (quantityValue > currentBatchQty) {
        setAddMovementError(
          `Quantité insuffisante : le lot #${selectedBatchId} ne contient que ${currentBatchQty} unité(s).`
        );
        return;
      }
    }

    try {
      const newMovement = {
        movement_type: addMovementForm.movement_type,
        quantity: quantityValue,
        reason: addMovementForm.reason,
        batch: {
          batch_id: selectedBatchId
        }
      };

      await stockMovementService.create(newMovement);

      setAddMovementSuccess('Mouvement de stock ajouté avec succès!');
      setAddMovementForm(initialAddMovementState);
      await fetchStockMovements();
      await fetchBatches();
      await fetchMedicines();
      setTimeout(() => setShowAddMovementForm(false), 1500);
    } catch (error) {
      console.error('Error adding stock movement:', error);
      setAddMovementError(error.response?.data?.message || "Erreur lors de l'ajout du mouvement de stock");
    }
  };

  const handleEditMovement = (movement) => {
    const id = movement.id;
    const batchId = movement.batch?.batch_id || movement.batch?.batchId || movement.batch || '';

    setEditingMovementId(id);
    setEditMovementForm({
      id: id,
      movement_type: movement.movement_type || 'IN',
      quantity: movement.quantity || 0,
      reason: movement.reason || '',
      batch: batchId
    });
  };

  const handleEditMovementChange = (e) => {
    const { name, value } = e.target;
    setEditMovementForm({
      ...editMovementForm,
      [name]: value
    });
  };

  const handleUpdateMovement = async (id) => {
    const batchId = parseInt(editMovementForm.batch, 10);
    const quantityValue = parseInt(editMovementForm.quantity, 10);

    if (isNaN(batchId) || isNaN(quantityValue) || quantityValue <= 0 || !editMovementForm.reason) {
      alert('Veuillez saisir une quantité, une raison et un lot valides.');
      return;
    }

    try {
      const updatedMovement = {
        id: id,
        movement_type: editMovementForm.movement_type,
        quantity: quantityValue,
        reason: editMovementForm.reason,
        batch: {
          batch_id: batchId
        }
      };

      if (stockMovementService.update) {
        await stockMovementService.update(id, updatedMovement);
      } else {
        setStockMovements(
          stockMovements.map((m) => (m.id === id ? { ...m, ...updatedMovement } : m))
        );
      }

      setEditingMovementId(null);
      await fetchStockMovements();
      await fetchBatches();
      await fetchMedicines();
    } catch (error) {
      console.error('Error updating stock movement:', error);
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour du mouvement');
    }
  };

  const handleDeleteMovement = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce mouvement de stock?')) {
      try {
        if (stockMovementService.delete) {
          await stockMovementService.delete(id);
        }
        setStockMovements(stockMovements.filter((m) => m.id !== id));
        await fetchStockMovements();
        await fetchBatches();
        await fetchMedicines();
      } catch (error) {
        console.error('Error deleting stock movement:', error);
        alert('Erreur lors de la suppression');
      }
    }
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterForm({ ...registerForm, [name]: value });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterSuccess('');

    try {
      await userService.register(
        registerForm.username,
        registerForm.email,
        registerForm.password,
        registerForm.role
      );
      setRegisterSuccess('Utilisateur créé avec succès!');
      setRegisterForm({ username: '', email: '', password: '', role: 'PHARMACIST' });
      const response = await userService.getAllUsers();
      setUsers(response.data);
      setTimeout(() => setShowRegisterForm(false), 2000);
    } catch (error) {
      setRegisterError(error.response?.data?.message || 'Erreur lors de la création de l\'utilisateur');
    }
  };

  const handleEditUser = (user) => {
  setEditingUser(user.id);
  setEditForm({
    username: user.username,
    email: user.email,
    role: user.role,
    password: ''
  });
};

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });
  };

  const handleUpdateUser = async (userId) => {
  try {
    const payload = {
      username: editForm.username,
      email: editForm.email,
      role: editForm.role,
      password: editForm.password
    };

    // send password only if user entered one
    if (editForm.password?.trim()) {
      payload.password = editForm.password;
    }

    await userService.updateUser(userId, payload);

    const response = await userService.getAllUsers();
    setUsers(response.data);

    setEditingUser(null);
  } catch (error) {
    console.error('Error updating user:', error);
    alert('Erreur lors de la mise à jour de l\'utilisateur');
  }
};

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur?')) {
      try {
        await userService.deleteUser(userId);
        const response = await userService.getAllUsers();
        setUsers(response.data);
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Erreur lors de la suppression de l\'utilisateur');
      }
    }
  };

  const handleChangePasswordChange = (e) => {
    const { name, value } = e.target;
    setChangePasswordForm({ ...changePasswordForm, [name]: value });
  };

  const handleChangePasswordSubmit = (e) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      setChangePasswordError('Les nouveaux mots de passe ne correspondent pas!');
      return;
    }

    if (!changePasswordForm.newPassword || changePasswordForm.newPassword.length < 1) {
      setChangePasswordError('Le nouveau mot de passe ne peut pas être vide!');
      return;
    }

    setChangePasswordSuccess('Mot de passe changé avec succès!');
    setChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setTimeout(() => setShowChangePasswordForm(false), 2000);
  };

  const totalMedicines = medicines.length;

    const totalStock = batches
      .filter(batch => !batch.archived)
      .reduce(
        (total, batch) => total + batch.batch_quantity,
        0
      );
const totalValue = batches
  .filter(batch => !batch.archived)
  .reduce((sum, batch) => {
    const productId =
      batch.product?.product_id ||
      batch.product?.productId;

    const product = medicines.find(
      m => (m.product_id || m.productId) === productId
    );

    return sum + (Number(batch.batch_quantity) || 0) * (Number(product?.unitPrice) || 0);
  }, 0);
  // console.log("MEDICINES:", medicines);
  // console.log("BATCHES:", batches);
  // console.log("TOTAL STOCK:", totalStock);
  // console.log("TOTAL VALUE:", totalValue);

  const activeBatches = batches.filter(batch => {
    if (batch.archived) return false;
    if (!batch.expiryDate) return true; // Lot avec date null = non périmé
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(batch.expiryDate) >= today;
  });

  const expiredBatches = batches.filter(batch => {
    if (batch.archived) return false;
    if (!batch.expiryDate) return false; // Lot avec date null = non périmé
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(batch.expiryDate) < today;
  });

  // Fonction utilitaire pour calculer la quantité réelle en stock d'un produit (somme de ses lots actifs)
  const getProductQuantity = useCallback((med) => {
    if (!med) return 0;
    const prodId = med.product_id || med.productId || med.id;
    const prodBatches = batches.filter(
      b => !b.archived && ((b.product?.product_id || b.product?.id || b.product) === prodId)
    );
    if (prodBatches.length > 0) {
      return prodBatches.reduce((sum, b) => sum + (Number(b.batch_quantity) || 0), 0);
    }
    return Number(med.quantity) || 0;
  }, [batches]);

  // -------------------------------------------------------------
  // Filtrage, Tri et Pagination pour l'Inventaire des Médicaments
  // -------------------------------------------------------------
  const filteredMedicines = useMemo(() => {
    let list = medicines;

    if (medSearch.trim()) {
      const q = medSearch.trim().toLowerCase();
      list = list.filter(m =>
        (m.item && m.item.toLowerCase().includes(q)) ||
        (m.designation && m.designation.toLowerCase().includes(q)) ||
        (String(m.product_id).includes(q))
      );
    }

    if (medFilter === 'in_stock') {
      list = list.filter(m => getProductQuantity(m) > 0);
    } else if (medFilter === 'out_of_stock') {
      list = list.filter(m => getProductQuantity(m) <= 0);
    }

    return genericSort(list, medSort, (item, field) => {
      if (field === 'quantity') {
        return getProductQuantity(item);
      }
      if (field === 'total') {
        return getProductQuantity(item) * (Number(item.unitPrice) || 0);
      }
      return item[field];
    });
  }, [medicines, medSearch, medFilter, medSort, getProductQuantity]);

  const paginatedMedicines = useMemo(() => {
    const start = (medPage - 1) * medPageSize;
    return filteredMedicines.slice(start, start + medPageSize);
  }, [filteredMedicines, medPage, medPageSize]);

  // -------------------------------------------------------------
  // Filtrage, Tri et Pagination pour les Lots Actifs
  // -------------------------------------------------------------
  const filteredBatches = useMemo(() => {
    let list = activeBatches;

    if (batchSearch.trim()) {
      const q = batchSearch.trim().toLowerCase();
      list = list.filter(b => {
        const prodName = typeof b.product === 'object'
          ? (b.product?.item || b.product?.designation || '')
          : (medicines.find(m => (m.id ?? m.product_id) === b.product)?.item || '');
        const prodId = typeof b.product === 'object'
          ? (b.product?.product_id || b.product?.id || '')
          : String(b.product || '');
        return (
          String(b.batch_id).includes(q) ||
          prodName.toLowerCase().includes(q) ||
          String(prodId).includes(q) ||
          (b.expiryDate && b.expiryDate.includes(q))
        );
      });
    }

    if (batchFilter === 'with_expiry') {
      list = list.filter(b => b.expiryDate);
    } else if (batchFilter === 'no_expiry') {
      list = list.filter(b => !b.expiryDate);
    } else if (batchFilter === 'low_stock') {
      list = list.filter(b => (b.batch_quantity || 0) < 10);
    }

    return genericSort(list, batchSort, (b, field) => {
      if (field === 'productName') {
        return typeof b.product === 'object'
          ? (b.product?.item || b.product?.designation || '')
          : (medicines.find(m => (m.id ?? m.product_id) === b.product)?.item || '');
      }
      if (field === 'productId') {
        return typeof b.product === 'object'
          ? (b.product?.product_id || b.product?.id || 0)
          : (b.product || 0);
      }
      return b[field];
    });
  }, [activeBatches, batchSearch, batchFilter, batchSort, medicines]);

  const paginatedBatches = useMemo(() => {
    const start = (batchPage - 1) * batchPageSize;
    return filteredBatches.slice(start, start + batchPageSize);
  }, [filteredBatches, batchPage, batchPageSize]);

  // -------------------------------------------------------------
  // Filtrage, Tri et Pagination pour les Lots Périmés
  // -------------------------------------------------------------
  const filteredExpiredBatches = useMemo(() => {
    let list = expiredBatches;

    if (expSearch.trim()) {
      const q = expSearch.trim().toLowerCase();
      list = list.filter(b => {
        const prodName = typeof b.product === 'object' ? (b.product?.item || '') : '';
        return (
          String(b.batch_id).includes(q) ||
          prodName.toLowerCase().includes(q) ||
          (b.expiryDate && b.expiryDate.includes(q))
        );
      });
    }

    return genericSort(list, expSort, (b, field) => {
      if (field === 'productName') return typeof b.product === 'object' ? (b.product?.item || '') : '';
      return b[field];
    });
  }, [expiredBatches, expSearch, expSort]);

  const paginatedExpiredBatches = useMemo(() => {
    const start = (expPage - 1) * expPageSize;
    return filteredExpiredBatches.slice(start, start + expPageSize);
  }, [filteredExpiredBatches, expPage, expPageSize]);

  // -------------------------------------------------------------
  // Filtrage, Tri et Pagination pour l'Historique des Mouvements
  // -------------------------------------------------------------
  const filteredMovements = useMemo(() => {
    let list = stockMovements;

    if (mvtSearch.trim()) {
      const q = mvtSearch.trim().toLowerCase();
      list = list.filter(m => {
        const prodName = m.batch?.product?.item || '';
        const batchId = String(m.batch?.batch_id || '');
        const reason = (m.reason || '').toLowerCase();
        const type = (m.movement_type || '').toLowerCase();
        return (
          String(m.id).includes(q) ||
          prodName.toLowerCase().includes(q) ||
          batchId.includes(q) ||
          reason.includes(q) ||
          type.includes(q)
        );
      });
    }

    if (mvtFilter === 'IN') {
      list = list.filter(m => m.movement_type === 'IN');
    } else if (mvtFilter === 'OUT') {
      list = list.filter(m => m.movement_type === 'OUT');
    }

    if (mvtDate) {
      list = list.filter(m => {
        if (!m.createdAt) return false;
        if (typeof m.createdAt === 'string') {
          return m.createdAt.slice(0, 10) === mvtDate;
        }
        if (Array.isArray(m.createdAt) && m.createdAt.length >= 3) {
          const y = String(m.createdAt[0]);
          const mo = String(m.createdAt[1]).padStart(2, '0');
          const da = String(m.createdAt[2]).padStart(2, '0');
          return `${y}-${mo}-${da}` === mvtDate;
        }
        try {
          return new Date(m.createdAt).toISOString().slice(0, 10) === mvtDate;
        } catch (e) {
          return false;
        }
      });
    }

    return genericSort(list, mvtSort, (m, field) => {
      if (field === 'productName') return m.batch?.product?.item || '';
      if (field === 'batchId') return m.batch?.batch_id || 0;
      return m[field];
    });
  }, [stockMovements, mvtSearch, mvtFilter, mvtDate, mvtSort]);

  const paginatedMovements = useMemo(() => {
    const start = (mvtPage - 1) * mvtPageSize;
    return filteredMovements.slice(start, start + mvtPageSize);
  }, [filteredMovements, mvtPage, mvtPageSize]);

  // -------------------------------------------------------------
  // Filtrage et Pagination pour les Utilisateurs
  // -------------------------------------------------------------
  const filteredUsers = useMemo(() => {
    let list = users;
    if (userSearch.trim()) {
      const q = userSearch.trim().toLowerCase();
      list = list.filter(u =>
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
      );
    }
    if (userFilter !== 'all') {
      list = list.filter(u => u.role === userFilter);
    }
    return genericSort(list, userSort);
  }, [users, userSearch, userFilter, userSort]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, userPage, userPageSize]);

  // -------------------------------------------------------------
  // Données et Agrégations pour les Graphiques (Plots) de l'Accueil
  // -------------------------------------------------------------
  const medicineHealthData = useMemo(() => {
    const total = medicines.length;
    if (total === 0) return { inStock: 0, lowStock: 0, outOfStock: 0, total: 0 };
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    medicines.forEach(m => {
      const q = getProductQuantity(m);
      if (q <= 0) outOfStock++;
      else if (q <= 10) lowStock++;
      else inStock++;
    });
    return { inStock, lowStock, outOfStock, total };
  }, [medicines, getProductQuantity]);

  const batchHealthData = useMemo(() => {
    const total = batches.length;
    if (total === 0) return { valid: 0, noExpiry: 0, expired: 0, total: 0 };
    const expired = batches.filter(b => b.expiryDate && new Date(b.expiryDate) < new Date()).length;
    const noExpiry = batches.filter(b => !b.expiryDate).length;
    const valid = Math.max(0, total - expired - noExpiry);
    return { valid, noExpiry, expired, total };
  }, [batches]);

  const topMedicinesByStock = useMemo(() => {
    return [...medicines]
      .map(m => {
        const qty = getProductQuantity(m);
        const unitPrice = Number(m.unitPrice) || 0;
        return {
          id: m.id ?? m.product_id,
          name: m.item,
          designation: m.designation,
          qty,
          unitPrice,
          totalValue: qty * unitPrice
        };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [medicines, getProductQuantity]);

  const movementTimelineData = useMemo(() => {
    const map = {};
    stockMovements.forEach(m => {
      let dStr = '';
      if (m.createdAt) {
        if (typeof m.createdAt === 'string') {
          dStr = m.createdAt.slice(0, 10);
        } else if (Array.isArray(m.createdAt) && m.createdAt.length >= 3) {
          const y = String(m.createdAt[0]);
          const mo = String(m.createdAt[1]).padStart(2, '0');
          const da = String(m.createdAt[2]).padStart(2, '0');
          dStr = `${y}-${mo}-${da}`;
        } else {
          try {
            dStr = new Date(m.createdAt).toISOString().slice(0, 10);
          } catch(e) {
            dStr = '';
          }
        }
      }
      if (!dStr) return;
      if (!map[dStr]) map[dStr] = { inQty: 0, outQty: 0, totalCount: 0 };
      if (m.movement_type === 'IN') {
        map[dStr].inQty += (m.quantity || 0);
      } else if (m.movement_type === 'OUT') {
        map[dStr].outQty += (m.quantity || 0);
      }
      map[dStr].totalCount++;
    });

    const sortedDates = Object.keys(map).sort();
    const recentDates = sortedDates.slice(-7);
    return recentDates.map(date => {
      const parts = date.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
      return {
        date,
        formattedDate,
        inQty: map[date].inQty,
        outQty: map[date].outQty,
        count: map[date].totalCount
      };
    });
  }, [stockMovements]);

  // -------------------------------------------------------------
  // Fonctions d'Export (Excel / CSV) basées sur les filtres actifs
  // -------------------------------------------------------------
  const handleExportMedicines = async (format = 'excel') => {
    const listToExport = filteredMedicines;
    const data = listToExport.map((m, index) => {
      const quantity = getProductQuantity(m);
      const unitPrice = Number(m.unitPrice) || 0;
      return {
        item: index + 1,
        designation: `${m.item}${m.designation ? ` (${m.designation})` : ''}`,
        quantite: quantity,
        prixU: unitPrice,
        total: quantity * unitPrice
      };
    });

    if (format === 'csv') {
      exportToCSV(data, 'inventaire_medicaments');
    } else {
      let filterDetails = [];
      if (medFilter === 'in_stock') filterDetails.push('En stock');
      if (medFilter === 'out_of_stock') filterDetails.push('En rupture');
      if (medSearch) filterDetails.push(`Recherche: "${medSearch}"`);
      const filterSuffix = filterDetails.length > 0 ? ` (${filterDetails.join(' | ')})` : '';

      await exportWithTemplate(
        prodTemplate || '/templates/inventaire produits pharmaceutiques2024.xlsx',
        data,
        'inventaire_medicaments',
        {
          title: `Inventaire des produits pharmaceutiques${filterSuffix} au ${new Date().toLocaleDateString('fr-FR')}`,
          headers: ['Item', 'Designation', 'Quantité', 'Prix U', 'Total'],
          columnWidths: [12, 42, 14, 14, 16],
          columnAlignments: ['center', 'left', 'center', 'right', 'right'],
          columnFormats: ['0', undefined, '#,##0', '#,##0.00', '#,##0.00'],
          totalConfig: {
            label: 'TOTAL GÉNÉRAL',
            labelColEnd: 2,
            columns: [
              { col: 3, numFmt: '#,##0', align: 'center' },
              { col: 5, numFmt: '#,##0.00', align: 'right' }
            ]
          }
        }
      );
    }
  };

  const handleExportBatches = async (format = 'excel') => {
    const listToExport = filteredBatches;
    const data = listToExport.map((b) => {
      const prodName = typeof b.product === 'object'
        ? (b.product?.item || b.product?.designation || 'N/A')
        : (medicines.find(m => (m.id ?? m.product_id) === b.product)?.item || 'N/A');
      return {
        idLot: b.batch_id || b.batchId,
        produit: prodName,
        quantite: b.batch_quantity || 0,
        expiration: b.expiryDate || 'Sans date',
        statut: b.archived ? 'Archivé' : 'Actif'
      };
    });

    if (format === 'csv') {
      exportToCSV(data, 'inventaire_lots');
    } else {
      let filterDetails = [];
      if (batchFilter === 'with_expiry') filterDetails.push('Avec date');
      if (batchFilter === 'no_expiry') filterDetails.push('Sans date');
      if (batchFilter === 'low_stock') filterDetails.push('Stock faible < 10');
      if (batchSearch) filterDetails.push(`Recherche: "${batchSearch}"`);
      const filterSuffix = filterDetails.length > 0 ? ` (${filterDetails.join(' | ')})` : '';

      await exportWithTemplate(
        lotTemplate || '/templates/inventaire lots pharmaceutiques2024.xlsx',
        data,
        'lots',
        {
          title: `Inventaire des lots pharmaceutiques${filterSuffix} au ${new Date().toLocaleDateString('fr-FR')}`,
          headers: ['N° Lot', 'Produit', 'Quantité', 'Date Expiration', 'Statut'],
          columnWidths: [14, 38, 14, 18, 16],
          columnAlignments: ['center', 'left', 'center', 'center', 'center'],
          columnFormats: ['0', undefined, '#,##0', '@', '@'],
          totalConfig: {
            label: 'TOTAL GÉNÉRAL',
            labelColEnd: 2,
            columns: [
              { col: 3, numFmt: '#,##0', align: 'center' }
            ]
          }
        }
      );
    }
  };

  const handleExportMovements = async (format = 'excel') => {
    const listToExport = filteredMovements;
    const data = listToExport.map((m) => {
      let dateStr = '';
      if (m.createdAt) {
        try {
          dateStr = new Date(m.createdAt).toLocaleString('fr-FR');
        } catch (e) {
          dateStr = String(m.createdAt);
        }
      }
      const prodName = (typeof m.batch === 'object' && m.batch?.product?.item)
        ? m.batch.product.item
        : (medicines.find(med => (med.id ?? med.product_id) === (m.batch?.product?.id || m.batch?.product))?.item || 'N/A');
      const batchId = (typeof m.batch === 'object')
        ? (m.batch?.batch_id || m.batch?.batchId || 'N/A')
        : (m.batch || 'N/A');

      return {
        id: m.id,
        date: dateStr,
        type: m.movement_type === 'IN' ? 'ENTRÉE (IN)' : m.movement_type === 'OUT' ? 'SORTIE (OUT)' : (m.movement_type || ''),
        produit: prodName,
        lot: batchId,
        quantite: m.quantity || 0,
        motif: m.reason || ''
      };
    });

    if (format === 'csv') {
      exportToCSV(data, 'mouvements_stock');
    } else {
      let filterDetails = [];
      if (mvtDate) filterDetails.push(`Date: ${mvtDate}`);
      if (mvtFilter === 'IN') filterDetails.push('Type: ENTRÉES');
      if (mvtFilter === 'OUT') filterDetails.push('Type: SORTIES');
      if (mvtSearch) filterDetails.push(`Recherche: "${mvtSearch}"`);
      const filterSuffix = filterDetails.length > 0 ? ` (${filterDetails.join(' | ')})` : '';

      await exportWithTemplate(
        mvtTemplate || '/templates/inventaire mouvements stock pharmaceutiques2024.xlsx',
        data,
        'mouvements_stock',
        {
          title: `Historique des mouvements de stock${filterSuffix} au ${new Date().toLocaleDateString('fr-FR')}`,
          headers: ['N° Mouvement', 'Date & Heure', 'Type Mouvement', 'Produit', 'N° Lot', 'Quantité', 'Motif'],
          columnWidths: [16, 22, 18, 30, 14, 14, 28],
          columnAlignments: ['center', 'center', 'center', 'left', 'center', 'center', 'left'],
          columnFormats: ['0', undefined, '@', undefined, '0', '#,##0', undefined],
          totalConfig: {
            label: 'TOTAL GÉNÉRAL',
            labelColEnd: 5,
            columns: [
              { col: 6, numFmt: '#,##0', align: 'center' }
            ]
          }
        }
      );
    }
  };

  const handleExportExpiredBatches = async (format = 'excel') => {
    const listToExport = filteredExpiredBatches;
    const data = listToExport.map((b) => {
      const prodName = typeof b.product === 'object'
        ? (b.product?.item || b.product?.designation || 'N/A')
        : (medicines.find(m => (m.id ?? m.product_id) === b.product)?.item || 'N/A');
      return {
        idLot: b.batch_id || b.batchId,
        produit: prodName,
        quantite: b.batch_quantity || 0,
        expiration: b.expiryDate || 'N/A',
        statut: 'Périmé'
      };
    });

    if (format === 'csv') {
      exportToCSV(data, 'lots_perimes');
    } else {
      const filterSuffix = expSearch ? ` (Recherche: "${expSearch}")` : '';
      await exportWithTemplate(
        lotTemplate || '/templates/inventaire lots pharmaceutiques2024.xlsx',
        data,
        'lots_perimes',
        {
          title: `Inventaire des lots périmés${filterSuffix} au ${new Date().toLocaleDateString('fr-FR')}`,
          headers: ['N° Lot', 'Produit', 'Quantité', 'Date Expiration', 'Statut'],
          columnWidths: [14, 38, 14, 18, 16],
          columnAlignments: ['center', 'left', 'center', 'center', 'center'],
          columnFormats: ['0', undefined, '#,##0', '@', '@'],
          totalConfig: {
            label: 'TOTAL PÉRIMÉ',
            labelColEnd: 2,
            columns: [
              { col: 3, numFmt: '#,##0', align: 'center' }
            ]
          }
        }
      );
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="header-brand">
            <div className="header-logo-badge">
              <img src={companyLogo} alt="Sonatrach Logo" className="header-logo" />
            </div>
            <div className="header-brand-text">
              <h1>🏥 Pharma Inventory</h1>
              <p>Sonatrach Gassi Touil</p>
            </div>
          </div>
        </div>
        <div className="header-buttons">
          <div className="user-dropdown">
            <button 
              className="dropdown-toggle" 
              onClick={() => setShowDropdown(!showDropdown)}
            >
              👤 {username}
            </button>
            {showDropdown && (
              <div className="dropdown-menu">
                <button 
                  className="dropdown-item" 
                  onClick={() => {
                    setShowChangePasswordForm(true);
                    setShowDropdown(false);
                  }}
                >
                  🔒 Modifier mdp
                </button>
                <button 
                  className="dropdown-item logout-item" 
                  onClick={handleLogout}
                >
                  🚪 Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <button
            className={activeSection === 'home' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveSection('home')}
          >
            🏠 Accueil
          </button>

          <button
            className={activeSection === 'inventory' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveSection('inventory')}
          >
            📦 Produits
          </button>

          <button
            className={activeSection === 'batches' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveSection('batches')}
          >
            🏷️ Lots
          </button>

          <button
            className={activeSection === 'expiredBatches' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveSection('expiredBatches')}
          >
            ⏰ Lots périmés
          </button>

          <button
            className={activeSection === 'movements' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveSection('movements')}
          >
            📊 Mouvements
          </button>

          {isAdmin && (
            <button
              className={activeSection === 'users' ? 'nav-btn active' : 'nav-btn'}
              onClick={() => setActiveSection('users')}
            >
              👤 Utilisateurs
            </button>
          )}
        </aside>

        <main className="dashboard-main">
          {isAdmin && activeSection === 'users' && (
            <section className="admin-section">
              <div className="section-header">
                <h2>👤 Gestion des Utilisateurs</h2>
                <div className="header-actions">
                  <button 
                    className="add-button" 
                    onClick={() => setShowRegisterForm(!showRegisterForm)}
                  >
                    {showRegisterForm ? '✕ Fermer' : '+ Ajouter'}
                  </button>
                </div>
              </div>

              {showRegisterForm && (
                <div className="register-form-container">
                  <form onSubmit={handleRegisterSubmit} className="register-form">
                    <div className="form-group">
                      <label htmlFor="username">Nom d'utilisateur</label>
                      <input
                        id="username"
                        name="username"
                        type="text"
                        value={registerForm.username}
                        onChange={handleRegisterChange}
                        placeholder="Entrez le nom d'utilisateur"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">Email</label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={registerForm.email}
                        onChange={handleRegisterChange}
                        placeholder="Entrez l'adresse email"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="password">Mot de passe</label>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        value={registerForm.password}
                        onChange={handleRegisterChange}
                        placeholder="Entrez le mot de passe"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="role">Rôle</label>
                      <select
                        id="role"
                        name="role"
                        value={registerForm.role}
                        onChange={handleRegisterChange}
                      >
                        <option value="PHARMACIST">Pharmacien</option>
                        <option value="STOCK_MANAGER">Gestionnaire Stock</option>
                        <option value="ADMIN">Administrateur</option>
                      </select>
                    </div>

                    {registerError && <div className="error-message">{registerError}</div>}
                    {registerSuccess && <div className="success-message">{registerSuccess}</div>}

                    <button type="submit" className="submit-button">
                      Créer l'utilisateur
                    </button>
                  </form>
                </div>
              )}

              {/* Toolbar de Recherche et Filtres pour les Utilisateurs */}
              <div className="table-toolbar">
                <div className="search-bar-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Rechercher un utilisateur (nom, email, rôle)..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                    }}
                    className="table-search-input"
                  />
                  {userSearch && (
                    <button
                      className="clear-search-btn"
                      onClick={() => {
                        setUserSearch('');
                        setUserPage(1);
                      }}
                      title="Effacer la recherche"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="filter-chips-group">
                  <button
                    className={`filter-chip ${userFilter === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setUserFilter('all');
                      setUserPage(1);
                    }}
                  >
                    Tous ({users.length})
                  </button>
                  <button
                    className={`filter-chip ${userFilter === 'ADMIN' ? 'active' : ''}`}
                    onClick={() => {
                      setUserFilter('ADMIN');
                      setUserPage(1);
                    }}
                  >
                    Admins ({users.filter((u) => u.role === 'ADMIN').length})
                  </button>
                  <button
                    className={`filter-chip ${userFilter === 'PHARMACIST' ? 'active' : ''}`}
                    onClick={() => {
                      setUserFilter('PHARMACIST');
                      setUserPage(1);
                    }}
                  >
                    Pharmaciens ({users.filter((u) => u.role === 'PHARMACIST').length})
                  </button>
                  <button
                    className={`filter-chip ${userFilter === 'STOCK_MANAGER' ? 'active' : ''}`}
                    onClick={() => {
                      setUserFilter('STOCK_MANAGER');
                      setUserPage(1);
                    }}
                  >
                    Gestionnaires ({users.filter((u) => u.role === 'STOCK_MANAGER').length})
                  </button>
                </div>
              </div>

              {users.length === 0 ? (
                <div className="no-data">
                  <p>❌ Aucun utilisateur disponible</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="no-data">
                  <p>🔍 Aucun utilisateur ne correspond à votre recherche ou filtre.</p>
                  <button
                    className="reset-filters-btn"
                    onClick={() => {
                      setUserSearch('');
                      setUserFilter('all');
                      setUserPage(1);
                    }}
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <div className="users-table-wrapper">
                  <table className="users-table medicines-table">
                    <thead>
                      <tr>
                        <SortableHeader label="Nom d'utilisateur" field="username" sortConfig={userSort} onSort={(f) => handleSort(userSort, setUserSort, f)} />
                        <SortableHeader label="Email" field="email" sortConfig={userSort} onSort={(f) => handleSort(userSort, setUserSort, f)} />
                        <SortableHeader label="Rôle" field="role" sortConfig={userSort} onSort={(f) => handleSort(userSort, setUserSort, f)} align="center" />
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((user) => (
                        <tr key={user.id}>
                          {editingUser === user.id ? (
                            <>
                              <td>
                                <input
                                  type="text"
                                  name="username"
                                  value={editForm.username}
                                  onChange={handleEditChange}
                                  className="edit-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="email"
                                  name="email"
                                  value={editForm.email}
                                  onChange={handleEditChange}
                                  className="edit-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="password"
                                  name="password"
                                  value={editForm.password || ""}
                                  onChange={handleEditChange}
                                  className="edit-input"
                                  placeholder="Nouveau mot de passe"
                                />
                              </td>
                              <td>
                                <select
                                  name="role"
                                  value={editForm.role}
                                  onChange={handleEditChange}
                                  className="edit-input"
                                >
                                  <option value="PHARMACIST">Pharmacien</option>
                                  <option value="STOCK_MANAGER">Gestionnaire Stock</option>
                                  <option value="ADMIN">Administrateur</option>
                                </select>
                              </td>
                              
                              <td className="actions">
                                <button
                                  className="action-button save-button"
                                  onClick={() => handleUpdateUser(user.id)}
                                  title="Sauvegarder"
                                >
                                  ✓
                                </button>
                                <button
                                  className="action-button cancel-button"
                                  onClick={() => setEditingUser(null)}
                                  title="Annuler"
                                >
                                  ✕
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td><strong>{user.username}</strong></td>
                              <td>{user.email}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`role-badge role-${user.role.toLowerCase()}`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="actions">
                                <button
                                  className="action-button edit-button"
                                  onClick={() => handleEditUser(user)}
                                  title="Éditer"
                                >
                                  ✏️
                                </button>
                              
                                <button
                                  className="action-button delete-button"
                                  onClick={() => handleDeleteUser(user.id)}
                                  title="Supprimer"
                                >
                                  🗑️
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <TablePagination
                    currentPage={userPage}
                    totalItems={filteredUsers.length}
                    pageSize={userPageSize}
                    onPageChange={setUserPage}
                    onPageSizeChange={setUserPageSize}
                    itemName="utilisateurs"
                  />
                </div>
              )}
            </section>
          )}

          {activeSection === 'home' && (
            <section className="medicines-section home-view">
              <div className="section-header">
                <div>
                  <h2>🏠 Tableau de Bord & Statistiques</h2>
                  <p className="home-subtitle">
                    Bienvenue, <strong>{username}</strong> • {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className="header-actions">
                  <button 
                    className="import-button" 
                    onClick={() => {
                      setActiveSection('inventory');
                      setTimeout(() => fileInputRef.current && fileInputRef.current.click(), 100);
                    }}
                    title="Importer l'inventaire Excel"
                  >
                    📥 Importer Excel
                  </button>
                  <button 
                    className="add-button" 
                    onClick={() => {
                      setActiveSection('movements');
                      setShowAddMovementForm(true);
                    }}
                    title="Enregistrer un nouveau mouvement"
                  >
                    + Nouveau Mouvement
                  </button>
                </div>
              </div>

              {/* 4 Cartes Statistiques Clés - Alignement net et clair */}
              <div className="home-stats-grid">
                <div 
                  className="stat-card clickable-card" 
                  onClick={() => setActiveSection('inventory')}
                  title="Voir le catalogue des produits"
                >
                  <div className="stat-icon">💊</div>
                  <div className="stat-content">
                    <h3>Médicaments</h3>
                    <p className="stat-value">{totalMedicines}</p>
                    <span className="card-link-text">Voir le catalogue →</span>
                  </div>
                </div>

                <div 
                  className="stat-card clickable-card" 
                  onClick={() => setActiveSection('inventory')}
                  title="Voir le stock disponible"
                >
                  <div className="stat-icon">📦</div>
                  <div className="stat-content">
                    <h3>Stock Global</h3>
                    <p className="stat-value">{totalStock}</p>
                    <span className="card-link-text">Unités en stock →</span>
                  </div>
                </div>

                <div 
                  className="stat-card clickable-card" 
                  onClick={() => setActiveSection('inventory')}
                  title="Valorisation totale de l'inventaire"
                >
                  <div className="stat-icon">💰</div>
                  <div className="stat-content">
                    <h3>Valeur Inventaire</h3>
                    <p className="stat-value">
                      {totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small style={{ fontSize: '15px' }}>DA</small>
                    </p>
                    <span className="card-link-text">Valorisation financière</span>
                  </div>
                </div>

                <div 
                  className={`stat-card clickable-card ${expiredBatches.length > 0 ? 'card-alert' : ''}`}
                  onClick={() => setActiveSection('expiredBatches')}
                  title="Consulter les lots périmés"
                >
                  <div className="stat-icon">{expiredBatches.length > 0 ? '⚠️' : '✅'}</div>
                  <div className="stat-content">
                    <h3>Lots Périmés</h3>
                    <p className={`stat-value ${expiredBatches.length > 0 ? 'text-danger' : 'text-success'}`}>
                      {expiredBatches.length}
                    </p>
                    <span className="card-link-text">
                      {expiredBatches.length > 0 ? 'Action requise →' : 'Aucun lot périmé'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Barre de flux des mouvements & Alertes */}
              <div className="home-flow-bar">
                <div 
                  className="flow-item flow-in"
                  onClick={() => { setActiveSection('movements'); setMvtFilter('IN'); }}
                  title="Voir toutes les entrées en stock"
                >
                  <span className="flow-icon">📥</span>
                  <div className="flow-text">
                    <span className="flow-label">Entrées de Stock (IN)</span>
                    <strong>{stockMovements.filter(m => m.movement_type === 'IN').reduce((s, m) => s + (m.quantity || 0), 0)} unités</strong>
                  </div>
                  <span className="flow-arrow">→</span>
                </div>

                <div 
                  className="flow-item flow-out"
                  onClick={() => { setActiveSection('movements'); setMvtFilter('OUT'); }}
                  title="Voir toutes les sorties de stock"
                >
                  <span className="flow-icon">📤</span>
                  <div className="flow-text">
                    <span className="flow-label">Sorties de Stock (OUT)</span>
                    <strong>{stockMovements.filter(m => m.movement_type === 'OUT').reduce((s, m) => s + (m.quantity || 0), 0)} unités</strong>
                  </div>
                  <span className="flow-arrow">→</span>
                </div>

                <div 
                  className={`flow-item ${medicines.filter(m => getProductQuantity(m) <= 0).length > 0 ? 'flow-warn' : 'flow-ok'}`}
                  onClick={() => setActiveSection('inventory')}
                  title="Consulter les produits en rupture de stock"
                >
                  <span className="flow-icon">{medicines.filter(m => getProductQuantity(m) <= 0).length > 0 ? '⚠️' : '✨'}</span>
                  <div className="flow-text">
                    <span className="flow-label">Ruptures de Stock</span>
                    <strong>{medicines.filter(m => getProductQuantity(m) <= 0).length} référence(s)</strong>
                  </div>
                  <span className="flow-arrow">→</span>
                </div>
              </div>

              {/* ========================================================
                  SECTION 1 DES PLOTS : FLUX & SANTÉ DU STOCK
                  ======================================================== */}
              <div className="home-charts-row">
                {/* Plot 1 : Histogramme des Mouvements (Entrées vs Sorties) */}
                <div className="chart-card">
                  <div className="chart-header">
                    <div>
                      <h3 className="chart-title">📊 Flux des Mouvements Récents</h3>
                      <p className="chart-subtitle">Volumes d'entrées (IN) et de sorties (OUT) par date</p>
                    </div>
                    <div className="chart-legend">
                      <span className="legend-item"><span className="legend-dot dot-in"></span> Entrées (IN)</span>
                      <span className="legend-item"><span className="legend-dot dot-out"></span> Sorties (OUT)</span>
                    </div>
                  </div>

                  <div className="chart-body">
                    {movementTimelineData.length === 0 ? (
                      <div className="chart-empty">
                        <p>Aucun mouvement enregistré pour générer l'histogramme.</p>
                      </div>
                    ) : (() => {
                      const maxQty = Math.max(10, ...movementTimelineData.map(d => Math.max(d.inQty, d.outQty))) * 1.15;
                      const chartH = 140;
                      const basePlotY = 175;
                      const plotW = 440;
                      const bandW = plotW / movementTimelineData.length;
                      const barW = Math.min(20, bandW * 0.36);

                      return (
                        <div className="svg-chart-wrap">
                          <svg viewBox="0 0 520 215" className="svg-chart">
                            {/* Gridlines horizontales */}
                            {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                              const y = basePlotY - ratio * chartH;
                              const val = Math.round(ratio * maxQty);
                              return (
                                <g key={idx}>
                                  <line x1="45" y1={y} x2="495" y2={y} stroke="#f1f5f9" strokeDasharray="4 4" />
                                  <text x="38" y={y + 4} textAnchor="end" className="chart-axis-label">{val}</text>
                                </g>
                              );
                            })}

                            {/* Barres par date */}
                            {movementTimelineData.map((d, i) => {
                              const cx = 50 + i * bandW + bandW / 2;
                              const hIn = (d.inQty / maxQty) * chartH;
                              const hOut = (d.outQty / maxQty) * chartH;
                              const yIn = basePlotY - hIn;
                              const yOut = basePlotY - hOut;
                              const isHovered = hoveredBar?.date === d.date;

                              return (
                                <g key={d.date} className="bar-group">
                                  {/* Barre IN */}
                                  <rect
                                    x={cx - barW - 2}
                                    y={yIn}
                                    width={barW}
                                    height={Math.max(3, hIn)}
                                    rx="3"
                                    fill="#10b981"
                                    className="chart-bar"
                                    opacity={isHovered ? 1 : 0.88}
                                    onMouseEnter={() => setHoveredBar({ ...d, type: 'IN' })}
                                    onMouseLeave={() => setHoveredBar(null)}
                                  />
                                  {/* Barre OUT */}
                                  <rect
                                    x={cx + 2}
                                    y={yOut}
                                    width={barW}
                                    height={Math.max(3, hOut)}
                                    rx="3"
                                    fill="#8b5cf6"
                                    className="chart-bar"
                                    opacity={isHovered ? 1 : 0.88}
                                    onMouseEnter={() => setHoveredBar({ ...d, type: 'OUT' })}
                                    onMouseLeave={() => setHoveredBar(null)}
                                  />
                                  {/* Label date */}
                                  <text x={cx} y="196" textAnchor="middle" className="chart-x-label">
                                    {d.formattedDate}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>

                          {/* Tooltip interactif */}
                          {hoveredBar && (
                            <div className="chart-tooltip">
                              <div className="tooltip-date">📅 {hoveredBar.date}</div>
                              <div className="tooltip-row">
                                <span className="legend-dot dot-in"></span> Entrées : <strong>{hoveredBar.inQty} unités</strong>
                              </div>
                              <div className="tooltip-row">
                                <span className="legend-dot dot-out"></span> Sorties : <strong>{hoveredBar.outQty} unités</strong>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Plot 2 : Donut de Disponibilité des Médicaments */}
                <div className="chart-card">
                  <div className="chart-header">
                    <div>
                      <h3 className="chart-title">🍩 Disponibilité du Stock</h3>
                      <p className="chart-subtitle">Répartition des {medicineHealthData.total} produits du catalogue</p>
                    </div>
                  </div>

                  <div className="donut-chart-container">
                    {medicineHealthData.total === 0 ? (
                      <div className="chart-empty">
                        <p>Aucun produit dans le catalogue.</p>
                      </div>
                    ) : (() => {
                      const C = 408.41;
                      const { inStock, lowStock, outOfStock, total } = medicineHealthData;
                      const lenIn = (inStock / total) * C;
                      const lenLow = (lowStock / total) * C;
                      const lenOut = (outOfStock / total) * C;
                      const offsetIn = 0;
                      const offsetLow = -lenIn;
                      const offsetOut = -(lenIn + lenLow);

                      const activeInfo = hoveredDonut || {
                        val: total,
                        lbl: 'Total Produits',
                        pct: 100
                      };

                      return (
                        <div className="donut-flex-wrap">
                          <div className="donut-svg-wrap">
                            <svg viewBox="0 0 200 200" className="donut-svg">
                              <circle cx="100" cy="100" r="65" fill="none" stroke="#f1f5f9" strokeWidth="22" />

                              {inStock > 0 && (
                                <circle
                                  cx="100" cy="100" r="65" fill="none"
                                  stroke="#10b981" strokeWidth="22"
                                  strokeDasharray={`${lenIn} ${C - lenIn}`}
                                  strokeDashoffset={offsetIn}
                                  transform="rotate(-90 100 100)"
                                  className="donut-segment"
                                  onMouseEnter={() => setHoveredDonut({ val: inStock, lbl: 'En stock', pct: Math.round(inStock / total * 100) })}
                                  onMouseLeave={() => setHoveredDonut(null)}
                                />
                              )}

                              {lowStock > 0 && (
                                <circle
                                  cx="100" cy="100" r="65" fill="none"
                                  stroke="#f59e0b" strokeWidth="22"
                                  strokeDasharray={`${lenLow} ${C - lenLow}`}
                                  strokeDashoffset={offsetLow}
                                  transform="rotate(-90 100 100)"
                                  className="donut-segment"
                                  onMouseEnter={() => setHoveredDonut({ val: lowStock, lbl: 'Stock faible', pct: Math.round(lowStock / total * 100) })}
                                  onMouseLeave={() => setHoveredDonut(null)}
                                />
                              )}

                              {outOfStock > 0 && (
                                <circle
                                  cx="100" cy="100" r="65" fill="none"
                                  stroke="#ef4444" strokeWidth="22"
                                  strokeDasharray={`${lenOut} ${C - lenOut}`}
                                  strokeDashoffset={offsetOut}
                                  transform="rotate(-90 100 100)"
                                  className="donut-segment"
                                  onMouseEnter={() => setHoveredDonut({ val: outOfStock, lbl: 'En rupture', pct: Math.round(outOfStock / total * 100) })}
                                  onMouseLeave={() => setHoveredDonut(null)}
                                />
                              )}

                              <text x="100" y="96" textAnchor="middle" className="donut-center-val">
                                {activeInfo.val}
                              </text>
                              <text x="100" y="117" textAnchor="middle" className="donut-center-sub">
                                {activeInfo.lbl}
                              </text>
                            </svg>
                          </div>

                          <div className="donut-legend-list">
                            <div 
                              className="donut-legend-row"
                              onMouseEnter={() => setHoveredDonut({ val: inStock, lbl: 'En stock', pct: Math.round(inStock / total * 100) })}
                              onMouseLeave={() => setHoveredDonut(null)}
                            >
                              <div className="legend-indicator">
                                <span className="donut-dot dot-normal"></span>
                                <div>
                                  <strong>En stock normal</strong>
                                  <span className="sub-desc">&gt; 10 unités</span>
                                </div>
                              </div>
                              <span className="legend-qty">{inStock} <small>({Math.round((inStock / total) * 100)}%)</small></span>
                            </div>

                            <div 
                              className="donut-legend-row"
                              onMouseEnter={() => setHoveredDonut({ val: lowStock, lbl: 'Stock faible', pct: Math.round(lowStock / total * 100) })}
                              onMouseLeave={() => setHoveredDonut(null)}
                            >
                              <div className="legend-indicator">
                                <span className="donut-dot dot-low"></span>
                                <div>
                                  <strong>Stock faible</strong>
                                  <span className="sub-desc">1 à 10 unités</span>
                                </div>
                              </div>
                              <span className="legend-qty text-warn">{lowStock} <small>({Math.round((lowStock / total) * 100)}%)</small></span>
                            </div>

                            <div 
                              className="donut-legend-row"
                              onMouseEnter={() => setHoveredDonut({ val: outOfStock, lbl: 'En rupture', pct: Math.round(outOfStock / total * 100) })}
                              onMouseLeave={() => setHoveredDonut(null)}
                            >
                              <div className="legend-indicator">
                                <span className="donut-dot dot-rupture"></span>
                                <div>
                                  <strong>Rupture de stock</strong>
                                  <span className="sub-desc">0 unité</span>
                                </div>
                              </div>
                              <span className="legend-qty text-danger">{outOfStock} <small>({Math.round((outOfStock / total) * 100)}%)</small></span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* ========================================================
                  SECTION 2 DES PLOTS : CLASSEMENTS ET CONTRÔLE QUALITÉ LOTS
                  ======================================================== */}
              <div className="home-charts-row">
                {/* Plot 3 : Top 5 Médicaments en Réserve */}
                <div className="chart-card">
                  <div className="chart-header">
                    <div>
                      <h3 className="chart-title">🏆 Top 5 des Médicaments en Stock</h3>
                      <p className="chart-subtitle">Les références ayant le plus grand volume physique disponible</p>
                    </div>
                  </div>

                  <div className="top-products-list">
                    {topMedicinesByStock.length === 0 ? (
                      <div className="chart-empty">
                        <p>Aucun produit enregistré.</p>
                      </div>
                    ) : (() => {
                      const maxStockProd = Math.max(1, ...topMedicinesByStock.map(p => p.qty));
                      return topMedicinesByStock.map((p, idx) => {
                        const pct = Math.round((p.qty / maxStockProd) * 100);
                        return (
                          <div key={p.id || idx} className="top-product-item">
                            <div className="top-product-header">
                              <div className="top-product-meta">
                                <span className={`rank-badge rank-${idx + 1}`}>#{idx + 1}</span>
                                <span className="top-product-name" title={p.name}>
                                  {p.name}
                                </span>
                              </div>
                              <div className="top-product-values">
                                <span className="top-product-qty">{p.qty} unités</span>
                                {p.totalValue > 0 && (
                                  <span className="top-product-val">({p.totalValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DA)</span>
                                )}
                              </div>
                            </div>
                            <div className="top-progress-bar">
                              <div className={`top-progress-fill fill-${idx + 1}`} style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Plot 4 : Statut & Validité des Lots */}
                <div className="chart-card">
                  <div className="chart-header">
                    <div>
                      <h3 className="chart-title">🏷️ Contrôle Qualité des Lots</h3>
                      <p className="chart-subtitle">Répartition sur les {batchHealthData.total} lots en inventaire</p>
                    </div>
                  </div>

                  <div className="batch-health-list">
                    {batchHealthData.total === 0 ? (
                      <div className="chart-empty">
                        <p>Aucun lot enregistré.</p>
                      </div>
                    ) : (() => {
                      const { valid, noExpiry, expired, total } = batchHealthData;
                      const pctValid = Math.round((valid / total) * 100);
                      const pctNoExp = Math.round((noExpiry / total) * 100);
                      const pctExp = Math.round((expired / total) * 100);

                      return (
                        <div className="batch-status-bars">
                          <div className="batch-status-row">
                            <div className="batch-status-head">
                              <span className="status-title">
                                <span className="status-icon-dot dot-normal"></span>
                                Lots Valides & Actifs
                              </span>
                              <span className="status-metric"><strong>{valid}</strong> lots ({pctValid}%)</span>
                            </div>
                            <div className="batch-track">
                              <div className="batch-fill fill-green" style={{ width: `${pctValid}%` }}></div>
                            </div>
                          </div>

                          <div className="batch-status-row">
                            <div className="batch-status-head">
                              <span className="status-title">
                                <span className="status-icon-dot dot-blue"></span>
                                Lots Sans Date d'Expiration
                              </span>
                              <span className="status-metric"><strong>{noExpiry}</strong> lots ({pctNoExp}%)</span>
                            </div>
                            <div className="batch-track">
                              <div className="batch-fill fill-blue" style={{ width: `${pctNoExp}%` }}></div>
                            </div>
                          </div>

                          <div className="batch-status-row">
                            <div className="batch-status-head">
                              <span className="status-title">
                                <span className="status-icon-dot dot-rupture"></span>
                                Lots Périmés (Retrait nécessaire)
                              </span>
                              <span className={`status-metric ${expired > 0 ? 'text-danger' : ''}`}>
                                <strong>{expired}</strong> lots ({pctExp}%)
                              </span>
                            </div>
                            <div className="batch-track">
                              <div className="batch-fill fill-red" style={{ width: `${pctExp}%` }}></div>
                            </div>
                          </div>

                          <div className="batch-summary-box">
                            <div className="summary-col">
                              <span>Taux de Conformité</span>
                              <strong style={{ color: expired === 0 ? '#10b981' : '#ef4444' }}>
                                {expired === 0 ? '100% Conforme' : `${Math.round(((total - expired) / total) * 100)}%`}
                              </strong>
                            </div>
                            <div className="summary-col">
                              <span>Statut d'Alerte</span>
                              <span>{expired > 0 ? `⚠️ ${expired} lot(s) à retirer` : '✅ Aucune anomalie détectée'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Récents Mouvements de Stock - Pleine largeur et clair */}
              <div className="home-section-block">
                <div className="block-header">
                  <div className="block-title">
                    <h3>📊 Récents Mouvements de Stock</h3>
                    <span>Les 5 dernières opérations enregistrées</span>
                  </div>
                  <button 
                    className="view-all-link-btn"
                    onClick={() => setActiveSection('movements')}
                  >
                    Voir tous les mouvements ({stockMovements.length}) →
                  </button>
                </div>

                {stockMovements.length === 0 ? (
                  <div className="no-data">
                    <p>Aucun mouvement de stock enregistré pour le moment.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="medicines-table">
                      <thead>
                        <tr>
                          <th style={{ width: '130px', textAlign: 'center' }}>Type</th>
                          <th>Médicament / Produit</th>
                          <th style={{ width: '120px', textAlign: 'center' }}>N° Lot</th>
                          <th style={{ width: '90px', textAlign: 'center' }}>Quantité</th>
                          <th>Motif</th>
                          <th style={{ width: '160px', textAlign: 'center' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockMovements.slice(0, 5).map((m) => {
                          const prodName = (typeof m.batch === 'object' && m.batch?.product?.item)
                            ? m.batch.product.item
                            : (medicines.find(med => (med.id ?? med.product_id) === (m.batch?.product?.id || m.batch?.product))?.item || 'N/A');
                          const batchId = (typeof m.batch === 'object')
                            ? (m.batch?.batch_id || m.batch?.batchId || 'N/A')
                            : (m.batch || 'N/A');
                          return (
                            <tr key={m.id}>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`movement-badge ${m.movement_type === 'IN' ? 'badge-in' : 'badge-out'}`}>
                                  {m.movement_type === 'IN' ? '📥 Entrée' : '📤 Sortie'}
                                </span>
                              </td>
                              <td><strong>{prodName}</strong></td>
                              <td style={{ textAlign: 'center' }}><span className="table-badge">#{batchId}</span></td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{m.quantity}</td>
                              <td style={{ color: '#666' }}>{m.reason || '—'}</td>
                              <td style={{ textAlign: 'center', color: '#666', fontSize: '12.5px' }}>
                                {m.createdAt ? new Date(m.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSection === 'inventory' && (
            <section className="medicines-section">
              <div className="section-header">
              <h2>📦 Inventaire des Médicaments ({medicines.length})</h2>

              <div className="header-actions">
                <button
                  className="import-button"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  title="Importer des produits depuis le fichier Excel d'inventaire"
                  disabled={importLoading}
                >
                  {importLoading ? '⏳ Analyse...' : '📥 Importer'}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".xlsx, .xls"
                  onChange={handleImportFileSelect}
                />

                <button
                  className="export-button"
                  onClick={() => handleExportMedicines('excel')}
                >
                  📊 Excel
                </button>

                <button
                  className="export-button"
                  onClick={() => handleExportMedicines('csv')}
                >
                  📄 CSV
                </button>

                <button 
                  className="add-button" 
                  onClick={() => setShowAddProductForm(!showAddProductForm)}
                >
                  {showAddProductForm ? '✕ Fermer' : '+ Ajouter'}
                </button>
              </div>
            </div>

              {/* Modal de Prévisualisation et Confirmation d'Importation */}
              {showImportModal && (
                <div className="modal-overlay" onClick={handleCloseImportModal}>
                  <div className="import-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <div className="modal-title-wrap">
                        <h3>📥 Importation d'inventaire Excel</h3>
                        <span className="file-name-badge">📄 {importFileDetails?.fileName}</span>
                      </div>
                      <button className="close-modal-btn" onClick={handleCloseImportModal} disabled={importLoading}>
                        ✕
                      </button>
                    </div>

                    <div className="import-stats-summary">
                      <div className="import-stat-item">
                        <span className="import-stat-label">Lignes détectées</span>
                        <span className="import-stat-num">{importItems.length}</span>
                      </div>
                      <div className="import-stat-item new-item">
                        <span className="import-stat-label">Nouveaux produits</span>
                        <span className="import-stat-num">{importItems.filter(i => !i.isExisting).length}</span>
                      </div>
                      <div className="import-stat-item exist-item">
                        <span className="import-stat-label">Produits existants (lot rattaché)</span>
                        <span className="import-stat-num">{importItems.filter(i => i.isExisting).length}</span>
                      </div>
                      <div className="import-stat-item stock-item">
                        <span className="import-stat-label">Lots avec stock (&gt; 0)</span>
                        <span className="import-stat-num">{importItems.filter(i => i.quantity > 0).length}</span>
                      </div>
                    </div>

                    <div className="import-info-note">
                      💡 <strong>Règles d'importation appliquées :</strong>
                      <ul>
                        <li>Les produits portant le même nom exact ne sont pas dupliqués : un lot leur est directement rattaché.</li>
                        <li>Les lots sont créés sans date d'expiration (valeur <code>null</code>) et considérés comme <strong>non périmés</strong>.</li>
                        <li>Un mouvement de stock d'entrée (IN) est automatiquement généré pour chaque lot ayant une quantité &gt; 0.</li>
                      </ul>
                    </div>

                    {importError && <div className="error-message">{importError}</div>}
                    {importSuccess && <div className="success-message">{importSuccess}</div>}

                    <div className="import-preview-table-container">
                      <table className="import-preview-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Feuille</th>
                            <th>Désignation / Nom</th>
                            <th>Quantité</th>
                            <th>Prix U (DA)</th>
                            <th>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importItems.map((item, idx) => (
                            <tr key={idx} className={item.isExisting ? 'row-existing' : 'row-new'}>
                              <td>{idx + 1}</td>
                              <td><span className="sheet-badge">{item.sheet}</span></td>
                              <td className="item-name-cell"><strong>{item.name}</strong></td>
                              <td>
                                <span className={`quantity-badge ${item.quantity > 0 ? 'normal' : 'low'}`}>
                                  {item.quantity}
                                </span>
                              </td>
                              <td>{item.unitPrice ? `${Number(item.unitPrice).toFixed(2)} DA` : '0.00 DA'}</td>
                              <td>
                                {item.isExisting ? (
                                  <span className="status-badge status-existing">Produit existant (lot rattaché)</span>
                                ) : (
                                  <span className="status-badge status-new">Nouveau produit</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={handleCloseImportModal}
                        disabled={importLoading}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        className="btn-confirm-import"
                        onClick={handleConfirmImport}
                        disabled={importLoading || importItems.length === 0}
                      >
                        {importLoading ? '⏳ Importation en cours...' : `✓ Valider et importer (${importItems.length} éléments)`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showAddProductForm && (
                <div className="add-product-form-container">
                  <form onSubmit={handleAddProductSubmit} className="add-product-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="item">Nom du médicament</label>
                        <input
                          id="item"
                          name="item"
                          type="text"
                          value={addProductForm.item}
                          onChange={handleAddProductChange}
                          placeholder="Ex: Paracétamol 500mg"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="designation">Catégorie</label>
                        <input
                          id="designation"
                          name="designation"
                          type="text"
                          value={addProductForm.designation}
                          onChange={handleAddProductChange}
                          placeholder="Ex: Analgésique"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="unitPrice">Prix unitaire (DA)</label>
                        <input
                          id="unitPrice"
                          name="unitPrice"
                          type="number"
                          step="0.01"
                          value={addProductForm.unitPrice}
                          onChange={handleAddProductChange}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>

                    {addProductError && <div className="error-message">{addProductError}</div>}
                    {addProductSuccess && <div className="success-message">{addProductSuccess}</div>}

                    <button type="submit" className="submit-button">
                      ✓ Ajouter le médicament
                    </button>
                  </form>
                </div>
              )}

              {/* Toolbar de Recherche et Filtres */}
              <div className="table-toolbar">
                <div className="search-bar-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Rechercher un médicament (nom, catégorie, ID)..."
                    value={medSearch}
                    onChange={(e) => {
                      setMedSearch(e.target.value);
                      setMedPage(1);
                    }}
                    className="table-search-input"
                  />
                  {medSearch && (
                    <button
                      className="clear-search-btn"
                      onClick={() => {
                        setMedSearch('');
                        setMedPage(1);
                      }}
                      title="Effacer la recherche"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="filter-chips-group">
                  <button
                    className={`filter-chip ${medFilter === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setMedFilter('all');
                      setMedPage(1);
                    }}
                  >
                    Tous ({medicines.length})
                  </button>
                  <button
                    className={`filter-chip ${medFilter === 'in_stock' ? 'active' : ''}`}
                    onClick={() => {
                      setMedFilter('in_stock');
                      setMedPage(1);
                    }}
                  >
                    En stock ({medicines.filter((m) => getProductQuantity(m) > 0).length})
                  </button>
                  <button
                    className={`filter-chip ${medFilter === 'out_of_stock' ? 'active' : ''}`}
                    onClick={() => {
                      setMedFilter('out_of_stock');
                      setMedPage(1);
                    }}
                  >
                    Rupture ({medicines.filter((m) => getProductQuantity(m) <= 0).length})
                  </button>
                </div>
              </div>

              {medicines.length === 0 ? (
                <div className="no-data">
                  <p>❌ Aucun médicament disponible</p>
                </div>
              ) : filteredMedicines.length === 0 ? (
                <div className="no-data">
                  <p>🔍 Aucun médicament ne correspond à votre recherche ou filtre.</p>
                  <button
                    className="reset-filters-btn"
                    onClick={() => {
                      setMedSearch('');
                      setMedFilter('all');
                      setMedPage(1);
                    }}
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <div className="medicines-table-wrapper">
                  <table className="medicines-table">
                    <thead>
                      <tr>
                        <SortableHeader label="Id" field="product_id" sortConfig={medSort} onSort={(f) => handleSort(medSort, setMedSort, f)} />
                        <SortableHeader label="Nom du médicament" field="item" sortConfig={medSort} onSort={(f) => handleSort(medSort, setMedSort, f)} />
                        <SortableHeader label="Catégorie" field="designation" sortConfig={medSort} onSort={(f) => handleSort(medSort, setMedSort, f)} />
                        <SortableHeader label="Quantité" field="quantity" sortConfig={medSort} onSort={(f) => handleSort(medSort, setMedSort, f)} align="center" />
                        <SortableHeader label="Prix Unitaire" field="unitPrice" sortConfig={medSort} onSort={(f) => handleSort(medSort, setMedSort, f)} align="right" />
                        <SortableHeader label="Valeur Totale" field="total" sortConfig={medSort} onSort={(f) => handleSort(medSort, setMedSort, f)} align="right" />
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMedicines.map((medicine) => {
                        const isEditing = editingProductId === medicine.product_id;
                        const quantity = isEditing ? (parseFloat(editProductForm.quantity) || 0) : getProductQuantity(medicine);
                        const unitPrice = isEditing ? (parseFloat(editProductForm.unitPrice) || 0) : (medicine.unitPrice || 0);

                        return (
                          <tr key={medicine.product_id}>
                            {isEditing ? (
                              <>
                                <td>
                                  <input
                                    type="text"
                                    name="product_id"
                                    value={editProductForm.product_id}
                                    className="edit-input"
                                    readOnly
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    name="item"
                                    value={editProductForm.item}
                                    onChange={handleEditProductChange}
                                    className="edit-input"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    name="designation"
                                    value={editProductForm.designation}
                                    onChange={handleEditProductChange}
                                    className="edit-input"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    name="quantity"
                                    value={editProductForm.quantity}
                                    onChange={handleEditProductChange}
                                    className="edit-input"
                                    readOnly
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.01"
                                    name="unitPrice"
                                    value={editProductForm.unitPrice}
                                    onChange={handleEditProductChange}
                                    className="edit-input"
                                  />
                                </td>
                                <td className="total-price" style={{ textAlign: 'right' }}>
                                  {(quantity * unitPrice).toFixed(2)} DA
                                </td>
                                <td className="actions">
                                  <button
                                    className="action-button save-button"
                                    onClick={() => handleUpdateProduct(medicine.product_id)}
                                    title="Sauvegarder"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    className="action-button cancel-button"
                                    onClick={() => setEditingProductId(null)}
                                    title="Annuler"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="medicine-id">#{medicine.product_id}</td>
                                <td className="medicine-name"><strong>{medicine.item}</strong></td>
                                <td>
                                  <span className="category-badge">{medicine.designation}</span>
                                </td>
                                <td className="quantity" style={{ textAlign: 'center' }}>
                                  <span className={`quantity-badge ${quantity <= 0 ? 'out-of-stock' : quantity < 20 ? 'low' : 'normal'}`}>
                                    {quantity}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>{unitPrice.toFixed(2)} DA</td>
                                <td className="total-price" style={{ textAlign: 'right' }}>
                                  <strong>{(quantity * unitPrice).toFixed(2)} DA</strong>
                                </td>
                                <td className="actions">
                                  <button
                                    className="action-button edit-button"
                                    onClick={() => handleEditProduct(medicine)}
                                    title="Éditer"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    className="action-button delete-button"
                                    onClick={() => handleDelete(medicine.product_id)}
                                    title="Supprimer"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <TablePagination
                    currentPage={medPage}
                    totalItems={filteredMedicines.length}
                    pageSize={medPageSize}
                    onPageChange={setMedPage}
                    onPageSizeChange={setMedPageSize}
                    itemName="médicaments"
                  />
                </div>
              )}
            </section>
          )}

          {activeSection === 'batches' && (
            <section className="medicines-section">
              <div className="section-header">
                <h2>📦 Lots ({batches.length})</h2>

                <div className="header-actions">
                  <button
                    className="export-button"
                    onClick={() => handleExportBatches('excel')}
                  >
                    📊 Excel
                  </button>

                  <button
                    className="export-button"
                    onClick={() => handleExportBatches('csv')}
                  >
                    📄 CSV
                  </button>

                  <button 
                    className="add-button" 
                    onClick={() => setShowAddBatchForm(!showAddBatchForm)}
                  >
                    {showAddBatchForm ? '✕ Fermer' : '+ Ajouter'}
                  </button>
                </div>
              </div>

              {showAddBatchForm && (
                <div className="add-product-form-container">
                  <form onSubmit={handleAddBatchSubmit} className="add-product-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="expiryDate">Date d'expiration</label>
                        <input
                          id="expiryDate"
                          name="expiryDate"
                          type="date"
                          value={addBatchForm.expiryDate}
                          onChange={handleAddBatchChange}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="product">Produit</label>
                        <select
                          id="product"
                          name="product"
                          value={addBatchForm.product}
                          onChange={handleAddBatchChange}
                          required
                        >
                          <option value="">Sélectionnez un médicament</option>
                          {medicines.map((p) => {
                            const itemId = p.id ?? p.productId ?? p.product_id;
                            const itemName = p.nom ?? p.name ?? p.item ?? p.designation;
                            
                            return (
                              <option key={itemId} value={itemId}>
                                {itemName}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="batch_quantity">Quantité initiale</label>
                        <input
                          id="batch_quantity"
                          name="batch_quantity"
                          type="number"
                          min="0"
                          value={addBatchForm.batch_quantity}
                          onChange={handleAddBatchChange}
                          required
                        />
                      </div>
                    </div>

                    {addBatchError && <div className="error-message">{addBatchError}</div>}
                    {addBatchSuccess && <div className="success-message">{addBatchSuccess}</div>}

                    <button type="submit" className="submit-button">
                      ✓ Ajouter le lot
                    </button>
                  </form>
                </div>
              )}

              {/* Toolbar de Recherche et Filtres pour les Lots */}
              <div className="table-toolbar">
                <div className="search-bar-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Rechercher un lot (ID lot, médicament, date)..."
                    value={batchSearch}
                    onChange={(e) => {
                      setBatchSearch(e.target.value);
                      setBatchPage(1);
                    }}
                    className="table-search-input"
                  />
                  {batchSearch && (
                    <button
                      className="clear-search-btn"
                      onClick={() => {
                        setBatchSearch('');
                        setBatchPage(1);
                      }}
                      title="Effacer la recherche"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="filter-chips-group">
                  <button
                    className={`filter-chip ${batchFilter === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setBatchFilter('all');
                      setBatchPage(1);
                    }}
                  >
                    Tous ({activeBatches.length})
                  </button>
                  <button
                    className={`filter-chip ${batchFilter === 'with_expiry' ? 'active' : ''}`}
                    onClick={() => {
                      setBatchFilter('with_expiry');
                      setBatchPage(1);
                    }}
                  >
                    Avec date ({activeBatches.filter((b) => b.expiryDate).length})
                  </button>
                  <button
                    className={`filter-chip ${batchFilter === 'no_expiry' ? 'active' : ''}`}
                    onClick={() => {
                      setBatchFilter('no_expiry');
                      setBatchPage(1);
                    }}
                  >
                    Sans date ({activeBatches.filter((b) => !b.expiryDate).length})
                  </button>
                  <button
                    className={`filter-chip ${batchFilter === 'low_stock' ? 'active' : ''}`}
                    onClick={() => {
                      setBatchFilter('low_stock');
                      setBatchPage(1);
                    }}
                  >
                    Stock faible &lt; 10 ({activeBatches.filter((b) => (b.batch_quantity || 0) < 10).length})
                  </button>
                </div>
              </div>

              {batches.length === 0 ? (
                <div className="no-data">
                  <p>❌ Aucun lot disponible</p>
                </div>
              ) : filteredBatches.length === 0 ? (
                <div className="no-data">
                  <p>🔍 Aucun lot ne correspond à votre recherche ou filtre.</p>
                  <button
                    className="reset-filters-btn"
                    onClick={() => {
                      setBatchSearch('');
                      setBatchFilter('all');
                      setBatchPage(1);
                    }}
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <div className="medicines-table-wrapper">
                  <table className="medicines-table">
                    <thead>
                      <tr>
                        <SortableHeader label="Id lot" field="batch_id" sortConfig={batchSort} onSort={(f) => handleSort(batchSort, setBatchSort, f)} />
                        <SortableHeader label="Date d'expiration" field="expiryDate" sortConfig={batchSort} onSort={(f) => handleSort(batchSort, setBatchSort, f)} align="center" />
                        <SortableHeader label="Quantité" field="batch_quantity" sortConfig={batchSort} onSort={(f) => handleSort(batchSort, setBatchSort, f)} align="center" />
                        <SortableHeader label="Id Produit" field="productId" sortConfig={batchSort} onSort={(f) => handleSort(batchSort, setBatchSort, f)} align="center" />
                        <SortableHeader label="Produit" field="productName" sortConfig={batchSort} onSort={(f) => handleSort(batchSort, setBatchSort, f)} />
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBatches.map((b) => {
                        const isEditing = editingBatchId === b.batch_id;
                        const rawExpiry = isEditing ? editBatchForm.expiryDate : b.expiryDate;
                        const quantity = isEditing ? editBatchForm.batch_quantity : (b.batch_quantity || b.quantity || 0);
                        
                        const renderProductId = (prod) => {
                          if (!prod) return "N/A";
                          if (typeof prod === "object") {
                            return prod.product_id || prod.productId || prod.id || "N/A";
                          }
                          return prod;
                        };

                        const renderProductName = (prod) => {
                          if (!prod) return "N/A";
                          if (typeof prod === "object") {
                            return prod.item || prod.designation || prod.nom || prod.name || "N/A";
                          }
                          const match = medicines.find(m => (m.id ?? m.productId ?? m.product_id) === prod);
                          return match ? (match.nom || match.name || match.item || match.designation) : "N/A";
                        };

                        return (
                          <tr key={b.batch_id}>
                            {isEditing ? (
                              <>
                                <td className="medicine-id">#{b.batch_id}</td>
                                <td>
                                  <input
                                    type="date"
                                    name="expiryDate"
                                    value={editBatchForm.expiryDate || ""}
                                    onChange={handleEditBatchChange}
                                    className="edit-input"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    name="batch_quantity"
                                    value={editBatchForm.batch_quantity || ""}
                                    className="edit-input"
                                    readOnly
                                  />
                                </td>
                                <td>{editBatchForm.product || "N/A"}</td>
                                <td>
                                  <select
                                    name="product"
                                    value={editBatchForm.product || ""}
                                    onChange={handleEditBatchChange}
                                    className="edit-input"
                                  >
                                    <option value="">Sélectionnez un médicament</option>
                                    {medicines.map((m) => {
                                      const itemId = m.id ?? m.productId ?? m.product_id;
                                      const itemName = m.nom ?? m.name ?? m.item ?? m.designation;
                                      
                                      return (
                                        <option key={itemId} value={itemId}>
                                          {itemName}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </td>
                                <td className="actions">
                                  <button
                                    className="action-button save-button"
                                    onClick={() => handleUpdateBatch(b.batch_id)}
                                    title="Sauvegarder"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    className="action-button cancel-button"
                                    onClick={() => setEditingBatchId(null)}
                                    title="Annuler"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="medicine-id">#{b.batch_id}</td>
                                {(() => {
                                  const daysUntilExpiry = rawExpiry 
                                    ? Math.ceil((new Date(rawExpiry) - new Date()) / (1000 * 60 * 60 * 24))
                                    : null;
                                  return (
                                    <td style={{ textAlign: 'center' }}>
                                      <span className={`quantity-badge ${daysUntilExpiry !== null && daysUntilExpiry < 30 ? 'low' : 'normal'}`}>
                                        {rawExpiry || 'Sans date'}
                                      </span>
                                    </td>
                                  );
                                })()}
                                <td className="quantity" style={{ textAlign: 'center' }}>
                                  <span className={`quantity-badge ${quantity <= 0 ? 'out-of-stock' : quantity < 10 ? 'low' : 'normal'}`}>
                                    {quantity}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>#{renderProductId(b.product)}</td>
                                <td className="medicine-name"><strong>{renderProductName(b.product)}</strong></td>
                                <td className="actions">
                                  <button
                                    className="action-button edit-button"
                                    onClick={() => handleEditBatch(b)}
                                    title="Éditer"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    className="action-button delete-button"
                                    onClick={() => handleDeleteBatch(b.batch_id)}
                                    title="Supprimer"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <TablePagination
                    currentPage={batchPage}
                    totalItems={filteredBatches.length}
                    pageSize={batchPageSize}
                    onPageChange={setBatchPage}
                    onPageSizeChange={setBatchPageSize}
                    itemName="lots"
                  />
                </div>
              )}
            </section>
          )}

          {activeSection === 'expiredBatches' && (
            <section className="medicines-section">
              <div className="section-header">
                <h2>⏰ Lots périmés ({expiredBatches.length})</h2>
                <div className="header-actions">
                  <button
                    className="export-button"
                    onClick={() => handleExportExpiredBatches('excel')}
                  >
                    📊 Excel
                  </button>
                  <button
                    className="export-button"
                    onClick={() => handleExportExpiredBatches('csv')}
                  >
                    📄 CSV
                  </button>
                </div>
              </div>

              {/* Toolbar de Recherche pour les lots périmés */}
              <div className="table-toolbar">
                <div className="search-bar-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Rechercher un lot périmé (ID lot, produit, date)..."
                    value={expSearch}
                    onChange={(e) => {
                      setExpSearch(e.target.value);
                      setExpPage(1);
                    }}
                    className="table-search-input"
                  />
                  {expSearch && (
                    <button
                      className="clear-search-btn"
                      onClick={() => {
                        setExpSearch('');
                        setExpPage(1);
                      }}
                      title="Effacer la recherche"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {expiredBatches.length === 0 ? (
                <div className="no-data">
                  <p>✓ Aucun lot périmé à signaler. Votre inventaire est à jour !</p>
                </div>
              ) : filteredExpiredBatches.length === 0 ? (
                <div className="no-data">
                  <p>🔍 Aucun lot périmé ne correspond à votre recherche.</p>
                  <button
                    className="reset-filters-btn"
                    onClick={() => {
                      setExpSearch('');
                      setExpPage(1);
                    }}
                  >
                    Réinitialiser la recherche
                  </button>
                </div>
              ) : (
                <div className="medicines-table-wrapper">
                  <table className="medicines-table">
                    <thead>
                      <tr>
                        <SortableHeader label="Lot" field="batch_id" sortConfig={expSort} onSort={(f) => handleSort(expSort, setExpSort, f)} />
                        <SortableHeader label="Produit" field="productName" sortConfig={expSort} onSort={(f) => handleSort(expSort, setExpSort, f)} />
                        <SortableHeader label="Date expiration" field="expiryDate" sortConfig={expSort} onSort={(f) => handleSort(expSort, setExpSort, f)} align="center" />
                        <SortableHeader label="Quantité restante" field="batch_quantity" sortConfig={expSort} onSort={(f) => handleSort(expSort, setExpSort, f)} align="center" />
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedExpiredBatches.map(batch => (
                        <tr key={batch.batch_id}>
                          <td className="medicine-id">#{batch.batch_id}</td>
                          <td className="medicine-name"><strong>{batch.product?.item || 'N/A'}</strong></td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="quantity-badge low">
                              {batch.expiryDate}
                            </span>
                          </td>
                          <td className="quantity" style={{ textAlign: 'center' }}>
                            <span className="quantity-badge out-of-stock">
                              {batch.batch_quantity}
                            </span>
                          </td>
                          <td className="actions">
                            {!batch.archived && (
                              <>
                                <button 
                                  className="action-button delete-button"
                                  onClick={() => handleClearExpiredBatch(batch)}
                                  title="Créer un mouvement de sortie et mettre la quantité à 0"
                                >
                                  🗑️ Retirer du stock
                                </button>

                                <button 
                                  className="action-button edit-button"
                                  onClick={() => handleArchiveBatch(batch)}
                                  title="Conserver la quantité mais ignorer dans le calcul de stock"
                                >
                                  📦 Archiver
                                </button>
                              </>
                            )}

                            {batch.archived && (
                              <span className="archived-label">
                                📦 Archivé
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <TablePagination
                    currentPage={expPage}
                    totalItems={filteredExpiredBatches.length}
                    pageSize={expPageSize}
                    onPageChange={setExpPage}
                    onPageSizeChange={setExpPageSize}
                    itemName="lots périmés"
                  />
                </div>
              )}
            </section>
          )}

          {activeSection === 'movements' && (() => {
            const selectedProductBatches = batches.filter(
              (b) => String(b.product?.product_id || b.product?.id || b.product) === String(addMovementForm.productId)
            );
            const currentSelectedBatch = batches.find(
              (b) => String(b.batch_id || b.batchId) === String(addMovementForm.batch)
            );

            return (
              <section className="medicines-section">
                <div className="section-header">
                  <h2>📊 Mouvements de Stock ({stockMovements.length})</h2>
                  <div className="header-actions">
                    <button
                      className="export-button"
                      onClick={() => handleExportMovements('excel')}
                    >
                      📊 Excel
                    </button>

                    <button
                      className="export-button"
                      onClick={() => handleExportMovements('csv')}
                    >
                      📄 CSV
                    </button>

                    <button 
                      className="add-button" 
                      onClick={() => setShowAddMovementForm(!showAddMovementForm)}
                    >
                      {showAddMovementForm ? '✕ Fermer' : '+ Ajouter'}
                    </button>
                  </div>
                </div>

                {showAddMovementForm && (
                  <div className="add-product-form-container">
                    <form onSubmit={handleAddMovementSubmit} className="add-product-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="mvt-product">1. Médicament / Produit</label>
                          <select
                            id="mvt-product"
                            name="productId"
                            value={addMovementForm.productId || ''}
                            onChange={handleMovementProductChange}
                            required
                          >
                            <option value="">Sélectionnez un médicament...</option>
                            {medicines.map((m) => {
                              const pId = m.product_id || m.productId || m.id;
                              return (
                                <option key={pId} value={pId}>
                                  {m.item} {m.designation ? `(${m.designation})` : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="form-group">
                          <label htmlFor="batch">2. Lot associé au produit</label>
                          <select
                            id="batch"
                            name="batch"
                            value={addMovementForm.batch || ''}
                            onChange={handleAddMovementChange}
                            disabled={!addMovementForm.productId}
                            required
                          >
                            {!addMovementForm.productId ? (
                              <option value="">← Choisissez d'abord un produit ci-contre</option>
                            ) : selectedProductBatches.length === 0 ? (
                              <option value="">⚠️ Aucun lot disponible pour ce produit</option>
                            ) : (
                              <>
                                <option value="">Sélectionnez un lot ({selectedProductBatches.length} disponible{selectedProductBatches.length > 1 ? 's' : ''})...</option>
                                {selectedProductBatches.map((b) => {
                                  const batchId = b.batch_id || b.batchId;
                                  const exp = b.expiryDate ? `Exp: ${b.expiryDate}` : 'Sans date';
                                  return (
                                    <option key={batchId} value={batchId}>
                                      Lot #{batchId} (Stock: {b.batch_quantity} | {exp})
                                    </option>
                                  );
                                })}
                              </>
                            )}
                          </select>
                        </div>

                        <div className="form-group">
                          <label htmlFor="movement_type">3. Type de mouvement</label>
                          <select
                            id="movement_type"
                            name="movement_type"
                            value={addMovementForm.movement_type}
                            onChange={handleAddMovementChange}
                            required
                          >
                            <option value="IN">📥 ENTRÉE (IN)</option>
                            <option value="OUT">📤 SORTIE (OUT)</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="quantity">
                            Quantité {addMovementForm.movement_type === 'OUT' && currentSelectedBatch && (
                              <span style={{ fontSize: '12px', color: '#c2410c', fontWeight: 'bold' }}>
                                (Max disponible : {currentSelectedBatch.batch_quantity})
                              </span>
                            )}
                          </label>
                          <input
                            id="quantity"
                            name="quantity"
                            type="number"
                            min="1"
                            max={addMovementForm.movement_type === 'OUT' && currentSelectedBatch ? currentSelectedBatch.batch_quantity : undefined}
                            value={addMovementForm.quantity || ''}
                            onChange={handleAddMovementChange}
                            placeholder="Ex: 10"
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="reason">Motif / Raison</label>
                          <input
                            id="reason"
                            name="reason"
                            type="text"
                            value={addMovementForm.reason}
                            onChange={handleAddMovementChange}
                            placeholder="Ex: Réception stock, Vente, Perte, Transfert..."
                            required
                          />
                        </div>
                      </div>

                      {addMovementError && <div className="error-message">{addMovementError}</div>}
                      {addMovementSuccess && <div className="success-message">{addMovementSuccess}</div>}

                      <button type="submit" className="submit-button">
                        ✓ Ajouter le mouvement
                      </button>
                    </form>
                  </div>
                )}

                {/* Toolbar de Recherche et Filtres pour les Mouvements */}
                <div className="table-toolbar">
                  <div className="search-bar-wrap">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      placeholder="Rechercher un mouvement (ID, produit, lot, motif)..."
                      value={mvtSearch}
                      onChange={(e) => {
                        setMvtSearch(e.target.value);
                        setMvtPage(1);
                      }}
                      className="table-search-input"
                    />
                    {mvtSearch && (
                      <button
                        className="clear-search-btn"
                        onClick={() => {
                          setMvtSearch('');
                          setMvtPage(1);
                        }}
                        title="Effacer la recherche"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="date-filter-wrap">
                    <span className="date-filter-icon">📅</span>
                    <input
                      type="date"
                      value={mvtDate}
                      onChange={(e) => {
                        setMvtDate(e.target.value);
                        setMvtPage(1);
                      }}
                      className="table-date-input"
                      title="Filtrer les mouvements pour une date donnée"
                    />
                    {mvtDate && (
                      <button
                        type="button"
                        className="clear-search-btn"
                        onClick={() => {
                          setMvtDate('');
                          setMvtPage(1);
                        }}
                        title="Effacer le filtre de date"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="filter-chips-group">
                    <button
                      className={`filter-chip ${mvtFilter === 'all' ? 'active' : ''}`}
                      onClick={() => {
                        setMvtFilter('all');
                        setMvtPage(1);
                      }}
                    >
                      Tous ({stockMovements.length})
                    </button>
                    <button
                      className={`filter-chip ${mvtFilter === 'IN' ? 'active' : ''}`}
                      onClick={() => {
                        setMvtFilter('IN');
                        setMvtPage(1);
                      }}
                    >
                      Entrées IN ({stockMovements.filter((m) => m.movement_type === 'IN').length})
                    </button>
                    <button
                      className={`filter-chip ${mvtFilter === 'OUT' ? 'active' : ''}`}
                      onClick={() => {
                        setMvtFilter('OUT');
                        setMvtPage(1);
                      }}
                    >
                      Sorties OUT ({stockMovements.filter((m) => m.movement_type === 'OUT').length})
                    </button>
                    {mvtDate && (
                      <span className="active-date-badge">
                        📅 {mvtDate} ({filteredMovements.length})
                      </span>
                    )}
                  </div>
                </div>

                {stockMovements.length === 0 ? (
                  <div className="no-data">
                    <p>❌ Aucun mouvement de stock disponible</p>
                  </div>
                ) : filteredMovements.length === 0 ? (
                  <div className="no-data">
                    <p>
                      🔍 Aucun mouvement ne correspond à votre recherche ou filtre
                      {mvtDate ? ` pour la date du ${mvtDate}` : ''}
                      {mvtSearch ? ` ("${mvtSearch}")` : ''}.
                    </p>
                    <button
                      className="reset-filters-btn"
                      onClick={() => {
                        setMvtSearch('');
                        setMvtFilter('all');
                        setMvtDate('');
                        setMvtPage(1);
                      }}
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                ) : (
                  <div className="medicines-table-wrapper">
                    <table className="medicines-table">
                      <thead>
                        <tr>
                          <SortableHeader label="ID" field="id" sortConfig={mvtSort} onSort={(f) => handleSort(mvtSort, setMvtSort, f)} />
                          <SortableHeader label="Type" field="movement_type" sortConfig={mvtSort} onSort={(f) => handleSort(mvtSort, setMvtSort, f)} align="center" />
                          <SortableHeader label="Quantité" field="quantity" sortConfig={mvtSort} onSort={(f) => handleSort(mvtSort, setMvtSort, f)} align="center" />
                          <SortableHeader label="Motif" field="reason" sortConfig={mvtSort} onSort={(f) => handleSort(mvtSort, setMvtSort, f)} />
                          <SortableHeader label="ID Lot" field="batchId" sortConfig={mvtSort} onSort={(f) => handleSort(mvtSort, setMvtSort, f)} align="center" />
                          <SortableHeader label="Produit" field="productName" sortConfig={mvtSort} onSort={(f) => handleSort(mvtSort, setMvtSort, f)} />
                          <SortableHeader label="Date opération" field="createdAt" sortConfig={mvtSort} onSort={(f) => handleSort(mvtSort, setMvtSort, f)} align="center" />
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedMovements.map((movement) => {
                          const isEditing = editingMovementId === movement.id;

                          const renderBatchId = (batchObj) => {
                            if (!batchObj) return "N/A";
                            if (typeof batchObj === "object") {
                              return batchObj.batch_id || batchObj.batchId || "N/A";
                            }
                            return batchObj;
                          };

                          const getProductName = (movement) => {
                            if (typeof movement.batch === 'object' && movement.batch?.product?.item) {
                              return movement.batch.product.item;
                            }
                            const matchedBatch = batches.find(
                              (b) => String(b.batch_id || b.batchId) === String(movement.batch?.batch_id || movement.batch)
                            );
                            return matchedBatch?.product?.item || 'N/A';
                          };

                          return (
                            <tr key={movement.id}>
                              {isEditing ? (
                                <>
                                  <td className="medicine-id">#{movement.id}</td>
                                  <td>
                                    <select
                                      name="movement_type"
                                      value={editMovementForm.movement_type}
                                      onChange={handleEditMovementChange}
                                      className="edit-input"
                                    >
                                      <option value="IN">IN</option>
                                      <option value="OUT">OUT</option>
                                    </select>
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="1"
                                      name="quantity"
                                      value={editMovementForm.quantity || ""}
                                      onChange={handleEditMovementChange}
                                      className="edit-input"
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      name="reason"
                                      value={editMovementForm.reason || ""}
                                      onChange={handleEditMovementChange}
                                      className="edit-input"
                                    />
                                  </td>
                                  <td>
                                    <select
                                      name="batch"
                                      value={editMovementForm.batch}
                                      onChange={handleEditMovementChange}
                                      className="edit-input"
                                    >
                                      <option value="">Sélectionnez un lot</option>
                                      {batches.map((b) => {
                                        const batchId = b.batch_id || b.batchId;
                                        return (
                                          <option key={batchId} value={batchId}>
                                            Lot #{batchId} (Exp: {b.expiryDate})
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </td>
                                  <td>{getProductName(movement)}</td>
                                  <td style={{ textAlign: 'center' }}>{movement.createdAt ? new Date(movement.createdAt).toLocaleString() : 'N/A'}</td>
                                  <td className="actions">
                                    <button
                                      className="action-button save-button"
                                      onClick={() => handleUpdateMovement(movement.id)}
                                      title="Sauvegarder"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      className="action-button cancel-button"
                                      onClick={() => setEditingMovementId(null)}
                                      title="Annuler"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="medicine-id">#{movement.id}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span className={`movement-badge ${movement.movement_type === 'IN' ? 'badge-in' : 'badge-out'}`}>
                                      {movement.movement_type === 'IN' ? '📥 ENTRÉE' : '📤 SORTIE'}
                                    </span>
                                  </td>
                                  <td className="quantity" style={{ textAlign: 'center' }}>
                                    <span className="quantity-badge normal">
                                      {movement.quantity}
                                    </span>
                                  </td>
                                  <td>{movement.reason}</td>
                                  <td style={{ textAlign: 'center' }}>#{renderBatchId(movement.batch)}</td>
                                  <td className="medicine-name"><strong>{getProductName(movement)}</strong></td>
                                  <td style={{ textAlign: 'center' }}>
                                    {movement.createdAt ? (
                                      <div>
                                        <strong>{new Date(movement.createdAt).toLocaleDateString('fr-FR')}</strong>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                          {new Date(movement.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                      </div>
                                    ) : 'N/A'}
                                  </td>
                                  <td className="actions">
                                    <button
                                      className="action-button edit-button"
                                      onClick={() => handleEditMovement(movement)}
                                      title="Éditer"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      className="action-button delete-button"
                                      onClick={() => handleDeleteMovement(movement.id)}
                                      title="Supprimer"
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <TablePagination
                      currentPage={mvtPage}
                      totalItems={filteredMovements.length}
                      pageSize={mvtPageSize}
                      onPageChange={setMvtPage}
                      onPageSizeChange={setMvtPageSize}
                      itemName="mouvements"
                    />
                  </div>
                )}
              </section>
            );
          })()}
        </main>
      </div>

      {showChangePasswordForm && (
        <div className="change-password-overlay">
          <div className="change-password-modal">
            <div className="modal-header">
              <h2>Changer le mot de passe</h2>
              <button 
                className="close-button" 
                onClick={() => setShowChangePasswordForm(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="change-password-form">
              <div className="form-group">
                <label htmlFor="currentPassword">Mot de passe actuel</label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={changePasswordForm.currentPassword}
                  onChange={handleChangePasswordChange}
                  placeholder="Entrez votre mot de passe actuel"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">Nouveau mot de passe</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={changePasswordForm.newPassword}
                  onChange={handleChangePasswordChange}
                  placeholder="Entrez votre nouveau mot de passe"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={changePasswordForm.confirmPassword}
                  onChange={handleChangePasswordChange}
                  placeholder="Confirmez votre nouveau mot de passe"
                  required
                />
              </div>

              {changePasswordError && <div className="error-message">{changePasswordError}</div>}
              {changePasswordSuccess && <div className="success-message">{changePasswordSuccess}</div>}

              <button type="submit" className="submit-button">
                Changer le mot de passe
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;