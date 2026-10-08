package com.jbstock.backend.company;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Repository
public class CompanyProfileRepository {
    private final JdbcTemplate jdbcTemplate;

    public CompanyProfileRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public CompanyProfile get() {
        CompanyProfile profile = jdbcTemplate.queryForObject(
                "SELECT name, address, phone, email FROM company_profile WHERE id = 1",
                (result, rowNumber) -> new CompanyProfile(
                        result.getString("name"), result.getString("address"),
                        result.getString("phone"), result.getString("email"), List.of()));
        List<FiscalIdentifier> identifiers = jdbcTemplate.query(
                "SELECT label, value FROM company_fiscal_identifier WHERE company_id = 1 ORDER BY position",
                (result, rowNumber) -> new FiscalIdentifier(
                        result.getString("label"), result.getString("value")));
        return new CompanyProfile(profile.name(), profile.address(), profile.phone(), profile.email(), identifiers);
    }

    @Transactional
    public CompanyProfile update(CompanyProfileRequest request) {
        jdbcTemplate.update("""
                UPDATE company_profile
                SET name = ?, address = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
                """, request.name().trim(), normalize(request.address()),
                normalize(request.phone()), normalize(request.email()));
        jdbcTemplate.update("DELETE FROM company_fiscal_identifier WHERE company_id = 1");
        for (int index = 0; index < request.fiscalIdentifiers().size(); index++) {
            FiscalIdentifierRequest identifier = request.fiscalIdentifiers().get(index);
            jdbcTemplate.update("""
                    INSERT INTO company_fiscal_identifier (company_id, label, value, position)
                    VALUES (1, ?, ?, ?)
                    """, identifier.label().trim(), normalize(identifier.value()), index);
        }
        return get();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
