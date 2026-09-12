package com.inventory.pharma.dto;

import java.util.ArrayList;
import java.util.List;

public class ProductImportResultDTO {
    private int totalProcessed;
    private int productsCreated;
    private int productsUpdated;
    private int batchesCreated;
    private int movementsCreated;
    private List<String> messages = new ArrayList<>();

    public ProductImportResultDTO() {
    }

    public ProductImportResultDTO(int totalProcessed, int productsCreated, int productsUpdated, int batchesCreated, int movementsCreated) {
        this.totalProcessed = totalProcessed;
        this.productsCreated = productsCreated;
        this.productsUpdated = productsUpdated;
        this.batchesCreated = batchesCreated;
        this.movementsCreated = movementsCreated;
    }

    public int getTotalProcessed() {
        return totalProcessed;
    }

    public void setTotalProcessed(int totalProcessed) {
        this.totalProcessed = totalProcessed;
    }

    public int getProductsCreated() {
        return productsCreated;
    }

    public void setProductsCreated(int productsCreated) {
        this.productsCreated = productsCreated;
    }

    public int getProductsUpdated() {
        return productsUpdated;
    }

    public void setProductsUpdated(int productsUpdated) {
        this.productsUpdated = productsUpdated;
    }

    public int getBatchesCreated() {
        return batchesCreated;
    }

    public void setBatchesCreated(int batchesCreated) {
        this.batchesCreated = batchesCreated;
    }

    public int getMovementsCreated() {
        return movementsCreated;
    }

    public void setMovementsCreated(int movementsCreated) {
        this.movementsCreated = movementsCreated;
    }

    public List<String> getMessages() {
        return messages;
    }

    public void setMessages(List<String> messages) {
        this.messages = messages;
    }

    public void addMessage(String message) {
        this.messages.add(message);
    }
}
