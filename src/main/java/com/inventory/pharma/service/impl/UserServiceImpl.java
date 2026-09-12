package com.inventory.pharma.service.impl;

import com.inventory.pharma.model.User;
import com.inventory.pharma.model.enumerate.Role;
import com.inventory.pharma.repository.UserRepository;
import com.inventory.pharma.service.IUserService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class UserServiceImpl implements IUserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public static boolean isAlphanumeric(String str) {
        return str != null && str.matches("[a-zA-Z0-9]+") && !Character.isDigit(str.charAt(0));
    }
    public void verifyUserProperties(User user, boolean update){
        if(user.getRole().name().isEmpty()
                || (user.getPassword().length() <= 4 && !update)
                || !user.getEmail().matches(".*@.*\\..*")
                || (user.getUsername().length() < 4 && isAlphanumeric(user.getUsername()))){
            throw new BadCredentialsException("please fill all the required fields");
        }
    }

    public User createUser(User user) {
        verifyUserProperties(user, false);
        if (userRepository.existsByUsername(user.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (userRepository.existsByEmail(user.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    public Optional<User> getUserById(Long userId) {
        return userRepository.findById(userId);
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public Optional<User> getUserByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public User updateUser(Long userId, User userDetails) {
        Optional<User> user = userRepository.findById(userId);

        verifyUserProperties(userDetails, true);

        if (user.isPresent()) {
            User existingUser = user.get();
            if(existingUser.getRole() == Role.ADMIN && Objects.equals(existingUser.getUsername(), "admin")){
                throw new IllegalArgumentException("This user is admin do not change its parameters !!");
            }
            if (userDetails.getEmail() != null && !userDetails.getEmail().equals(existingUser.getEmail())) {
                if (userRepository.existsByEmail(userDetails.getEmail())) {
                    throw new IllegalArgumentException("Email already exists");
                }
                existingUser.setEmail(userDetails.getEmail());
            }
            if (userDetails.getPassword() != null) {
                existingUser.setPassword(passwordEncoder.encode(userDetails.getPassword()));
            }
            if (userDetails.getRole() != null) {
                existingUser.setRole(userDetails.getRole());
            }
            existingUser.setUpdatedAt(LocalDateTime.now());
            existingUser.setUsername(userDetails.getUsername());
            return userRepository.save(existingUser);
        }
        return null;
    }

    public boolean deleteUser(Long userId) throws IllegalAccessException {
        if (userRepository.existsById(userId)) {
            User user = userRepository.findById(userId).get();
            if(user.getRole() == Role.ADMIN && Objects.equals(user.getUsername(), "admin")){
                throw new IllegalAccessException("Cannot delete an admin");
            }
            userRepository.deleteById(userId);
            return true;
        }
        return false;
    }
}
