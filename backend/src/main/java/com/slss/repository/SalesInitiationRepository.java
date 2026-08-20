package com.slss.repository;
import com.slss.domain.SalesInitiation; import org.springframework.data.jpa.repository.JpaRepository; import org.springframework.data.domain.*;
public interface SalesInitiationRepository extends JpaRepository<SalesInitiation,Long>{Page<SalesInitiation> findAllByOrderByCreatedAtDesc(Pageable pageable);}
