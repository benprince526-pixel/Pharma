package com.inventory.pharma.controller;

import com.inventory.pharma.config.util.JwtUtils;
import com.inventory.pharma.model.LoginResponseDTO;
import com.inventory.pharma.model.User;
import com.inventory.pharma.service.IUserService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import javax.crypto.SecretKey;
import javax.management.InstanceAlreadyExistsException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private IUserService userService;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private BCryptPasswordEncoder bCryptPasswordEncoder;

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> loginUser(@RequestBody User user){
        System.out.println(bCryptPasswordEncoder.encode(user.getPassword()));
        User dbUser = userService.getUserByUsername(user.getUsername())
                .filter(u -> bCryptPasswordEncoder.matches(user.getPassword(), u.getPassword()))
                .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));

        // 2. Generate the token with role
        String jwtToken = jwtUtils.generateToken(user.getUsername(), dbUser.getId(), dbUser.getRole().toString());
        System.out.println(jwtToken);
        // 3. Return the token in a response DTO
        return ResponseEntity.ok(new LoginResponseDTO(jwtToken, "Bearer"));
    }


    @PostMapping("/register")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> registerUser(@RequestBody User user) throws InstanceAlreadyExistsException {

        System.out.println("hello just testing");
        userService.createUser(user);
        return ResponseEntity.ok("user added in database");
    }
}
