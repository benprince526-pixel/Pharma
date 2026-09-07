package com.inventory.pharma.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.inventory.pharma.model.enumerate.BatchStatus;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.List;

@Entity
public class Batch {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long batch_id;
    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Column(name = "batch_quantity", nullable = false)
    private Long batch_quantity;

    @Enumerated(EnumType.STRING)
    private BatchStatus status = BatchStatus.ACTIVE;

    @Column(nullable = false)
    private boolean archived = false; // NOUVEAU CHAMP


    @ManyToOne
    @JoinColumn(name = "product", nullable = false)
    private Product product;

    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL)
    @JsonIgnoreProperties("batch") // Stops recursive serialization between Batch and StockMovement
    private List<StockMovement> stockMovements;

    public Long getBatch_id() {
        return batch_id;
    }

    public void setBatch_id(Long batch_id) {
        this.batch_id = batch_id;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(LocalDate expiryDate) {
        this.expiryDate = expiryDate;
    }

    public Long getBatch_quantity() {
        return batch_quantity;
    }

    public void setBatch_quantity(Long batch_quantity) {
        this.batch_quantity = batch_quantity;
    }

    public List<StockMovement> getStockMovements() {
        return stockMovements;
    }

    public void setStockMovements(List<StockMovement> stockMovements) {
        this.stockMovements = stockMovements;
    }

    // Getters et Setters
    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }
}
