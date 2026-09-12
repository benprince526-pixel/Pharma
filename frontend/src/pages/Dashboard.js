import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { productService, authService, userService, decodeToken, batchService, stockMovementService } from '../services/api';
import companyLogo from '../services/logo.png';
import '../styles/Dashboard.css';
import { exportWithTemplate, exportToCSV, parseInventoryExcel } from '../services/excelService';

import prodTemplate from '../templates/inventaire produits pharmaceutiques2024.xlsx';
import lotTemplate from '../templates/inventaire lots pharmaceutiques2024.xlsx';
import mvtTemplate from '../templates/inventaire mouvements stock pharmaceutiques2024.xlsx';

function Dashboard({ onLogout }) {
  const [activeSection, setActiveSection] = useState('inventory');
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [users, setUsers] = useState([]);

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

  const handleExportMedicines = async (format = 'excel') => {
   const data = medicines.map((m, index) => {

        const prodId = m.product_id || m.productId || m.id;

        const quantity = batches
          .filter(
            b =>
              !b.archived &&
              ((b.product?.product_id || b.product?.id) === prodId)
          )
          .reduce(
            (sum, b) => sum + (Number(b.batch_quantity) || 0),
            0
          );

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
      console.log(
        "LOTS ARCHIVES",
        batches.filter(b => b.archived)
      );

      console.log(
        "LOTS EXPORTES",
        batches.filter(b => !b.archived)
      );
      await exportWithTemplate(
        prodTemplate || '/templates/inventaire produits pharmaceutiques2024.xlsx',
        data,
        'inventaire_medicaments',
        {
          title: `Inventaire des produits pharmaceutiques au ${new Date().toLocaleDateString('fr-FR')}`,
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
    const data = batches
      .filter(b => !b.archived)
      .map(b => ({
        idLot: b.batch_id,
        produit: b.product?.item || 'N/A',
        quantite: b.batch_quantity || 0,
        expiration: b.expiryDate || '',
        statut: 'Actif'
      }));

    if (format === 'csv') {
      exportToCSV(data, 'inventaire_lots');
    } else {
      await exportWithTemplate(
        lotTemplate || '/templates/inventaire lots pharmaceutiques2024.xlsx',
        data,
        'lots',
        {
          title: `Inventaire des lots pharmaceutiques au ${new Date().toLocaleDateString('fr-FR')}`,
          headers: ['N° Lot', 'Produit', 'Quantité', 'Date Expiration', 'Statut'],
          columnWidths: [14, 38, 14, 18, 16],
          columnAlignments: ['center', 'left', 'center', 'center', 'center'],
          columnFormats: ['0', undefined, '#,##0', 'yyyy-mm-dd', '@'],
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
    const data = stockMovements.map(m => ({
      id: m.id,
      date: m.createdAt ? new Date(m.createdAt).toLocaleString('fr-FR') : '',
      type: m.movement_type || '',
      produit: m.batch?.product?.item || 'N/A',
      lot: m.batch?.batch_id || 'N/A',
      quantite: m.quantity || 0,
      motif: m.reason || ''
    }));

    if (format === 'csv') {
      exportToCSV(data, 'mouvements_stock');
    } else {
      await exportWithTemplate(
        mvtTemplate || '/templates/inventaire mouvements stock pharmaceutiques2024.xlsx',
        data,
        'mouvements_stock',
        {
          title: `Historique des mouvements de stock au ${new Date().toLocaleDateString('fr-FR')}`,
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
    quantity: '',
    reason: '',
    batch: ''
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
    setAddMovementForm({ ...addMovementForm, [name]: value });
  };

  const handleAddMovementSubmit = async (e) => {
    e.preventDefault();
    setAddMovementError('');
    setAddMovementSuccess('');

    if (!addMovementForm.movement_type || !addMovementForm.quantity || !addMovementForm.reason || !addMovementForm.batch) {
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
          {isAdmin && (
            <button
              className={activeSection === 'users' ? 'nav-btn active' : 'nav-btn'}
              onClick={() => setActiveSection('users')}
            >
              👤 Utilisateurs
            </button>
          )}

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
        </aside>

        <main className="dashboard-main">
          {isAdmin && activeSection === 'users' && (
            <section className="admin-section">
              <div className="section-header">
                <h2>👤 Gestion des Utilisateurs</h2>
                <button 
                  className="add-button" 
                  onClick={() => setShowRegisterForm(!showRegisterForm)}
                >
                  {showRegisterForm ? '✕ Fermer' : '+ Ajouter un utilisateur'}
                </button>
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

              {users.length > 0 && (
                <div className="users-table-wrapper">
                  <h3>Liste des Utilisateurs</h3>
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Nom d'utilisateur</th>
                        <th>Email</th>
                        <th>Rôle</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
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
                              <td>{user.username}</td>
                              <td>{user.email}</td>
                              <td>
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
                </div>
              )}
            </section>
          )}

          <section className="stats-section">
            <div className="stat-card">
              <div className="stat-icon">💊</div>
              <div className="stat-content">
                <h3>Médicaments</h3>
                <p className="stat-value">{totalMedicines}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📦</div>
              <div className="stat-content">
                <h3>Stock Total</h3>
                <p className="stat-value">{totalStock}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-content">
                <h3>Valeur Inventaire</h3>
                <p className="stat-value">{totalValue.toFixed(2)} DA</p>
              </div>
            </div>
          </section>

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

              {medicines.length === 0 ? (
                <div className="no-data">
                  <p>❌ Aucun médicament disponible</p>
                </div>
              ) : (
                <div className="medicines-table-wrapper">
                  <table className="medicines-table">
                    <thead>
                      <tr>
                        <th>Id</th>
                        <th>Nom</th>
                        <th>Catégorie</th>
                        <th>Quantité</th>
                        <th>Prix Unitaire</th>
                        <th>Total</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medicines.map((medicine) => {
                        const isEditing = editingProductId === medicine.product_id;
                        const quantity = isEditing ? (parseFloat(editProductForm.quantity) || 0) : (medicine.quantity || 0);
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
                                <td className="total-price">
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
                                <td className="medicine-id">{medicine.product_id}</td>
                                <td className="medicine-name">{medicine.item}</td>
                                <td>
                                  <span className="category-badge">{medicine.designation}</span>
                                </td>
                                <td className="quantity">
                                  <span className={`quantity-badge ${quantity < 100 ? 'low' : 'normal'}`}>
                                    {quantity}
                                  </span>
                                </td>
                                <td>{unitPrice.toFixed(2)} DA</td>
                                <td className="total-price">
                                  {(quantity * unitPrice).toFixed(2)} DA
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
                </div>
              )}
            </section>
          )}

          {activeSection === 'batches' && (
            <section className="medicines-section">
              <div className="section-header">
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

                </div>
              </div>
                <button 
                  className="add-button" 
                  onClick={() => setShowAddBatchForm(!showAddBatchForm)}
                >
                  {showAddBatchForm ? '✕ Fermer' : '+ Ajouter'}
                </button>
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

              {batches.length === 0 ? (
                <div className="no-data">
                  <p>❌ Aucun lot disponible</p>
                </div>
              ) : (
                <div className="medicines-table-wrapper">
                  <table className="medicines-table">
                    <thead>
                      <tr>
                        <th>Id lot</th>
                        <th>Date d'expiration</th>
                        <th>Quantité</th>
                        <th>Id Produit</th>
                        <th>Produit</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeBatches.map((b) => {
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
                                <td className="medicine-id">{b.batch_id}</td>
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
                                      const mId = m.id ?? m.productId ?? m.product_id;
                                      return (
                                        <option key={mId} value={mId}>
                                          {m.nom || m.name || m.item || m.designation}
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
                                <td className="medicine-id">{b.batch_id}</td>
                                {(() => {
                                  const daysUntilExpiry = rawExpiry 
                                    ? Math.ceil((new Date(rawExpiry) - new Date()) / (1000 * 60 * 60 * 24))
                                    : null;
                                  return (
                                    <td>
                                      <span className={`quantity-badge ${daysUntilExpiry !== null && daysUntilExpiry < 30 ? 'low' : 'normal'}`}>
                                        {rawExpiry || 'Sans date'}
                                      </span>
                                    </td>
                                  );
                                })()}
                                <td className="quantity">
                                  <span className="quantity-badge normal">
                                    {quantity}
                                  </span>
                                </td>
                                <td>{renderProductId(b.product)}</td>
                                <td className="medicine-name">{renderProductName(b.product)}</td>
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
                </div>
              )}
            </section>
          )}

          {activeSection === 'expiredBatches' && (
            <section className="medicines-section">
              <div className="section-header">
                <h2>⏰ Lots périmés ({expiredBatches.length})</h2>
              </div>

              <div className="medicines-table-wrapper">
                <table className="medicines-table">
                  <thead>
                    <tr>
                      <th>Lot</th>
                      <th>Produit</th>
                      <th>Date expiration</th>
                      <th>Quantité restante</th>
                    </tr>
                  </thead>

                  <tbody>
                  {expiredBatches.map(batch => (
                    <tr key={batch.batch_id}>
                      <td>{batch.batch_id}</td>
                      <td>{batch.product?.item}</td>
                      <td>{batch.expiryDate}</td>
                      <td>{batch.batch_quantity}</td>
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
              </div>
            </section>
          )}

          {activeSection === 'movements' && (() => {
            const currentSelectedBatch = batches.find(
              (b) => String(b.batch_id || b.batchId) === String(addMovementForm.batch)
            );

            return (
              <section className="medicines-section">
                <div className="section-header">
                  <h2>📊 Mouvements de Stock ({stockMovements.length})</h2>
                  <button 
                    className="add-button" 
                    onClick={() => setShowAddMovementForm(!showAddMovementForm)}
                  >
                    {showAddMovementForm ? '✕ Fermer' : '+ Ajouter'}
                  </button>
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
                    </div>
                </div>

                {showAddMovementForm && (
                  <div className="add-product-form-container">
                    <form onSubmit={handleAddMovementSubmit} className="add-product-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="movement_type">Type de mouvement</label>
                          <select
                            id="movement_type"
                            name="movement_type"
                            value={addMovementForm.movement_type}
                            onChange={handleAddMovementChange}
                            required
                          >
                            <option value="IN">ENTRÉE (IN)</option>
                            <option value="OUT">SORTIE (OUT)</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label htmlFor="batch">Lot associé</label>
                          <select
                            id="batch"
                            name="batch"
                            value={addMovementForm.batch}
                            onChange={handleAddMovementChange}
                            required
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
                        </div>

                        <div className="form-group">
                          <label>Produit associé</label>
                          <input
                            type="text"
                            value={currentSelectedBatch?.product?.item || ""}
                            readOnly
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="quantity">Quantité</label>
                          <input
                            id="quantity"
                            name="quantity"
                            type="number"
                            min="1"
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
                            placeholder="Ex: Réception stock, Vente, Perte..."
                            required
                          />
                        </div>
                      </div>

                      {addMovementError && <div className="error-message">{addMovementError}</div>}
                      {addMovementSuccess && <div className="success-message">{addMovementSuccess}</div>}

                      <button type="submit" className="submit-button">
                        ✓ Enregistrer le mouvement
                      </button>
                    </form>
                  </div>
                )}

                {stockMovements.length === 0 ? (
                  <div className="no-data">
                    <p>❌ Aucun mouvement de stock disponible</p>
                  </div>
                ) : (
                  <div className="medicines-table-wrapper">
                    <table className="medicines-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Type</th>
                          <th>Quantité</th>
                          <th>Motif</th>
                          <th>ID Lot</th>
                          <th>Produit</th>
                          <th>Date insertion lot</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockMovements.map((movement) => {
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
                                  <td className="medicine-id">{movement.id}</td>
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
                                      value={editMovementForm.batch || ""}
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
                                  <td>{movement.createdAt ? new Date(movement.createdAt).toLocaleString() : 'N/A'}</td>
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
                                  <td className="medicine-id">{movement.id}</td>
                                  <td>
                                    <span className={`quantity-badge ${movement.movement_type === 'IN' ? 'normal' : 'low'}`}>
                                      {movement.movement_type}
                                    </span>
                                  </td>
                                  <td className="quantity">
                                    <span className="quantity-badge normal">
                                      {movement.quantity}
                                    </span>
                                  </td>
                                  <td>{movement.reason}</td>
                                  <td>{renderBatchId(movement.batch)}</td>
                                  <td>{getProductName(movement)}</td>
                                  <td>{movement.createdAt ? new Date(movement.createdAt).toLocaleDateString() : 'N/A'}</td>
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