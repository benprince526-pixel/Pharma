package com.inventory.pharma.model;

import com.inventory.pharma.model.enumerate.MovementType;
import jakarta.persistence.*;

import java.sql.Timestamp;
import java.time.LocalDateTime;

@Entity
public class StockMovement {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;
    @Column(nullable = false)
    private MovementType movement_type;
    @Column(nullable = false)
    private Long quantity;
    @Column(nullable = false)
    private String reason;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    // StockMovement.java
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "batch_id", nullable = false)
    private Batch batch;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Batch getBatch() {
        return batch;
    }

    public void setBatch(Batch batch) {
        this.batch = batch;
    }

    public MovementType getMovement_type() {
        return movement_type;
    }

    public void setMovement_type(MovementType movement_type) {
        this.movement_type = movement_type;
    }

    public Long getQuantity() {
        return quantity;
    }

    public void setQuantity(Long quantity) {
        this.quantity = quantity;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public StockMovement() {
    }

    public StockMovement(MovementType movement_type, Long quantity, String reason, LocalDateTime createdAt, Batch batch) {
        this.movement_type = movement_type;
        this.quantity = quantity;
        this.reason = reason;
        this.createdAt = createdAt;
        this.batch = batch;
    }
}
