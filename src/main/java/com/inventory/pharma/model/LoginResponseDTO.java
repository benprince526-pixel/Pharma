package com.inventory.pharma.model;

public class LoginResponseDTO {
    private String jwtToken;
    private String type;

    public LoginResponseDTO(String jwtToken, String type){
        this.jwtToken = jwtToken;
        this.type = type;
    }

    public String getJwtToken() {
        return jwtToken;
    }

    public void setJwtToken(String jwtToken) {
        this.jwtToken = jwtToken;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}
