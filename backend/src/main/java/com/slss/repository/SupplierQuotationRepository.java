package com.slss.repository;
import com.slss.domain.SupplierQuotation; import org.springframework.data.jpa.repository.JpaRepository; import java.util.List;
public interface SupplierQuotationRepository extends JpaRepository<SupplierQuotation,Long>{List<SupplierQuotation> findByProject_Id(Long id);}
