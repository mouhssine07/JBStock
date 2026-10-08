package com.jbstock.backend.company;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/company")
public class CompanyProfileController {
    private final CompanyProfileRepository repository;

    public CompanyProfileController(CompanyProfileRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public CompanyProfile getCompanyProfile() {
        return repository.get();
    }

    @PutMapping
    public CompanyProfile updateCompanyProfile(@Valid @RequestBody CompanyProfileRequest request) {
        return repository.update(request);
    }
}
