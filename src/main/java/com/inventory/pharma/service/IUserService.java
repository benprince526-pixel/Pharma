package com.inventory.pharma.service;

import com.inventory.pharma.model.User;

import java.util.List;
import java.util.Optional;

public interface IUserService {
    User createUser(User user);
    Optional<User> getUserById(Long userId);
    List<User> getAllUsers();
    Optional<User> getUserByUsername(String username);
    Optional<User> getUserByEmail(String email);
    User updateUser(Long userId, User userDetails);
    boolean deleteUser(Long userId);
}
