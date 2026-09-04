import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productService, authService, userService, decodeToken, batchService } from '../services/api';
import '../styles/Dashboard.css';

function Dashboard({ onLogout }) {
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [users, setUsers] = useState([]);
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
    quantity: '',
    unitPrice: '',
  });
  const [addProductError, setAddProductError] = useState('');
  const [addProductSuccess, setAddProductSuccess] = useState('');
  
  // State for Product Editing
  const [editingProductId, setEditingProductId] = useState(null);
  const [editProductForm, setEditProductForm] = useState({
    item: '',
    designation: '',
    quantity: '',
    unitPrice: '',
  });

  
  const [showAddBatchForm, setShowAddBatchForm] = useState(false);
  // 1. Updated Form State to include quantity
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
        console.log(response.data);
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
      if (response.data && Array.isArray(response.data)) {
        setBatches(response.data);
      }
    } catch (error) {
      console.error('Error fetching batches from API:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicines();
    fetchBatches();
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

    if (!addProductForm.item || !addProductForm.designation || !addProductForm.quantity || !addProductForm.unitPrice) {
      setAddProductError('Tous les champs sont obligatoires');
      return;
    }

    try {
      const newProduct = {
        item: addProductForm.item,
        designation: addProductForm.designation,
        quantity: parseInt(addProductForm.quantity),
        unitPrice: parseFloat(addProductForm.unitPrice),
      };
      
      await productService.create(newProduct);
      setAddProductSuccess('Médicament ajouté avec succès!');
      setAddProductForm({ item: '', designation: '', quantity: '', unitPrice: '' });
      fetchMedicines();
      setTimeout(() => setShowAddProductForm(false), 1500);
    } catch (error) {
      console.error('Error adding product:', error);
      setAddProductError(error.response?.data?.message || 'Erreur lors de l\'ajout du médicament');
    }
  };

  // Product Inline Edit Handlers
  const handleEditProduct = (medicine) => {
    setEditingProductId(medicine.product_id);
    setEditProductForm({
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
      fetchMedicines();
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
        setMedicines(medicines.filter((med) => med.id !== id));
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Erreur lors de la suppression');
      }
    }
  };
// Initial State Helpers
const initialAddBatchState = { expiryDate: '', product: '', batch_quantity: '' };
const initialEditBatchState = { batch_id: '', expiryDate: '', product: '', batch_quantity: '' };

// Batches Operations
const handleAddBatchChange = (e) => {
  const { name, value } = e.target;
  setAddBatchForm({ ...addBatchForm, [name]: value });
};

const handleAddBatchSubmit = async (e) => {
  e.preventDefault();
  setAddBatchError('');
  setAddBatchSuccess('');

  if (!addBatchForm.expiryDate || !addBatchForm.product || !addBatchForm.batch_quantity) {
    setAddBatchError('Tous les champs sont obligatoires');
    return;
  }

  const selectedProductId = parseInt(addBatchForm.product, 10);
  const quantityValue = parseInt(addBatchForm.batch_quantity, 10);

  if (isNaN(selectedProductId)) {
    setAddBatchError("Veuillez sélectionner un médicament valide.");
    return;
  }

  if (isNaN(quantityValue) || quantityValue <= 0) {
    setAddBatchError("La quantité du lot doit être un nombre supérieur à zéro.");
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

    console.log('Final Payload Sent to Backend:', newBatch);
    await batchService.create(newBatch);

    setAddBatchSuccess('Lot ajouté avec succès!');
    setAddBatchForm(initialAddBatchState);
    fetchBatches();
    setTimeout(() => setShowAddBatchForm(false), 1500);
  } catch (error) {
    console.error('Error adding Batch:', error);
    setAddBatchError(error.response?.data?.message || "Erreur lors de l'ajout d'un lot");
  }
};

// Batch Inline Edit Handlers
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

  if (isNaN(productId) || isNaN(quantityValue) || quantityValue <= 0) {
    alert("Veuillez saisir une quantité et un produit valides.");
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
    fetchBatches();
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
    setEditForm({ username: user.username, email: user.email, role: user.role });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });
  };

  const handleUpdateUser = async (userId) => {
    try {
      await userService.updateUser(userId, editForm);
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
  const totalStock = medicines.reduce((sum, med) => sum + med.quantity, 0);
  const totalValue = medicines.reduce((sum, med) => sum + med.quantity * med.unitPrice, 0);

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
          <h1>🏥 Pharma Inventory</h1>
          <p>Sonatrach Gassi Touil</p>
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

      <main className="dashboard-main">
        {isAdmin && (
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

        <section className="medicines-section">
          <div className="section-header">
            <h2>📦 Inventaire des Médicaments ({medicines.length})</h2>
            <button 
              className="add-button" 
              onClick={() => setShowAddProductForm(!showAddProductForm)}
            >
              {showAddProductForm ? '✕ Fermer' : '+ Ajouter'}
            </button>
          </div>

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
                    <label htmlFor="quantity">Quantité</label>
                    <input
                      id="quantity"
                      name="quantity"
                      type="number"
                      value={addProductForm.quantity}
                      onChange={handleAddProductChange}
                      placeholder="0"
                      required
                    />
                  </div>
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
                    console.log("Medicine item:", medicine); // Check the console to see exact property names (e.g. id, product_id, or productId)
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
        <section className="medicines-section">
  <div className="section-header">
    <h2>📦 Lots ({batches.length})</h2>
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
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="batch_quantity">Quantité du lot</label>
            <input
              id="batch_quantity"
              name="batch_quantity"
              type="number"
              min="1"
              value={addBatchForm.batch_quantity || ''}
              onChange={handleAddBatchChange}
              placeholder="Ex: 50"
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
          {batches.map((batch) => {
            const isEditing = editingBatchId === batch.batch_id;
            const rawExpiry = isEditing ? editBatchForm.expiryDate : batch.expiryDate;
            const quantity = isEditing ? editBatchForm.batch_quantity : (batch.batch_quantity || batch.quantity || 0);
            
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
              <tr key={batch.batch_id}>
                {isEditing ? (
                  <>
                    <td className="medicine-id">{batch.batch_id}</td>
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
                        min="1"
                        name="batch_quantity"
                        value={editBatchForm.batch_quantity || ""}
                        onChange={handleEditBatchChange}
                        className="edit-input"
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
                        onClick={() => handleUpdateBatch(batch.batch_id)}
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
                    <td className="medicine-id">{batch.batch_id}</td>
                    {(() => {
                      const daysUntilExpiry = rawExpiry 
                        ? Math.ceil((new Date(rawExpiry) - new Date()) / (1000 * 60 * 60 * 24))
                        : 0;
                      return (
                        <td>
                          <span className={`quantity-badge ${daysUntilExpiry < 30 ? 'low' : 'normal'}`}>
                            {rawExpiry || 'N/A'}
                          </span>
                        </td>
                      );
                    })()}
                    <td className="quantity">
                      <span className="quantity-badge normal">
                        {quantity}
                      </span>
                    </td>
                    <td>{renderProductId(batch.product)}</td>
                    <td className="medicine-name">{renderProductName(batch.product)}</td>
                    <td className="actions">
                      <button
                        className="action-button edit-button"
                        onClick={() => handleEditBatch(batch)}
                        title="Éditer"
                      >
                        ✏️
                      </button>
                      <button
                        className="action-button delete-button"
                        onClick={() => handleDeleteBatch(batch.batch_id)}
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
      </main>
    </div>
  );
}

export default Dashboard;